import { useCallback, useEffect, useState } from 'react'
import { cacheWorkout, confirmWorkoutOperation, flagWorkoutOperation, getCachedWorkout,
  listLocalSessions, pendingWorkoutOperations, saveLocalWorkoutSession } from '../offline/workoutStore'
import { getCurrentWorkout, getStudentExerciseVideos, listWorkoutSessionsForWeek, syncWorkoutSession,
  type WorkoutEntry, type WorkoutSession, type WorkoutVersion } from '../services/workouts'
import { InstructionVideo } from './Workouts'

const messageOf = (error: unknown) => error instanceof Error ? error.message : 'Não foi possível concluir a operação.'
function monday(date: Date) {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7))
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
}
function shiftWeek(iso: string, weeks: number) {
  const date = new Date(`${iso}T12:00:00`)
  date.setDate(date.getDate() + weeks * 7)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
function cycleWeek(start: string, today = new Date()) {
  const first = new Date(`${start}T12:00:00`)
  const now = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12)
  return Math.max(0, Math.floor((now.getTime() - first.getTime()) / 604800000))
}
function weekLabel(iso: string) {
  const start = new Date(`${iso}T12:00:00`)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  return `${start.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} a ${end.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`
}
type LocalSession = Awaited<ReturnType<typeof listLocalSessions>>[number]
type SetValue = { reps: string; durationSeconds: string; loadKg: string; rir: string }
const entryValues = (session?: LocalSession) => Object.fromEntries((session?.entries ?? []).map(entry =>
  [`${entry.itemId}:${entry.setNumber}`, { reps: entry.reps == null ? '' : String(entry.reps), durationSeconds: entry.durationSeconds == null ? '' : String(entry.durationSeconds), loadKg: entry.loadKg == null ? '' : String(entry.loadKg), rir: entry.rir == null ? '' : String(entry.rir) }])) as Record<string, SetValue>
function timed(item: { targetKind?: string; reps: string; setLabels?: string[] }, index: number) {
  return item.targetKind === 'TIME' || (!item.targetKind && /\b(seg|segundos?|s)\b/i.test(`${item.setLabels?.[index] ?? ''} ${item.reps}`))
}
function preparation(item: { recordingStyle?: string; name: string }) {
  return item.recordingStyle === 'PREPARATION' || (!item.recordingStyle && /^alongamento\b/i.test(item.name))
}

export function WorkoutPlayer({ tenantId, studentId, userId }: { tenantId: string; studentId: string; userId: string }) {
  const [current, setCurrent] = useState<WorkoutVersion | null>(null)
  const [weekStart, setWeekStart] = useState(() => monday(new Date()))
  const [dayId, setDayId] = useState('')
  const [localSessions, setLocalSessions] = useState<LocalSession[]>([])
  const [remoteSessions, setRemoteSessions] = useState<WorkoutSession[]>([])
  const [edits, setEdits] = useState<Record<string, SetValue>>({})
  const [pending, setPending] = useState(0)
  const [attention, setAttention] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmPartial, setConfirmPartial] = useState(false)
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null)
  const [editingEntryKey, setEditingEntryKey] = useState('')
  const [liveVideos, setLiveVideos] = useState<{ versionId: string; urls: Record<string, string | null> } | null>(null)

  const refreshQueue = useCallback(async () => {
    const operations = await pendingWorkoutOperations(userId, tenantId)
    setPending(operations.length)
    setAttention(operations.filter(item => item.state === 'NEEDS_ATTENTION').length)
  }, [userId, tenantId])
  const synchronize = useCallback(async () => {
    if (!navigator.onLine) return
    const operations = await pendingWorkoutOperations(userId, tenantId)
    for (const operation of operations) {
      if (operation.state === 'NEEDS_ATTENTION') break
      try {
        await syncWorkoutSession(operation.id, operation.session)
        await confirmWorkoutOperation(operation.id)
      } catch (failure) {
        const message = messageOf(failure)
        if (/conflict|not authorized|invalid|inactive|another workout day/i.test(message)) await flagWorkoutOperation(operation.id, message)
        break
      }
    }
    await refreshQueue()
    try { setRemoteSessions(await listWorkoutSessionsForWeek(tenantId, studentId, weekStart)) } catch { /* Local data stays available offline. */ }
  }, [userId, tenantId, studentId, weekStart, refreshQueue])

  useEffect(() => {
    let mounted = true
    void (async () => {
      try {
        const cached = (await getCachedWorkout(userId, tenantId, studentId))?.version ?? null
        if (mounted) setCurrent(cached)
        if (navigator.onLine) {
          try {
            const assigned = await getCurrentWorkout(tenantId, studentId)
            if (assigned) await cacheWorkout(userId, tenantId, studentId, assigned.version)
            if (mounted) setCurrent(assigned?.version ?? cached)
          } catch (failure) { if (!cached && mounted) setError(messageOf(failure)) }
        }
        if (mounted) { await refreshQueue(); await synchronize() }
      } catch (failure) { if (mounted) setError(messageOf(failure)) }
    })()
    const online = () => { void synchronize() }
    window.addEventListener('online', online)
    return () => { mounted = false; window.removeEventListener('online', online) }
  }, [tenantId, studentId, userId, refreshQueue, synchronize])
  useEffect(() => {
    let mounted = true
    void listLocalSessions(userId, tenantId, studentId).then(rows => { if (mounted) setLocalSessions(rows) })
      .catch(failure => { if (mounted) setError(messageOf(failure)) })
    return () => { mounted = false }
  }, [userId, tenantId, studentId])
  useEffect(() => {
    if (!navigator.onLine) return
    let mounted = true
    void listWorkoutSessionsForWeek(tenantId, studentId, weekStart)
      .then(rows => { if (mounted) setRemoteSessions(rows) })
      .catch(() => { /* Local sessions remain available. */ })
    return () => { mounted = false }
  }, [tenantId, studentId, weekStart])

  useEffect(() => {
    if (!current) return
    const start = current.snapshot.startsOn
    const index = start ? Math.min(cycleWeek(start), (current.snapshot.durationWeeks ?? 1) - 1) : 0
    const timer = window.setTimeout(() => setWeekStart(start ? shiftWeek(start, Math.max(0, index)) : monday(new Date())), 0)
    return () => window.clearTimeout(timer)
  }, [current])

  const nextDayId = current?.snapshot.days.find(item => !localSessions.some(row => row.day_id === item.id && row.week_start === weekStart && row.status !== 'IN_PROGRESS')
    && !remoteSessions.some(row => row.day_id === item.id && row.week_start === weekStart && row.status !== 'IN_PROGRESS'))?.id
  const previousInProgress = localSessions.find(row => row.status === 'IN_PROGRESS' && row.version_id !== current?.id && row.day_id && row.week_start)
  const selectedPrevious = localSessions.find(row => row.day_id === dayId && row.week_start === weekStart && row.status === 'IN_PROGRESS')
  const effectiveDayId = current?.snapshot.days.some(day => day.id === dayId) || selectedPrevious ? dayId : nextDayId ?? current?.snapshot.days[0]?.id ?? ''
  const selectedLocal = localSessions.filter(row => row.day_id === effectiveDayId && row.week_start === weekStart)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
  const selectedRemote = remoteSessions.find(row => row.day_id === effectiveDayId && row.week_start === weekStart)
  const active = selectedLocal
  const displayed = active?.status === 'IN_PROGRESS' ? active.version : current
  const displayedVersionId = displayed?.id
  useEffect(() => {
    if (!displayedVersionId) return
    let mounted = true
    const versionId = displayedVersionId
    const refresh = () => {
      if (!navigator.onLine) return
      void getStudentExerciseVideos(studentId, versionId)
        .then(urls => { if (mounted) setLiveVideos({ versionId, urls }) })
        .catch(() => { /* The published snapshot remains available if media refresh fails. */ })
    }
    refresh()
    const visible = () => { if (document.visibilityState === 'visible') refresh() }
    window.addEventListener('online', refresh)
    document.addEventListener('visibilitychange', visible)
    return () => { mounted = false; window.removeEventListener('online', refresh); document.removeEventListener('visibilitychange', visible) }
  }, [studentId, displayedVersionId])
  const day = displayed?.snapshot.days.find(item => item.id === effectiveDayId)
  const values = { ...entryValues(active), ...edits }
  const firstPendingItemId = active?.status === 'IN_PROGRESS' && day && day.id === active.day_id
    ? day.items.find(item => active.entries.filter(entry => entry.itemId === item.id).length < item.sets)?.id : undefined
  const completed = (id: string) => localSessions.some(row => row.day_id === id && row.week_start === weekStart && row.status === 'COMPLETED')
    || remoteSessions.some(row => row.day_id === id && row.week_start === weekStart && row.status === 'COMPLETED')
  const partial = (id: string) => localSessions.some(row => row.day_id === id && row.week_start === weekStart && row.status === 'PARTIAL')
    || remoteSessions.some(row => row.day_id === id && row.week_start === weekStart && row.status === 'PARTIAL')
  const completedCount = displayed?.snapshot.days.filter(item => completed(item.id)).length ?? 0
  const partialCount = displayed?.snapshot.days.filter(item => partial(item.id)).length ?? 0
  const cycleStart = displayed?.snapshot.startsOn
  const currentWeek = cycleStart ? shiftWeek(cycleStart, Math.max(0, Math.min(cycleWeek(cycleStart), (displayed?.snapshot.durationWeeks ?? 1) - 1))) : monday(new Date())
  const firstWeek = cycleStart ?? (displayed ? monday(new Date(displayed.published_at)) : currentWeek)
  const lastWeek = cycleStart ? shiftWeek(cycleStart, (displayed?.snapshot.durationWeeks ?? 1) - 1) : currentWeek
  const weekNumber = cycleStart ? Math.floor((new Date(`${weekStart}T12:00:00`).getTime() - new Date(`${cycleStart}T12:00:00`).getTime()) / 604800000) + 1 : null
  const isCurrentWeek = weekStart === currentWeek
  const canStart = isCurrentWeek && (!cycleStart || new Date(`${cycleStart}T00:00:00`) <= new Date()) && (!cycleStart || cycleWeek(cycleStart) < (displayed?.snapshot.durationWeeks ?? 0))
  const done = active?.status === 'COMPLETED' || selectedRemote?.status === 'COMPLETED'
  const partiallyDone = active?.status === 'PARTIAL' || selectedRemote?.status === 'PARTIAL'
  const remoteOnly = !active && selectedRemote?.status === 'IN_PROGRESS'

  async function persist(entries: WorkoutEntry[], status: 'IN_PROGRESS' | 'COMPLETED' | 'PARTIAL', id: string): Promise<boolean> {
    if (!displayed || !day) return false
    setBusy(true); setError('')
    try {
      await saveLocalWorkoutSession(userId, tenantId, studentId, active?.version ?? displayed,
        id, entries, status, day.id, weekStart)
      setLocalSessions(await listLocalSessions(userId, tenantId, studentId))
      await refreshQueue()
      await synchronize()
      return true
    } catch (failure) { setError(messageOf(failure)); return false }
    finally { setBusy(false) }
  }
  async function record(itemId: string, setNumber: number) {
    if (!active) return
    const input = values[`${itemId}:${setNumber}`]
    const item = day?.items.find(row => row.id === itemId)
    if (!item) return
    const isTimed = timed(item, setNumber - 1)
    const target = Number(isTimed ? input?.durationSeconds : input?.reps)
    if (!Number.isInteger(target) || target < 1 || target > (isTimed ? 3600 : 999)) { setError(isTimed ? 'Informe o tempo realizado em segundos.' : 'Informe as repetições realizadas.'); return }
    const isPreparation = preparation(item)
    const loadKg = isPreparation || input?.loadKg === '' || input?.loadKg == null ? undefined : Number(input.loadKg)
    if (loadKg !== undefined && (!Number.isFinite(loadKg) || loadKg < 0 || loadKg > 9999 || !/^\d{1,4}(\.\d{1,2})?$/.test(input.loadKg))) { setError('Informe a carga em kg com até duas casas decimais ou deixe em branco.'); return }
    const rir = isPreparation || input?.rir === '' || input?.rir == null ? undefined : Number(input.rir)
    if (rir !== undefined && (!Number.isInteger(rir) || rir < 0 || rir > 10)) { setError('Informe um RIR entre 0 e 10.'); return }
    const wasSaved = active.entries.some(entry => entry.itemId === itemId && entry.setNumber === setNumber)
    const entries: WorkoutEntry[] = [...active.entries.filter(entry => entry.itemId !== itemId || entry.setNumber !== setNumber),
      { itemId, setNumber, ...(isTimed ? { durationSeconds: target } : { reps: target }), ...(loadKg === undefined ? {} : { loadKg }), ...(rir === undefined ? {} : { rir }) }]
    if (!await persist(entries, 'IN_PROGRESS', active.id)) return
    setEditingEntryKey('')
    if (!wasSaved && entries.filter(entry => entry.itemId === itemId).length === item.sets && day) {
      const index = day.items.findIndex(row => row.id === itemId)
      const next = day.items.slice(index + 1).find(row => entries.filter(entry => entry.itemId === row.id).length < row.sets)
      setExpandedExerciseId(next?.id ?? '')
      window.requestAnimationFrame(() => {
        const target = document.getElementById(next ? `exercise-${next.id}` : 'student-finish')
        target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        if (next) target?.querySelector('button')?.focus({ preventScroll: true })
      })
    } else if (!wasSaved) {
      window.requestAnimationFrame(() => document.querySelector<HTMLInputElement>(`[data-entry-key="${itemId}:${setNumber + 1}"] input`)?.focus({ preventScroll: true }))
    }
  }
  return <section className="workout-player"><h3>Seu treino</h3>{error && <p role="alert" className="feedback error">{error}</p>}
    {!displayed ? <p>{navigator.onLine ? 'Seu personal ainda não publicou um treino.' : 'Abra seu treino uma vez com internet para consultá-lo neste aparelho.'}</p> : <>
      <div className="student-workout-heading"><div><strong>{displayed.snapshot.title}</strong><small>Versão {displayed.version_number} · {displayed.snapshot.days.length} dias</small></div></div>
      {previousInProgress && !selectedPrevious && <div className="feedback"><p>Há um treino iniciado em uma versão anterior.</p><button type="button" className="secondary-button" onClick={() => { setWeekStart(previousInProgress.week_start!); setDayId(previousInProgress.day_id!); setEdits({}) }}>Continuar treino iniciado</button></div>}
      {displayed.snapshot.importantNote && <div className="student-important-note"><strong>Antes de começar</strong><p>{displayed.snapshot.importantNote}</p></div>}
      {displayed.snapshot.guidance && <details className="student-workout-guidance"><summary><span>Orientações do personal<small>Leia antes de começar</small></span></summary><p className="workout-guidance">{displayed.snapshot.guidance}</p></details>}
      <div className="student-week-nav" aria-label="Semana do treino">
        <button type="button" className="secondary-button" disabled={weekStart <= firstWeek} onClick={() => setWeekStart(shiftWeek(weekStart, -1))} aria-label="Semana anterior">‹</button>
        <div><strong>{weekNumber ? `Semana ${weekNumber} de ${displayed.snapshot.durationWeeks}` : isCurrentWeek ? 'Esta semana' : 'Semana selecionada'}</strong><small>{weekLabel(weekStart)} · {completedCount} completos{partialCount ? ` · ${partialCount} parciais` : ''}</small></div>
        <button type="button" className="secondary-button" disabled={weekStart >= lastWeek} onClick={() => setWeekStart(shiftWeek(weekStart, 1))} aria-label="Próxima semana">›</button>
      </div>
      <nav className="student-day-tabs" aria-label="Dias do treino">{displayed.snapshot.days.map((item, index) => <button key={item.id} type="button"
        className={item.id === effectiveDayId ? 'is-active' : ''} aria-current={item.id === effectiveDayId ? 'page' : undefined} onClick={() => { setDayId(item.id); setEdits({}); setExpandedExerciseId(null) }}>
        <span>Dia {index + 1}</span><strong>{item.name}</strong><small>{completed(item.id) ? 'Concluído' : partial(item.id) ? 'Parcial' : isCurrentWeek && item.id === nextDayId ? `Próximo · ${item.items.length} ${item.items.length === 1 ? 'exercício' : 'exercícios'}` : `${item.items.length} ${item.items.length === 1 ? 'exercício' : 'exercícios'}`}</small>
      </button>)}</nav>
      {day && <div className="student-day-panel"><div className="student-day-title"><div><span className="eyebrow">DIA {displayed.snapshot.days.indexOf(day) + 1}</span><h4>{day.name}</h4><p>{day.items.length} {day.items.length === 1 ? 'exercício' : 'exercícios'} · {done ? 'Concluído' : partiallyDone ? 'Encerrado parcialmente' : active?.status === 'IN_PROGRESS' ? 'Em andamento' : 'Pronto para começar'}</p></div></div>
        {(attention > 0 || pending > 0 || active || selectedRemote) && <p role="status" className={attention ? 'feedback error' : 'feedback'}>{attention ? `${attention} lançamento(s) precisam de atenção. Seus dados continuam neste aparelho.` : pending ? `${pending} lançamento(s) salvos neste aparelho, aguardando confirmação.` : 'Lançamentos confirmados no servidor.'}</p>}
        {remoteOnly && <p className="feedback">Este dia foi iniciado em outro aparelho. Conclua nele antes de iniciar outra execução aqui.</p>}
        {!active && !selectedRemote && canStart && <button type="button" disabled={busy} onClick={() => void persist([], 'IN_PROGRESS', crypto.randomUUID())}>Começar treino do dia {displayed.snapshot.days.indexOf(day) + 1}</button>}
      {day.items.map((item, index) => { const isPreparation = preparation(item); const expanded = expandedExerciseId === item.id || (expandedExerciseId === null && firstPendingItemId === item.id)
          const videoUrl = liveVideos?.versionId === displayed.id && Object.prototype.hasOwnProperty.call(liveVideos.urls, item.exerciseId)
            ? liveVideos.urls[item.exerciseId] : item.videoUrl
          const savedEntries = active?.entries.filter(entry => entry.itemId === item.id) ?? []
          const nextSetNumber = Array.from({ length: item.sets }, (_, number) => number + 1).find(number => !savedEntries.some(entry => entry.setNumber === number))
          const editedNumber = Number(editingEntryKey.startsWith(`${item.id}:`) ? editingEntryKey.split(':')[1] : 0)
          const visibleSetNumber = editedNumber || nextSetNumber
          return <article key={item.id} id={`exercise-${item.id}`} className={`student-exercise-card${isPreparation ? ' is-preparation' : ''}`}>
          <button type="button" className="student-exercise-toggle" aria-expanded={expanded} aria-controls={`exercise-content-${item.id}`} onClick={() => { setExpandedExerciseId(expanded ? '' : item.id); setEditingEntryKey('') }}><span className="student-exercise-number">{index + 1}</span><span><strong>{item.name}</strong><small>{active?.status === 'IN_PROGRESS' && savedEntries.length === item.sets ? 'Concluído · ' : ''}{item.sets} {isPreparation ? item.sets === 1 ? 'etapa' : 'etapas' : item.sets === 1 ? 'série' : 'séries'} · {item.reps}</small></span><span aria-hidden="true">{expanded ? '⌃' : '⌄'}</span></button>
          {expanded && <div id={`exercise-content-${item.id}`} className="student-exercise-body">{item.instructions && <p>{item.instructions}</p>}{item.notes && <p className="workout-item-note">{item.notes}</p>}
            {videoUrl && <InstructionVideo videoUrl={videoUrl} />}
            {active?.status === 'IN_PROGRESS' && day.id === active.day_id && <div className="student-entry-progress"><span>{savedEntries.length === item.sets ? 'Exercício registrado' : `${savedEntries.length} de ${item.sets} ${isPreparation ? 'etapas' : 'séries'} registradas`}</span><progress max={item.sets} value={savedEntries.length} aria-label={`Progresso de ${item.name}`} /></div>}
            {active?.status === 'IN_PROGRESS' && day.id === active.day_id && visibleSetNumber && (() => {
              const setNumber = visibleSetNumber; const setIndex = setNumber - 1; const key = `${item.id}:${setNumber}`
              const value = values[key] ?? { reps: '', durationSeconds: '', loadKg: '', rir: '' }
              const saved = active.entries.some(entry => entry.itemId === item.id && entry.setNumber === setNumber)
              const isTimed = timed(item, setIndex)
              return <div className={`workout-set${isPreparation ? ' workout-preparation' : ''}`} data-entry-key={key}><div className="student-entry-heading"><span className="eyebrow">{isPreparation ? 'PREPARAÇÃO' : 'REGISTRO DO EXERCÍCIO'}</span><strong>{item.setLabels?.[setIndex] || `${isPreparation ? 'Etapa' : 'Série'} ${setNumber}`} <small>· {setNumber} de {item.sets}</small></strong>{item.restSeconds != null && <small>Descanso previsto: {item.restSeconds} s</small>}</div>
              {isTimed ? <label>Tempo feito <span className="field-hint">segundos</span><input type="number" min="1" max="3600" inputMode="numeric" value={value.durationSeconds} onChange={event => setEdits(previous => ({ ...previous, [key]: { ...value, durationSeconds: event.target.value } }))} /></label> : <label>Repetições feitas<input type="number" min="1" max="999" inputMode="numeric" value={value.reps} onChange={event => setEdits(previous => ({ ...previous, [key]: { ...value, reps: event.target.value } }))} /></label>}
                {!isPreparation && <label>Carga <span className="field-hint">kg · opcional</span><input type="number" min="0" max="9999" step="0.01" inputMode="decimal" value={value.loadKg} onChange={event => setEdits(previous => ({ ...previous, [key]: { ...value, loadKg: event.target.value } }))} /></label>}
                {!isPreparation && <label>Repetições que sobrariam <span className="field-hint">opcional</span><input type="number" min="0" max="10" step="1" inputMode="numeric" value={value.rir} onChange={event => setEdits(previous => ({ ...previous, [key]: { ...value, rir: event.target.value } }))} /></label>}
                <button type="button" disabled={busy || (isTimed ? value.durationSeconds === '' : value.reps === '')} onClick={() => void record(item.id, setNumber)}>{saved ? 'Salvar correção' : setNumber === item.sets ? 'Salvar e continuar' : isPreparation ? 'Registrar etapa' : 'Registrar série'}</button>{saved && <button type="button" className="text-button" onClick={() => setEditingEntryKey('')}>Voltar ao treino</button>}</div>
            })()}
            {active?.status === 'IN_PROGRESS' && savedEntries.length > 0 && <div className="student-saved-sets"><span>Registros feitos</span>{savedEntries.slice().sort((a, b) => a.setNumber - b.setNumber).map(entry => <button type="button" key={entry.setNumber} className="secondary-button" onClick={() => setEditingEntryKey(`${item.id}:${entry.setNumber}`)}>{isPreparation ? 'Etapa' : 'Série'} {entry.setNumber} · {entry.durationSeconds != null ? `${entry.durationSeconds} s` : `${entry.reps} rep.`} <span>Editar</span></button>)}</div>}</div>}
        </article> })}
        {active?.status === 'IN_PROGRESS' && <div id="student-finish" className="student-finish"><p>{active.entries.length} de {day.items.reduce((sum, item) => sum + item.sets, 0)} registros feitos.</p>{active.entries.length === day.items.reduce((sum, item) => sum + item.sets, 0) ? <button type="button" disabled={busy} onClick={() => void persist(active.entries, 'COMPLETED', active.id)}>Concluir treino do dia</button> : <button type="button" className="secondary-button" disabled={busy} onClick={() => setConfirmPartial(true)}>Encerrar como parcial</button>}{confirmPartial && <div className="confirm-box"><p>O dia será registrado como parcial. Os registros feitos ficam no histórico.</p><button type="button" disabled={busy} onClick={() => { setConfirmPartial(false); void persist(active.entries, 'PARTIAL', active.id) }}>Confirmar encerramento parcial</button><button type="button" className="secondary-button" onClick={() => setConfirmPartial(false)}>Continuar treino</button></div>}</div>}
        {done && <p className="feedback">Dia concluído. Os lançamentos permanecem no histórico da semana.</p>}
        {partiallyDone && <p className="feedback">Dia encerrado como parcial. Os lançamentos permanecem no histórico.</p>}
        {!canStart && !active && !selectedRemote && <p className="feedback">Este período está disponível para consulta. Registre os treinos na semana atual do ciclo.</p>}
      </div>}
    </>}
  </section>
}
