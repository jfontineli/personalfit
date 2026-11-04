import { useCallback, useEffect, useState } from 'react'
import { adoptRemoteWorkoutSession, cacheWorkout, confirmWorkoutOperation, flagWorkoutOperation, getCachedWorkout,
  listLocalSessions, pendingWorkoutOperations, saveLocalWorkoutSession } from '../offline/workoutStore'
import { getCurrentWorkout, getStudentExerciseVideos, getWorkoutVersion, listWorkoutSessions, listWorkoutSessionsForWeek, syncWorkoutSession,
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
function clock(seconds: number) { const value = Math.max(0, Math.floor(seconds)); return `${String(Math.floor(value / 3600)).padStart(2, '0')}:${String(Math.floor(value / 60) % 60).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}` }
function targetHint(label: string | undefined, fallback: string) {
  const source = label?.split(/[·:]/).pop() ?? fallback
  const match = source.match(/\d+\s*(?:a|–|-)\s*\d+|\d+/i)
  return match ? match[0].replace(/\s+/g, ' ') : fallback
}
function beep(context: AudioContext | null) {
  if (!context) return
  try { const oscillator = context.createOscillator(); const gain = context.createGain(); oscillator.frequency.value = 880; gain.gain.setValueAtTime(.12, context.currentTime); gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .28); oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + .28) } catch { /* Some browsers mute background audio. */ }
}

export function WorkoutPlayer({ tenantId, studentId, userId }: { tenantId: string; studentId: string; userId: string }) {
  const [current, setCurrent] = useState<WorkoutVersion | null>(null)
  const [weekStart, setWeekStart] = useState(() => monday(new Date()))
  const [dayId, setDayId] = useState('')
  const [localSessions, setLocalSessions] = useState<LocalSession[]>([])
  const [remoteSessions, setRemoteSessions] = useState<WorkoutSession[]>([])
  const [historySessions, setHistorySessions] = useState<WorkoutSession[]>([])
  const [edits, setEdits] = useState<Record<string, SetValue>>({})
  const [pending, setPending] = useState(0)
  const [attention, setAttention] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmPartial, setConfirmPartial] = useState(false)
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null)
  const [editingEntryKey, setEditingEntryKey] = useState('')
  const [liveVideos, setLiveVideos] = useState<{ versionId: string; urls: Record<string, string | null> } | null>(null)
  const [now, setNow] = useState(0)
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('personalfit-rest-sound') !== 'off')
  const [restNotified, setRestNotified] = useState('')
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null)
  const [swapOpenId, setSwapOpenId] = useState('')

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
    try {
      const rows = await listWorkoutSessionsForWeek(tenantId, studentId, weekStart)
      setRemoteSessions(rows)
      for (const row of rows.filter(item => item.status === 'IN_PROGRESS' || item.status === 'PAUSED')) {
        try { await adoptRemoteWorkoutSession(userId, tenantId, studentId, await getWorkoutVersion(row.version_id), row) } catch { /* Keep server status visible; no local data is replaced on error. */ }
      }
      setLocalSessions(await listLocalSessions(userId, tenantId, studentId))
      setHistorySessions(await listWorkoutSessions(tenantId, studentId))
    } catch { /* Local data stays available offline. */ }
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
  useEffect(() => { const initial = window.setTimeout(() => setNow(Date.now()), 0); const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => { window.clearTimeout(initial); window.clearInterval(timer) } }, [])

  useEffect(() => {
    if (!current) return
    const start = current.snapshot.startsOn
    const index = start ? Math.min(cycleWeek(start), (current.snapshot.durationWeeks ?? 1) - 1) : 0
    const timer = window.setTimeout(() => setWeekStart(start ? shiftWeek(start, Math.max(0, index)) : monday(new Date())), 0)
    return () => window.clearTimeout(timer)
  }, [current])

  const nextDayId = current?.snapshot.days.find(item => !localSessions.some(row => row.day_id === item.id && row.week_start === weekStart && ['COMPLETED','PARTIAL','IN_PROGRESS','PAUSED'].includes(row.status))
    && !remoteSessions.some(row => row.day_id === item.id && row.week_start === weekStart && ['COMPLETED','PARTIAL','IN_PROGRESS','PAUSED'].includes(row.status)))?.id
  const previousInProgress = localSessions.find(row => ['IN_PROGRESS','PAUSED'].includes(row.status) && row.version_id !== current?.id && row.day_id && row.week_start)
  const selectedPrevious = localSessions.find(row => row.day_id === dayId && row.week_start === weekStart && ['IN_PROGRESS','PAUSED'].includes(row.status))
  const openSession = localSessions.find(row => row.week_start === weekStart && ['IN_PROGRESS','PAUSED'].includes(row.status))
    ?? remoteSessions.find(row => row.week_start === weekStart && ['IN_PROGRESS','PAUSED'].includes(row.status))
  const effectiveDayId = current?.snapshot.days.some(day => day.id === dayId) || selectedPrevious ? dayId : openSession?.day_id ?? nextDayId ?? current?.snapshot.days[0]?.id ?? ''
  const selectedLocal = localSessions.filter(row => row.day_id === effectiveDayId && row.week_start === weekStart)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
  const selectedRemote = remoteSessions.find(row => row.day_id === effectiveDayId && row.week_start === weekStart)
  const active = selectedLocal
  const displayed = active && ['IN_PROGRESS','PAUSED'].includes(active.status) ? active.version : current
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
  const firstPendingItemId = active && ['IN_PROGRESS','PAUSED'].includes(active.status) && day && day.id === active.day_id
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
  const remoteOnly = !active && (selectedRemote?.status === 'IN_PROGRESS' || selectedRemote?.status === 'PAUSED')
  const elapsedSeconds = (active?.elapsed_seconds ?? 0) + (active?.status === 'IN_PROGRESS' && active.runningSince ? Math.max(0, Math.floor((now - Date.parse(active.runningSince)) / 1000)) : 0)
  const remainingRest = active?.status === 'IN_PROGRESS' && active.restEndsAt ? Math.max(0, Math.ceil((Date.parse(active.restEndsAt) - now) / 1000)) : 0
  useEffect(() => {
    const deadline = active?.restEndsAt
    if (!deadline || active.status !== 'IN_PROGRESS' || Date.parse(deadline) > now || restNotified === deadline) return
    const timer = window.setTimeout(() => {
      setRestNotified(deadline)
      if (soundEnabled) beep(audioContext)
      if ('vibrate' in navigator) navigator.vibrate(200)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [active, now, soundEnabled, audioContext, restNotified])

  async function persist(entries: WorkoutEntry[], status: 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED' | 'PARTIAL', id: string,
    swaps?: Record<string, string>, restEndsAt?: string | null, issues?: Record<string, 'APARELHO_INDISPONIVEL'>): Promise<boolean> {
    if (!displayed || !day) return false
    setBusy(true); setError('')
    try {
      await saveLocalWorkoutSession(userId, tenantId, studentId, active?.version ?? displayed,
        id, entries, status, day.id, weekStart, swaps, restEndsAt, issues)
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
    const allSets = day?.items.reduce((sum, row) => sum + row.sets, 0) ?? 0
    const deadline = !wasSaved && item.restSeconds && entries.length < allSets ? new Date(Math.max(now, Date.parse(active.updatedAt)) + item.restSeconds * 1000).toISOString() : null
    if (soundEnabled && !audioContext && typeof AudioContext !== 'undefined') {
      try { const context = new AudioContext(); void context.resume().catch(() => {}); setAudioContext(context) } catch { /* Audio remains optional. */ }
    } else if (soundEnabled && audioContext?.state === 'suspended') void audioContext.resume().catch(() => {})
    if (!await persist(entries, 'IN_PROGRESS', active.id, undefined, wasSaved ? undefined : deadline)) return
    setRestNotified('')
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
  async function swapExercise(itemId: string, exerciseId: string) {
    if (!active || active.status !== 'IN_PROGRESS' || active.entries.some(entry => entry.itemId === itemId)) return
    const swaps = { ...active.exercise_swaps }
    if (exerciseId) swaps[itemId] = exerciseId; else delete swaps[itemId]
    const issues = { ...active.exercise_issues }
    if (exerciseId) delete issues[itemId]
    if (await persist(active.entries, 'IN_PROGRESS', active.id, swaps, undefined, issues)) setSwapOpenId('')
  }
  async function reportUnavailable(itemId: string) {
    if (!active || active.status !== 'IN_PROGRESS' || active.entries.some(entry => entry.itemId === itemId)) return
    const issues = { ...active.exercise_issues }
    if (issues[itemId]) delete issues[itemId]; else issues[itemId] = 'APARELHO_INDISPONIVEL'
    await persist(active.entries, 'IN_PROGRESS', active.id, undefined, undefined, issues)
  }
  function lastSet(itemId: string, setNumber: number) {
    const rows = [...localSessions.map(row => ({ id: row.id, entries: row.entries, at: row.client_finished_at ?? row.updatedAt })),
      ...historySessions.map(row => ({ id: row.id, entries: row.entries, at: row.client_finished_at ?? row.started_at }))]
      .filter(row => row.id !== active?.id && row.entries.some(entry => entry.itemId === itemId && entry.loadKg != null))
      .sort((a, b) => b.at.localeCompare(a.at))
    const row = rows[0]
    const entry = row?.entries.find(value => value.itemId === itemId && value.setNumber === setNumber && value.loadKg != null)
      ?? row?.entries.find(value => value.itemId === itemId && value.loadKg != null)
    return row && entry ? { entry, at: row.at } : null
  }
  return <section className="workout-player"><h3>Seu treino</h3>{error && <p role="alert" className="feedback error">{error}</p>}
    {!displayed ? <p>{navigator.onLine ? 'Seu personal ainda não publicou um treino.' : 'Abra seu treino uma vez com internet para consultá-lo neste aparelho.'}</p> : <>
      <div className="student-workout-heading"><div><strong>{displayed.snapshot.title}</strong><small>Versão {displayed.version_number} · {displayed.snapshot.days.length} dias</small></div></div>
      {active && <div className="student-session-clock" role="timer"><span>{active.status === 'COMPLETED' || active.status === 'PARTIAL' ? 'Tempo do treino' : active.status === 'PAUSED' ? 'Tempo registrado · pausado' : 'Tempo de treino'}</span><strong>{clock(elapsedSeconds)}</strong></div>}
      {active?.status === 'IN_PROGRESS' && active.restEndsAt && <div className={`student-rest-clock${remainingRest === 0 ? ' is-ready' : ''}`} role="status" aria-live="polite"><span>{remainingRest ? 'Descanso' : 'Descanso terminado. Pode seguir para a próxima série.'}</span>{remainingRest > 0 && <strong>{clock(remainingRest)}</strong>}<button type="button" className="text-button" onClick={() => { setSoundEnabled(value => { localStorage.setItem('personalfit-rest-sound', value ? 'off' : 'on'); return !value }) }}>{soundEnabled ? 'Som ligado' : 'Som desligado'}</button></div>}
      {previousInProgress && !selectedPrevious && <div className="feedback"><p>Há um treino iniciado em uma versão anterior.</p><button type="button" className="secondary-button" onClick={() => { setWeekStart(previousInProgress.week_start!); setDayId(previousInProgress.day_id!); setEdits({}) }}>Continuar treino iniciado</button></div>}
      {displayed.snapshot.importantNote && <div className="student-important-note"><strong>Antes de começar</strong><p>{displayed.snapshot.importantNote}</p></div>}
      {displayed.snapshot.guidance && <details className="student-workout-guidance"><summary><span>Orientações do personal<small>Leia antes de começar</small></span></summary><p className="workout-guidance">{displayed.snapshot.guidance}</p></details>}
      <div className="student-week-nav" aria-label="Semana do treino">
        <button type="button" className="secondary-button" disabled={weekStart <= firstWeek} onClick={() => setWeekStart(shiftWeek(weekStart, -1))} aria-label="Semana anterior">‹</button>
        <div><strong>{weekNumber ? `Semana ${weekNumber} de ${displayed.snapshot.durationWeeks}` : isCurrentWeek ? 'Esta semana' : 'Semana selecionada'}</strong><small>{weekLabel(weekStart)} · {completedCount} completos{partialCount ? ` · ${partialCount} parciais` : ''}</small></div>
        <button type="button" className="secondary-button" disabled={weekStart >= lastWeek} onClick={() => setWeekStart(shiftWeek(weekStart, 1))} aria-label="Próxima semana">›</button>
      </div>
      <nav className="student-day-tabs" aria-label="Dias do treino">{displayed.snapshot.days.map((item, index) => <button key={item.id} type="button"
        className={`${item.id === effectiveDayId ? 'is-active ' : ''}${completed(item.id) ? 'is-complete' : partial(item.id) ? 'is-partial' : ''}`} aria-current={item.id === effectiveDayId ? 'page' : undefined} onClick={() => { setDayId(item.id); setEdits({}); setExpandedExerciseId(null) }}>
        <span>Dia {index + 1}</span><strong>{item.name}</strong><small>{completed(item.id) ? '✓ Concluído' : partial(item.id) ? 'Encerrado incompleto' : localSessions.some(row => row.day_id === item.id && row.week_start === weekStart && row.status === 'PAUSED') || remoteSessions.some(row => row.day_id === item.id && row.week_start === weekStart && row.status === 'PAUSED') ? 'Pausado · continue quando puder' : localSessions.some(row => row.day_id === item.id && row.week_start === weekStart && row.status === 'IN_PROGRESS') || remoteSessions.some(row => row.day_id === item.id && row.week_start === weekStart && row.status === 'IN_PROGRESS') ? 'Em andamento' : isCurrentWeek && item.id === nextDayId ? `Próximo · ${item.items.length} ${item.items.length === 1 ? 'exercício' : 'exercícios'}` : `${item.items.length} ${item.items.length === 1 ? 'exercício' : 'exercícios'}`}</small>
      </button>)}</nav>
      {day && <div className="student-day-panel"><div className="student-day-title"><div><span className="eyebrow">DIA {displayed.snapshot.days.indexOf(day) + 1}</span><h4>{day.name}</h4><p>{day.items.length} {day.items.length === 1 ? 'exercício' : 'exercícios'} · {done ? 'Concluído' : partiallyDone ? 'Encerrado incompleto' : active?.status === 'PAUSED' ? 'Pausado' : active?.status === 'IN_PROGRESS' ? 'Em andamento' : 'Pronto para começar'}</p></div></div>
        {(active || selectedRemote) && <div className="student-day-progress"><strong>{day.items.filter(item => (active?.entries ?? selectedRemote?.entries ?? []).filter(entry => entry.itemId === item.id).length === item.sets).length} de {day.items.length} exercícios registrados</strong><progress max={day.items.length} value={day.items.filter(item => (active?.entries ?? selectedRemote?.entries ?? []).filter(entry => entry.itemId === item.id).length === item.sets).length} /></div>}
        {(attention > 0 || pending > 0 || active || selectedRemote) && <p role="status" className={attention ? 'feedback error' : 'feedback'}>{attention ? `${attention} lançamento(s) precisam de atenção. Seus dados continuam neste aparelho.` : pending ? `${pending} lançamento(s) salvos neste aparelho, aguardando confirmação.` : 'Lançamentos confirmados no servidor.'}</p>}
        {remoteOnly && <p className="feedback">Há um treino salvo no servidor para este dia. Tentando recuperá-lo neste aparelho. Se continuar bloqueado, conecte-se à internet e reabra a página.</p>}
        {!active && !selectedRemote && canStart && !openSession && <button type="button" disabled={busy} onClick={() => { setDayId(day.id); void persist([], 'IN_PROGRESS', crypto.randomUUID()) }}>Começar treino do dia {displayed.snapshot.days.indexOf(day) + 1}</button>}
        {!active && !selectedRemote && openSession && <p className="feedback">Você já tem um treino {openSession.status === 'PAUSED' ? 'pausado' : 'em andamento'} nesta semana. Abra esse dia para continuar.</p>}
        {active?.status === 'PAUSED' && <button type="button" disabled={busy} onClick={() => void persist(active.entries, 'IN_PROGRESS', active.id)}>Continuar treino do dia {displayed.snapshot.days.indexOf(day) + 1}</button>}
        {active?.status === 'IN_PROGRESS' && <button type="button" className="secondary-button student-pause-button" disabled={busy} onClick={() => void persist(active.entries, 'PAUSED', active.id, undefined, null)}>Pausar e continuar depois</button>}
      {day.items.map((item, index) => { const isPreparation = preparation(item); const expanded = expandedExerciseId === item.id || (expandedExerciseId === null && firstPendingItemId === item.id)
          const swapId = active?.exercise_swaps?.[item.id] ?? selectedRemote?.exercise_swaps?.[item.id]
          const actual = item.alternatives?.find(option => option.exerciseId === swapId)
          const videoExerciseId = actual?.exerciseId ?? item.exerciseId
          const videoUrl = liveVideos?.versionId === displayed.id && Object.prototype.hasOwnProperty.call(liveVideos.urls, videoExerciseId)
            ? liveVideos.urls[videoExerciseId] : actual?.videoUrl ?? item.videoUrl
          const savedEntries = (active?.entries ?? selectedRemote?.entries ?? []).filter(entry => entry.itemId === item.id)
          const nextSetNumber = Array.from({ length: item.sets }, (_, number) => number + 1).find(number => !savedEntries.some(entry => entry.setNumber === number))
          const editedNumber = Number(editingEntryKey.startsWith(`${item.id}:`) ? editingEntryKey.split(':')[1] : 0)
          const visibleSetNumber = editedNumber || nextSetNumber
          return <article key={item.id} id={`exercise-${item.id}`} className={`student-exercise-card${isPreparation ? ' is-preparation' : ''}${savedEntries.length === item.sets && (active || selectedRemote) ? ' is-complete' : ''}`}>
          <button type="button" className="student-exercise-toggle" aria-expanded={expanded} aria-controls={`exercise-content-${item.id}`} onClick={() => { setExpandedExerciseId(expanded ? '' : item.id); setEditingEntryKey('') }}><span className="student-exercise-number">{savedEntries.length === item.sets && (active || selectedRemote) ? '✓' : index + 1}</span><span><strong>{actual?.name ?? item.name}</strong><small>{savedEntries.length === item.sets && (active || selectedRemote) ? 'Concluído · ' : ''}{item.sets} {isPreparation ? item.sets === 1 ? 'etapa' : 'etapas' : item.sets === 1 ? 'série' : 'séries'} · {item.reps}</small></span><span aria-hidden="true">{expanded ? '⌃' : '⌄'}</span></button>
          {expanded && <div id={`exercise-content-${item.id}`} className="student-exercise-body">{actual && <p className="student-swap-note">Exercício principal: {item.name}. Esta troca vale somente para este treino.</p>}{(actual?.instructions ?? item.instructions) && <p>{actual?.instructions ?? item.instructions}</p>}{item.notes && <p className="workout-item-note">{item.notes}</p>}
            {videoUrl && <InstructionVideo videoUrl={videoUrl} />}
            {active?.status === 'IN_PROGRESS' && savedEntries.length === 0 && !!item.alternatives?.length && <div className="student-swap"><button type="button" className="secondary-button" onClick={() => setSwapOpenId(value => value === item.id ? '' : item.id)}>{actual ? 'Alterar exercício escolhido' : 'Trocar exercício neste dia'}</button>{swapOpenId === item.id && <label>Alternativa aprovada pelo personal<select value={swapId ?? ''} onChange={event => void swapExercise(item.id, event.target.value)}><option value="">Manter {item.name}</option>{item.alternatives.map(option => <option key={option.exerciseId} value={option.exerciseId}>{option.name}</option>)}</select></label>}</div>}
            {active?.status === 'IN_PROGRESS' && savedEntries.length === 0 && !item.alternatives?.length && <div className="student-swap"><p className="field-hint">Sem alternativa aprovada para este exercício. Se o aparelho estiver indisponível, avise seu personal.</p><button type="button" className="secondary-button" disabled={busy} onClick={() => void reportUnavailable(item.id)}>{active.exercise_issues?.[item.id] ? 'Desfazer aviso ao personal' : 'Avisar: aparelho indisponível'}</button>{active.exercise_issues?.[item.id] && <p role="status">Aviso registrado{pending ? ' neste aparelho; será enviado ao conectar.' : ' para o personal.'} Você pode continuar quando o aparelho ficar livre.</p>}</div>}
            {active?.status === 'IN_PROGRESS' && day.id === active.day_id && <div className="student-entry-progress"><span>{savedEntries.length === item.sets ? 'Exercício registrado' : `${savedEntries.length} de ${item.sets} ${isPreparation ? 'etapas' : 'séries'} registradas`}</span><progress max={item.sets} value={savedEntries.length} aria-label={`Progresso de ${item.name}`} /></div>}
            {active?.status === 'IN_PROGRESS' && day.id === active.day_id && visibleSetNumber && (() => {
              const setNumber = visibleSetNumber; const setIndex = setNumber - 1; const key = `${item.id}:${setNumber}`
              const value = values[key] ?? { reps: '', durationSeconds: '', loadKg: '', rir: '' }
              const saved = active.entries.some(entry => entry.itemId === item.id && entry.setNumber === setNumber)
              const isTimed = timed(item, setIndex)
               const previous = lastSet(item.id, setNumber)
               return <div className={`workout-set${isPreparation ? ' workout-preparation' : ''}`} data-entry-key={key}><div className="student-entry-heading"><span className="eyebrow">{isPreparation ? 'PREPARAÇÃO' : 'REGISTRO DO EXERCÍCIO'}</span><strong>{item.setLabels?.[setIndex] || `${isPreparation ? 'Etapa' : 'Série'} ${setNumber}`} <small>· {setNumber} de {item.sets}</small></strong>{item.restSeconds != null && <small>Descanso previsto: {item.restSeconds} s</small>}{!isPreparation && previous && <small>Última vez: {previous.entry.loadKg} kg · {previous.entry.reps ?? `${previous.entry.durationSeconds} s`} · {new Date(previous.at).toLocaleDateString('pt-BR')}</small>}</div>
               {isTimed ? <label>Tempo feito <span className="field-hint">segundos · alvo: {targetHint(item.setLabels?.[setIndex], item.reps)}</span><input type="number" min="1" max="3600" inputMode="numeric" placeholder={targetHint(item.setLabels?.[setIndex], item.reps)} value={value.durationSeconds} onChange={event => setEdits(previous => ({ ...previous, [key]: { ...value, durationSeconds: event.target.value } }))} /></label> : <label>Repetições feitas <span className="field-hint">alvo: {targetHint(item.setLabels?.[setIndex], item.reps)}</span><input type="number" min="1" max="999" inputMode="numeric" placeholder={targetHint(item.setLabels?.[setIndex], item.reps)} value={value.reps} onChange={event => setEdits(previous => ({ ...previous, [key]: { ...value, reps: event.target.value } }))} /></label>}
                 {!isPreparation && <label>Carga <span className="field-hint">kg · opcional{item.loadHintKg != null ? ` · referência do personal: ${item.loadHintKg} kg` : ''}</span><input type="number" min="0" max="9999" step="0.01" inputMode="decimal" placeholder={item.loadHintKg != null ? `${item.loadHintKg} kg` : previous?.entry.loadKg == null ? 'Sem carga anterior' : `Última: ${previous.entry.loadKg} kg`} value={value.loadKg} onChange={event => setEdits(previous => ({ ...previous, [key]: { ...value, loadKg: event.target.value } }))} /></label>}
                 {!isPreparation && <label>Repetições que sobrariam <span className="field-hint">opcional{item.rirHint ? ` · alvo: ${item.rirHint}` : ''}</span><input type="number" min="0" max="10" step="1" inputMode="numeric" placeholder={item.rirHint || (previous?.entry.rir == null ? 'Ex.: 2' : `Última: ${previous.entry.rir}`)} value={value.rir} onChange={event => setEdits(previous => ({ ...previous, [key]: { ...value, rir: event.target.value } }))} /></label>}
                <button type="button" disabled={busy || (isTimed ? value.durationSeconds === '' : value.reps === '')} onClick={() => void record(item.id, setNumber)}>{saved ? 'Salvar correção' : setNumber === item.sets ? 'Salvar e continuar' : isPreparation ? 'Registrar etapa' : 'Registrar série'}</button>{saved && <button type="button" className="text-button" onClick={() => setEditingEntryKey('')}>Voltar ao treino</button>}</div>
            })()}
            {active?.status === 'IN_PROGRESS' && savedEntries.length > 0 && <div className="student-saved-sets"><span>Registros feitos</span>{savedEntries.slice().sort((a, b) => a.setNumber - b.setNumber).map(entry => <button type="button" key={entry.setNumber} className="secondary-button" onClick={() => setEditingEntryKey(`${item.id}:${entry.setNumber}`)}>{isPreparation ? 'Etapa' : 'Série'} {entry.setNumber} · {entry.durationSeconds != null ? `${entry.durationSeconds} s` : `${entry.reps} rep.`} <span>Editar</span></button>)}</div>}</div>}
        </article> })}
        {active?.status === 'IN_PROGRESS' && <div id="student-finish" className="student-finish"><p>{active.entries.length} de {day.items.reduce((sum, item) => sum + item.sets, 0)} registros feitos.</p>{active.entries.length === day.items.reduce((sum, item) => sum + item.sets, 0) ? <button type="button" disabled={busy} onClick={() => void persist(active.entries, 'COMPLETED', active.id, undefined, null)}>Concluir treino do dia</button> : <button type="button" className="secondary-button" disabled={busy} onClick={() => setConfirmPartial(true)}>Encerrar treino incompleto</button>}{confirmPartial && <div className="confirm-box"><p>Isso encerra definitivamente este treino como incompleto. Para continuar depois, escolha “Pausar e continuar depois” acima. Seus registros serão preservados.</p><button type="button" disabled={busy} onClick={() => { setConfirmPartial(false); void persist(active.entries, 'PARTIAL', active.id, undefined, null) }}>Encerrar incompleto</button><button type="button" className="secondary-button" onClick={() => setConfirmPartial(false)}>Voltar ao treino</button></div>}</div>}
        {done && <p className="feedback">Treino concluído. Seus registros foram salvos{pending ? ' neste aparelho e aguardam sincronização.' : ' e confirmados no servidor.'}</p>}
        {partiallyDone && <p className="feedback">Treino encerrado como incompleto. Seus registros foram preservados{pending ? ' neste aparelho e aguardam sincronização.' : ' no histórico.'}</p>}
        {!canStart && !active && !selectedRemote && <p className="feedback">Este período está disponível para consulta. Registre os treinos na semana atual do ciclo.</p>}
      </div>}
    </>}
  </section>
}
