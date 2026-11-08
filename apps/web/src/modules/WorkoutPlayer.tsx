import { useCallback, useEffect, useRef, useState } from 'react'
import { adoptRemoteWorkoutSession, cacheWorkout, confirmWorkoutOperation, flagWorkoutOperation, getCachedWorkout,
  listLocalSessions, pendingWorkoutOperations, saveLocalWorkoutSession } from '../offline/workoutStore'
import { getCurrentWorkout, getStudentExerciseVideos, getWorkoutVersion, listWorkoutSessions, listWorkoutSessionsForWeek, syncWorkoutSession, youtubeThumbnailUrl,
  type WorkoutEntry, type WorkoutSession, type WorkoutVersion } from '../services/workouts'
import { InstructionVideo } from './Workouts'
import { workoutGuideSections } from './workoutGuides'
import { availableTrainingWeek, shiftWorkoutWeek } from './workoutCalendar'

const messageOf = (error: unknown) => error instanceof Error ? error.message : 'Não foi possível concluir a operação.'
function monday(date: Date) {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7))
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
}
function shiftWeek(iso: string, weeks: number) {
  return shiftWorkoutWeek(iso, weeks)
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
type SetValue = { reps: string; durationSeconds: string; durationMinutes: string; loadKg: string; rir: string }
const entryValues = (session?: LocalSession) => Object.fromEntries((session?.entries ?? []).map(entry =>
  [`${entry.itemId}:${entry.setNumber}`, { reps: entry.reps == null ? '' : String(entry.reps), durationSeconds: entry.durationSeconds == null ? '' : String(entry.durationSeconds), durationMinutes: entry.durationSeconds == null ? '' : String(entry.durationSeconds / 60), loadKg: entry.loadKg == null ? '' : String(entry.loadKg), rir: entry.rir == null ? '' : String(entry.rir) }])) as Record<string, SetValue>
function timed(item: { targetKind?: string; reps: string; setLabels?: string[] }, index: number) {
  return item.targetKind === 'TIME' || (!item.targetKind && /\b(seg|segundos?|s)\b/i.test(`${item.setLabels?.[index] ?? ''} ${item.reps}`))
}
function preparation(item: { recordingStyle?: string; name: string; loadHintKg?: number | null }) {
  return item.recordingStyle === 'PREPARATION' || (!item.recordingStyle && item.loadHintKg == null && /^alongamento\b/i.test(item.name))
}
function clock(seconds: number) { const value = Math.max(0, Math.floor(seconds)); return `${String(Math.floor(value / 3600)).padStart(2, '0')}:${String(Math.floor(value / 60) % 60).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}` }
function targetHint(label: string | undefined, fallback: string) {
  const source = label?.split(/[·:]/).pop() ?? fallback
  const match = source.match(/\d+\s*(?:a|–|-)\s*\d+|\d+/i)
  return match ? match[0].replace(/\s+/g, ' ') : fallback
}
function playRestCue(context: AudioContext, output: AudioNode, startAt: number) {
  try {
    const cue = context.createGain()
    cue.connect(output)
    for (const [index, frequency] of [660, 880, 1040].entries()) {
      const start = startAt + index * .2
      const oscillator = context.createOscillator()
      const volume = context.createGain()
      oscillator.type = 'triangle'
      oscillator.frequency.value = frequency
      volume.gain.setValueAtTime(.001, start)
      volume.gain.linearRampToValueAtTime(.36, start + .018)
      volume.gain.exponentialRampToValueAtTime(.001, start + .17)
      oscillator.connect(volume)
      volume.connect(cue)
      oscillator.start(start)
      oscillator.stop(start + .18)
    }
    return cue
  } catch { /* Audio is optional when the browser blocks playback. */ }
}
class RestAudio {
  private context: AudioContext | null = null
  private output: GainNode | null = null
  private scheduledDeadline = ''
  private scheduledCue: GainNode | null = null

  prepare(enabled: boolean) {
    if (typeof AudioContext === 'undefined') return
    try {
      if (!this.context || this.context.state === 'closed') {
        this.context = new AudioContext()
        this.output = this.context.createGain()
        this.output.connect(this.context.destination)
      }
      if (this.output) this.output.gain.value = enabled ? 1 : 0
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {})
    } catch { /* Audio is optional when the browser blocks playback. */ }
  }
  test() {
    if (this.context && this.output) playRestCue(this.context, this.output, this.context.currentTime + .03)
  }
  schedule(deadline: string) {
    if (this.context?.state !== 'running' || !this.output) return
    const remaining = (Date.parse(deadline) - Date.now()) / 1000
    if (remaining > 0) {
      this.cancel()
      this.scheduledCue = playRestCue(this.context, this.output, this.context.currentTime + remaining) ?? null
      this.scheduledDeadline = deadline
    }
  }
  playIfMissed(deadline: string) {
    if (this.scheduledDeadline !== deadline) this.test()
  }
  cancel() { this.scheduledCue?.disconnect(); this.scheduledCue = null; this.scheduledDeadline = '' }
  close() { this.cancel(); void this.context?.close() }
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
  const [vibrationEnabled, setVibrationEnabled] = useState(() => localStorage.getItem('personalfit-rest-vibration') !== 'off')
  const [restNotified, setRestNotified] = useState('')
  const [audio] = useState(() => new RestAudio())
  const [swapOpenId, setSwapOpenId] = useState('')
  const [deferred, setDeferred] = useState<{ sessionId: string; itemIds: string[] }>({ sessionId: '', itemIds: [] })
  const [view, setView] = useState<'TREINO' | 'ORIENTACOES'>('TREINO')
  const initializedVersionId = useRef('')

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
  useEffect(() => {
    const initial = window.setTimeout(() => setNow(Date.now()), 0)
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    const refresh = () => setNow(Date.now())
    document.addEventListener('visibilitychange', refresh)
    return () => { window.clearTimeout(initial); window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh) }
  }, [])
  useEffect(() => () => audio.close(), [audio])
  function testRestAlert() {
    if (soundEnabled) {
      audio.prepare(true)
      audio.test()
    }
    if (vibrationEnabled && typeof navigator.vibrate === 'function') navigator.vibrate([180, 100, 180, 100, 280])
  }

  useEffect(() => {
    if (!current) return
    if (initializedVersionId.current === current.id) return
    initializedVersionId.current = current.id
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
  const deferredIds = deferred.sessionId === active?.id ? deferred.itemIds : []
  const firstPendingItemId = active && ['IN_PROGRESS','PAUSED'].includes(active.status) && day && day.id === active.day_id
    ? (day.items.find(item => !deferredIds.includes(item.id) && active.entries.filter(entry => entry.itemId === item.id).length < item.sets)
      ?? day.items.find(item => active.entries.filter(entry => entry.itemId === item.id).length < item.sets))?.id : undefined
  const completed = (id: string) => localSessions.some(row => row.day_id === id && row.week_start === weekStart && row.status === 'COMPLETED')
    || remoteSessions.some(row => row.day_id === id && row.week_start === weekStart && row.status === 'COMPLETED')
  const partial = (id: string) => localSessions.some(row => row.day_id === id && row.week_start === weekStart && row.status === 'PARTIAL')
    || remoteSessions.some(row => row.day_id === id && row.week_start === weekStart && row.status === 'PARTIAL')
  const completedCount = displayed?.snapshot.days.filter(item => completed(item.id)).length ?? 0
  const partialCount = displayed?.snapshot.days.filter(item => partial(item.id)).length ?? 0
  const cycleStart = displayed?.snapshot.startsOn
  const calendarWeek = cycleStart ? shiftWeek(cycleStart, Math.max(0, Math.min(cycleWeek(cycleStart), (displayed?.snapshot.durationWeeks ?? 1) - 1))) : monday(new Date())
  const firstWeek = cycleStart ?? (displayed ? monday(new Date(displayed.published_at)) : calendarWeek)
  const prescribedLastWeek = cycleStart ? shiftWeek(cycleStart, (displayed?.snapshot.durationWeeks ?? 1) - 1) : undefined
  const allSessions = [...localSessions, ...historySessions]
  const activeTrainingWeek = displayed ? availableTrainingWeek({
    calendarWeek,
    firstWeek,
    lastWeek: prescribedLastWeek,
    dayIds: displayed.snapshot.days.map(item => item.id),
    sessions: allSessions,
  }) : calendarWeek
  const lastNavigableWeek = prescribedLastWeek ?? activeTrainingWeek
  const weekNumber = cycleStart ? Math.floor((new Date(`${weekStart}T12:00:00`).getTime() - new Date(`${cycleStart}T12:00:00`).getTime()) / 604800000) + 1 : null
  const isActiveWeek = weekStart === activeTrainingWeek
  const canStart = isActiveWeek && (!cycleStart || new Date(`${cycleStart}T00:00:00`) <= new Date())
  const done = active?.status === 'COMPLETED' || selectedRemote?.status === 'COMPLETED'
  const partiallyDone = active?.status === 'PARTIAL' || selectedRemote?.status === 'PARTIAL'
  const remoteOnly = !active && (selectedRemote?.status === 'IN_PROGRESS' || selectedRemote?.status === 'PAUSED')
  const elapsedSeconds = (active?.elapsed_seconds ?? 0) + (active?.status === 'IN_PROGRESS' && active.runningSince ? Math.max(0, Math.floor((now - Date.parse(active.runningSince)) / 1000)) : 0)
  const remainingRest = active?.status === 'IN_PROGRESS' && active.restEndsAt ? Math.max(0, Math.ceil((Date.parse(active.restEndsAt) - now) / 1000)) : 0
  const showRest = active?.status === 'IN_PROGRESS' && active.restEndsAt && (remainingRest > 0 || now - Date.parse(active.restEndsAt) < 12000)
  useEffect(() => {
    const deadline = active?.restEndsAt
    if (!deadline || active.status !== 'IN_PROGRESS' || Date.parse(deadline) > now || restNotified === deadline) return
    const timer = window.setTimeout(() => {
      setRestNotified(deadline)
      if (now - Date.parse(deadline) < 12000 && document.visibilityState === 'visible') {
        if (soundEnabled) audio.playIfMissed(deadline)
        if (vibrationEnabled && typeof navigator.vibrate === 'function') navigator.vibrate([180, 100, 180, 100, 280])
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [active, now, soundEnabled, vibrationEnabled, restNotified, audio])

  async function persist(entries: WorkoutEntry[], status: 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED' | 'PARTIAL', id: string,
    swaps?: Record<string, string>, restEndsAt?: string | null, issues?: Record<string, 'APARELHO_INDISPONIVEL'>): Promise<boolean> {
    if (!displayed || !day) return false
    setBusy(true); setError('')
    try {
      await saveLocalWorkoutSession(userId, tenantId, studentId, active?.version ?? displayed,
        id, entries, status, day.id, weekStart, swaps, restEndsAt, issues)
      if (status !== 'IN_PROGRESS') audio.cancel()
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
    const isCardio = item.recordingStyle === 'CARDIO'
    const target = Number(isCardio ? input?.durationMinutes : isTimed ? input?.durationSeconds : input?.reps)
    if (!Number.isInteger(target) || target < 1 || target > (isCardio ? 240 : isTimed ? 3600 : 999)) { setError(isCardio ? 'Informe os minutos realizados (1 a 240).' : isTimed ? 'Informe o tempo realizado em segundos.' : 'Informe as repetições realizadas.'); return }
    const isPreparation = preparation(item)
    const loadKg = isPreparation || isCardio || input?.loadKg === '' || input?.loadKg == null ? undefined : Number(input.loadKg)
    if (loadKg !== undefined && (!Number.isFinite(loadKg) || loadKg < 0 || loadKg > 9999 || !/^\d{1,4}(\.\d{1,2})?$/.test(input.loadKg))) { setError('Informe a carga em kg com até duas casas decimais ou deixe em branco.'); return }
    const rir = isPreparation || isCardio || input?.rir === '' || input?.rir == null ? undefined : Number(input.rir)
    if (rir !== undefined && (!Number.isInteger(rir) || rir < 0 || rir > 10)) { setError('Informe um RIR entre 0 e 10.'); return }
    const wasSaved = active.entries.some(entry => entry.itemId === itemId && entry.setNumber === setNumber)
    const entries: WorkoutEntry[] = [...active.entries.filter(entry => entry.itemId !== itemId || entry.setNumber !== setNumber),
      { itemId, setNumber, ...(isTimed ? { durationSeconds: isCardio ? target * 60 : target } : { reps: target }), ...(loadKg === undefined ? {} : { loadKg }), ...(rir === undefined ? {} : { rir }) }]
    const allSets = day?.items.reduce((sum, row) => sum + row.sets, 0) ?? 0
    const deadline = !wasSaved && item.restSeconds && entries.length < allSets ? new Date(Math.max(now, Date.parse(active.updatedAt)) + item.restSeconds * 1000).toISOString() : null
    if (deadline && soundEnabled) audio.prepare(true)
    if (!await persist(entries, 'IN_PROGRESS', active.id, undefined, wasSaved ? undefined : deadline)) return
    if (deadline && soundEnabled) audio.schedule(deadline)
    setRestNotified('')
    setEditingEntryKey('')
    if (!wasSaved && entries.filter(entry => entry.itemId === itemId).length === item.sets && day) {
      advanceAfterItem(itemId, entries)
    } else if (!wasSaved) {
      window.requestAnimationFrame(() => document.querySelector<HTMLInputElement>(`[data-entry-key="${itemId}:${setNumber + 1}"] input`)?.focus({ preventScroll: true }))
    }
  }
  function advanceAfterItem(itemId: string, entries: WorkoutEntry[]) {
    if (!active || !day) return
    setDeferred(previous => previous.sessionId === active.id ? { ...previous, itemIds: previous.itemIds.filter(id => id !== itemId) } : previous)
    const remaining = day.items.filter(row => entries.filter(entry => entry.itemId === row.id).length < row.sets)
    const index = day.items.findIndex(row => row.id === itemId)
    const next = day.items.slice(index + 1).find(row => remaining.includes(row) && !deferredIds.includes(row.id))
      ?? remaining.find(row => !deferredIds.includes(row.id)) ?? remaining[0]
    setExpandedExerciseId(next?.id ?? '')
    window.requestAnimationFrame(() => {
      const target = document.getElementById(next ? `exercise-${next.id}` : 'student-finish')
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      if (next) target?.querySelector('button')?.focus({ preventScroll: true })
    })
  }
  async function markPreparationDone(itemId: string) {
    if (!active || !day) return
    const item = day.items.find(row => row.id === itemId)
    if (!item || !preparation(item)) return
    const entries: WorkoutEntry[] = [...active.entries, ...Array.from({ length: item.sets }, (_, index) => index + 1)
      .filter(setNumber => !active.entries.some(entry => entry.itemId === itemId && entry.setNumber === setNumber))
      .map(setNumber => ({ itemId, setNumber, completed: true as const }))]
    if (await persist(entries, 'IN_PROGRESS', active.id, undefined, null)) advanceAfterItem(itemId, entries)
  }
  function deferExercise(itemId: string) {
    if (!active || !day) return
    const skipped = [...deferredIds.filter(id => id !== itemId), itemId]
    setDeferred({ sessionId: active.id, itemIds: skipped })
    const next = day.items.find(row => row.id !== itemId && !skipped.includes(row.id) && active.entries.filter(entry => entry.itemId === row.id).length < row.sets)
      ?? day.items.find(row => row.id !== itemId && active.entries.filter(entry => entry.itemId === row.id).length < row.sets)
    setExpandedExerciseId(next?.id ?? '')
    if (next) window.requestAnimationFrame(() => document.getElementById(`exercise-${next.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
  async function swapExercise(itemId: string, exerciseId: string) {
    if (!active || active.status !== 'IN_PROGRESS' || active.entries.some(entry => entry.itemId === itemId)) return
    const swaps = { ...active.exercise_swaps }
    if (exerciseId) swaps[itemId] = exerciseId; else delete swaps[itemId]
    const issues = { ...active.exercise_issues }
    if (exerciseId) delete issues[itemId]
    if (await persist(active.entries, 'IN_PROGRESS', active.id, swaps, undefined, issues)) setSwapOpenId('')
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
  const publishedGuides = displayed ? workoutGuideSections.filter(section => Boolean(displayed.snapshot.guides?.[section.key]?.trim())) : []
  const hasGuides = Boolean(displayed?.snapshot.guidance?.trim() || publishedGuides.length)
  return <section className={`workout-player${active?.status === 'IN_PROGRESS' || active?.status === 'PAUSED' ? ' has-session-dock' : ''}${showRest ? ' has-rest-clock' : ''}`}><h3>Seu treino</h3>{error && <p role="alert" className="feedback error">{error}</p>}
    {!displayed ? <p>{navigator.onLine ? 'Seu personal ainda não publicou um treino.' : 'Abra seu treino uma vez com internet para consultá-lo neste aparelho.'}</p> : <>
      <div className="student-workout-heading"><div><strong>{displayed.snapshot.title}</strong><small>Versão {displayed.version_number} · {displayed.snapshot.days.length} dias</small></div></div>
      {hasGuides && <nav className="student-workout-sections" aria-label="Seções do treino"><button type="button" aria-current={view === 'TREINO' ? 'page' : undefined} onClick={() => setView('TREINO')}>Treino</button><button type="button" aria-current={view === 'ORIENTACOES' ? 'page' : undefined} onClick={() => setView('ORIENTACOES')}>Orientações</button></nav>}
      {view === 'ORIENTACOES' && hasGuides ? <div className="student-guide-panel"><p>Conteúdos publicados pelo seu personal para este treino.</p>{active?.status === 'IN_PROGRESS' && <p className="field-hint">O tempo do treino continua contando enquanto você consulta as orientações.</p>}
        {displayed.snapshot.guidance?.trim() && <details><summary>Orientações gerais</summary><p className="workout-guidance">{displayed.snapshot.guidance}</p></details>}
        {publishedGuides.map(section => <details key={section.key}><summary>{section.title}</summary><p className="workout-guidance">{displayed.snapshot.guides?.[section.key]}</p></details>)}
      </div> : <>
      {active && (active.status === 'COMPLETED' || active.status === 'PARTIAL') && <div className="student-session-clock" role="timer"><span>Tempo total do treino</span><strong>{clock(elapsedSeconds)}</strong></div>}
      {previousInProgress && !selectedPrevious && <div className="feedback"><p>Há um treino iniciado em uma versão anterior.</p><button type="button" className="secondary-button" onClick={() => { setWeekStart(previousInProgress.week_start!); setDayId(previousInProgress.day_id!); setEdits({}) }}>Continuar treino iniciado</button></div>}
      {displayed.snapshot.importantNote && <div className="student-important-note"><strong>Antes de começar</strong><p>{displayed.snapshot.importantNote}</p></div>}
      <div className="student-week-nav" aria-label="Semana do treino">
        <button type="button" className="secondary-button" disabled={weekStart <= firstWeek} onClick={() => setWeekStart(shiftWeek(weekStart, -1))} aria-label="Semana anterior">‹</button>
        <div><strong>{weekNumber ? `Semana ${weekNumber} de ${displayed.snapshot.durationWeeks}` : isActiveWeek ? 'Semana atual do treino' : 'Semana anterior do treino'}</strong><small>{weekLabel(weekStart)} · {completedCount} completos{partialCount ? ` · ${partialCount} parciais` : ''}</small></div>
        <button type="button" className="secondary-button" disabled={weekStart >= lastNavigableWeek} onClick={() => setWeekStart(shiftWeek(weekStart, 1))} aria-label="Próxima semana">›</button>
      </div>
      <nav className="student-day-tabs" aria-label="Dias do treino">{displayed.snapshot.days.map((item, index) => <button key={item.id} type="button"
        className={`${item.id === effectiveDayId ? 'is-active ' : ''}${completed(item.id) ? 'is-complete' : partial(item.id) ? 'is-partial' : ''}`} aria-current={item.id === effectiveDayId ? 'page' : undefined} onClick={() => { setDayId(item.id); setEdits({}); setExpandedExerciseId(null) }}>
        <span>Dia {index + 1}</span><strong>{item.name}</strong><small>{completed(item.id) ? '✓ Concluído' : partial(item.id) ? 'Encerrado incompleto' : localSessions.some(row => row.day_id === item.id && row.week_start === weekStart && row.status === 'PAUSED') || remoteSessions.some(row => row.day_id === item.id && row.week_start === weekStart && row.status === 'PAUSED') ? 'Pausado · continue quando puder' : localSessions.some(row => row.day_id === item.id && row.week_start === weekStart && row.status === 'IN_PROGRESS') || remoteSessions.some(row => row.day_id === item.id && row.week_start === weekStart && row.status === 'IN_PROGRESS') ? 'Em andamento' : isActiveWeek && item.id === nextDayId ? `Próximo · ${item.items.length} ${item.items.length === 1 ? 'exercício' : 'exercícios'}` : `${item.items.length} ${item.items.length === 1 ? 'exercício' : 'exercícios'}`}</small>
      </button>)}</nav>
      {day && <div className="student-day-panel"><div className="student-day-title"><div><span className="eyebrow">DIA {displayed.snapshot.days.indexOf(day) + 1}</span><h4>{day.name}</h4><p>{day.items.length} {day.items.length === 1 ? 'exercício' : 'exercícios'} · {done ? 'Concluído' : partiallyDone ? 'Encerrado incompleto' : active?.status === 'PAUSED' ? 'Pausado' : active?.status === 'IN_PROGRESS' ? 'Em andamento' : 'Pronto para começar'}</p></div></div>
        {(active || selectedRemote) && <div className="student-day-progress"><strong>{day.items.filter(item => (active?.entries ?? selectedRemote?.entries ?? []).filter(entry => entry.itemId === item.id).length === item.sets).length} de {day.items.length} exercícios registrados</strong><progress max={day.items.length} value={day.items.filter(item => (active?.entries ?? selectedRemote?.entries ?? []).filter(entry => entry.itemId === item.id).length === item.sets).length} /></div>}
        {(attention > 0 || pending > 0 || active || selectedRemote) && <p role="status" className={attention ? 'feedback error' : 'feedback'}>{attention ? `${attention} lançamento(s) precisam de atenção. Seus dados continuam neste aparelho.` : pending ? `${pending} lançamento(s) salvos neste aparelho, aguardando confirmação.` : 'Lançamentos confirmados no servidor.'}</p>}
        {remoteOnly && <p className="feedback">Há um treino salvo no servidor para este dia. Tentando recuperá-lo neste aparelho. Se continuar bloqueado, conecte-se à internet e reabra a página.</p>}
        {!active && !selectedRemote && canStart && !openSession && <button type="button" disabled={busy} onClick={() => { setDayId(day.id); void persist([], 'IN_PROGRESS', crypto.randomUUID()) }}>Começar treino do dia {displayed.snapshot.days.indexOf(day) + 1}</button>}
        {!active && !selectedRemote && openSession && <p className="feedback">Você já tem um treino {openSession.status === 'PAUSED' ? 'pausado' : 'em andamento'} nesta semana. Abra esse dia para continuar.</p>}
        {active?.status === 'PAUSED' && <button type="button" disabled={busy} onClick={() => void persist(active.entries, 'IN_PROGRESS', active.id)}>Continuar treino do dia {displayed.snapshot.days.indexOf(day) + 1}</button>}
        {active?.status === 'IN_PROGRESS' && <button type="button" className="secondary-button student-pause-button" disabled={busy} onClick={() => void persist(active.entries, 'PAUSED', active.id, undefined, null)}>Pausar e continuar depois</button>}
      {day.items.map((item, index) => { const isPreparation = preparation(item); const isCardio = item.recordingStyle === 'CARDIO'; const expanded = expandedExerciseId === item.id || (expandedExerciseId === null && firstPendingItemId === item.id)
          const swapId = active?.exercise_swaps?.[item.id] ?? selectedRemote?.exercise_swaps?.[item.id]
          const actual = item.alternatives?.find(option => option.exerciseId === swapId)
          const videoExerciseId = actual?.exerciseId ?? item.exerciseId
          const videoUrl = liveVideos?.versionId === displayed.id && Object.prototype.hasOwnProperty.call(liveVideos.urls, videoExerciseId)
            ? liveVideos.urls[videoExerciseId] : actual?.videoUrl ?? item.videoUrl
          const thumbnailUrl = videoUrl ? youtubeThumbnailUrl(videoUrl) : null
          const savedEntries = (active?.entries ?? selectedRemote?.entries ?? []).filter(entry => entry.itemId === item.id)
          const nextSetNumber = Array.from({ length: item.sets }, (_, number) => number + 1).find(number => !savedEntries.some(entry => entry.setNumber === number))
          const editedNumber = Number(editingEntryKey.startsWith(`${item.id}:`) ? editingEntryKey.split(':')[1] : 0)
          const visibleSetNumber = editedNumber || nextSetNumber
          return <article key={item.id} id={`exercise-${item.id}`} className={`student-exercise-card${isPreparation ? ' is-preparation' : ''}${savedEntries.length === item.sets && (active || selectedRemote) ? ' is-complete' : ''}${deferredIds.includes(item.id) && savedEntries.length < item.sets ? ' is-deferred' : ''}`}>
          <button type="button" className="student-exercise-toggle" aria-expanded={expanded} aria-controls={`exercise-content-${item.id}`} onClick={() => { setExpandedExerciseId(expanded ? '' : item.id); setEditingEntryKey('') }}><span className="student-exercise-number">{savedEntries.length === item.sets && (active || selectedRemote) ? '✓' : index + 1}</span><span><strong>{actual?.name ?? item.name}</strong><small>{savedEntries.length === item.sets && (active || selectedRemote) ? 'Concluído · ' : deferredIds.includes(item.id) ? 'Para fazer depois · ' : ''}{isCardio ? `Cardio · meta ${item.cardioMinutes ?? '?'} min` : isPreparation ? `Marcar como feito · ${item.reps}` : `${item.sets} ${isPreparation ? item.sets === 1 ? 'etapa' : 'etapas' : item.sets === 1 ? 'série' : 'séries'} · ${item.reps}`}</small></span><span aria-hidden="true">{expanded ? '⌃' : '⌄'}</span></button>
          {expanded && <div id={`exercise-content-${item.id}`} className="student-exercise-body">{actual && <p className="student-swap-note">Exercício principal: {item.name}. Esta troca vale somente para este treino.</p>}{(actual?.instructions ?? item.instructions) && <p>{actual?.instructions ?? item.instructions}</p>}{item.notes && <p className="workout-item-note">{item.notes}</p>}
            {isCardio && !!item.cardioSteps?.length && <details className="student-cardio-program"><summary>Ver programação do cardio</summary><ol>{item.cardioSteps.map((step, stepIndex) => <li key={stepIndex}><span>{step.startMinute}–{step.endMinute} min</span><span>{step.inclinePercent}% de inclinação</span><span>{step.speedKmh.toLocaleString('pt-BR')} km/h</span></li>)}</ol></details>}
            {videoUrl && <div className="student-exercise-media">{thumbnailUrl && <img src={thumbnailUrl} alt={`Prévia do exercício ${actual?.name ?? item.name}`} loading="lazy" referrerPolicy="no-referrer" />}<InstructionVideo videoUrl={videoUrl} /></div>}
            {active?.status === 'IN_PROGRESS' && !isPreparation && savedEntries.length === 0 && !!item.alternatives?.length && <div className="student-swap"><button type="button" className="secondary-button" onClick={() => setSwapOpenId(value => value === item.id ? '' : item.id)}>{actual ? 'Alterar exercício escolhido' : 'Trocar exercício neste dia'}</button>{swapOpenId === item.id && <label>Alternativa aprovada pelo personal<select value={swapId ?? ''} onChange={event => void swapExercise(item.id, event.target.value)}><option value="">Manter {item.name}</option>{item.alternatives.map(option => <option key={option.exerciseId} value={option.exerciseId}>{option.name}</option>)}</select></label>}</div>}
            {active?.status === 'IN_PROGRESS' && !isPreparation && !isCardio && savedEntries.length === 0 && !item.alternatives?.length && <p className="student-swap-empty">Este exercício ainda não tem opções de troca definidas pelo seu personal. Se precisar trocar, combine uma alternativa com ele antes de registrar as séries.</p>}
            {active?.status === 'IN_PROGRESS' && savedEntries.length < item.sets && day.items.some(row => row.id !== item.id && active.entries.filter(entry => entry.itemId === row.id).length < row.sets) && <button type="button" className="secondary-button student-defer-button" onClick={() => deferExercise(item.id)}>Fazer este exercício depois</button>}
            {active?.status === 'IN_PROGRESS' && day.id === active.day_id && isPreparation && savedEntries.length < item.sets && <button type="button" disabled={busy} onClick={() => void markPreparationDone(item.id)}>Marcar como feito</button>}
            {active?.status === 'IN_PROGRESS' && day.id === active.day_id && !isPreparation && <div className="student-entry-progress"><span>{savedEntries.length === item.sets ? 'Exercício registrado' : `${savedEntries.length} de ${item.sets} séries registradas`}</span><progress max={item.sets} value={savedEntries.length} aria-label={`Progresso de ${item.name}`} /></div>}
            {active?.status === 'IN_PROGRESS' && day.id === active.day_id && !isPreparation && visibleSetNumber && (() => {
              const setNumber = visibleSetNumber; const setIndex = setNumber - 1; const key = `${item.id}:${setNumber}`
              const value = values[key] ?? { reps: '', durationSeconds: '', durationMinutes: '', loadKg: '', rir: '' }
              const saved = active.entries.some(entry => entry.itemId === item.id && entry.setNumber === setNumber)
              const isTimed = timed(item, setIndex)
               const previous = lastSet(item.id, setNumber)
               const recentLoad = active.entries.filter(entry => entry.itemId === item.id && entry.loadKg != null && entry.setNumber < setNumber)
                 .sort((a, b) => b.setNumber - a.setNumber)[0]?.loadKg ?? previous?.entry.loadKg
               return <div className={`workout-set${isPreparation ? ' workout-preparation' : ''}`} data-entry-key={key}><div className="student-entry-heading"><span className="eyebrow">{isCardio ? 'CARDIO' : isPreparation ? 'PREPARAÇÃO' : 'REGISTRO DO EXERCÍCIO'}</span><strong>{isCardio ? `Meta: ${item.cardioMinutes} min` : item.setLabels?.[setIndex] || `${isPreparation ? 'Etapa' : 'Série'} ${setNumber}`}{!isCardio && <small> · {setNumber} de {item.sets}</small>}</strong>{!isCardio && item.restSeconds != null && <small>Descanso previsto: {item.restSeconds} s</small>}{!isPreparation && !isCardio && previous && <small>Última vez: {previous.entry.loadKg} kg · {previous.entry.reps ?? `${previous.entry.durationSeconds} s`} · {new Date(previous.at).toLocaleDateString('pt-BR')}</small>}</div>
               {isCardio ? <label>Minutos realizados <span className="field-hint">Meta do personal: {item.cardioMinutes} min</span><input type="number" min="1" max="240" inputMode="numeric" placeholder={String(item.cardioMinutes ?? '')} value={value.durationMinutes} onChange={event => setEdits(previous => ({ ...previous, [key]: { ...value, durationMinutes: event.target.value } }))} /></label> : isTimed ? <label>Tempo feito <span className="field-hint">segundos · alvo: {targetHint(item.setLabels?.[setIndex], item.reps)}</span><input type="number" min="1" max="3600" inputMode="numeric" placeholder={targetHint(item.setLabels?.[setIndex], item.reps)} value={value.durationSeconds} onChange={event => setEdits(previous => ({ ...previous, [key]: { ...value, durationSeconds: event.target.value } }))} /></label> : <label>Repetições feitas <span className="field-hint">alvo: {targetHint(item.setLabels?.[setIndex], item.reps)}</span><input type="number" min="1" max="999" inputMode="numeric" placeholder={targetHint(item.setLabels?.[setIndex], item.reps)} value={value.reps} onChange={event => setEdits(previous => ({ ...previous, [key]: { ...value, reps: event.target.value } }))} /></label>}
                 {!isPreparation && !isCardio && <label>Carga <span className="field-hint">kg · opcional{item.loadHintKg != null ? ` · referência do personal: ${item.loadHintKg} kg` : ''}</span><input type="number" min="0" max="9999" step="0.01" inputMode="decimal" placeholder={item.loadHintKg != null ? `${item.loadHintKg} kg` : recentLoad == null ? 'Sem carga anterior' : `Última: ${recentLoad} kg`} value={value.loadKg} onChange={event => setEdits(previous => ({ ...previous, [key]: { ...value, loadKg: event.target.value } }))} /></label>}
                 {!isPreparation && !isCardio && recentLoad != null && <button type="button" className="secondary-button reuse-load-button" onClick={() => setEdits(previous => ({ ...previous, [key]: { ...value, loadKg: String(recentLoad) } }))}>Usar última carga: {recentLoad} kg</button>}
                 {!isPreparation && !isCardio && <label>Repetições que sobrariam <span className="field-hint">opcional{item.rirHint ? ` · alvo: ${item.rirHint}` : ''}</span><input type="number" min="0" max="10" step="1" inputMode="numeric" placeholder={item.rirHint || (previous?.entry.rir == null ? 'Ex.: 2' : `Última: ${previous.entry.rir}`)} value={value.rir} onChange={event => setEdits(previous => ({ ...previous, [key]: { ...value, rir: event.target.value } }))} /></label>}
                <button type="button" disabled={busy || (isCardio ? value.durationMinutes === '' : isTimed ? value.durationSeconds === '' : value.reps === '')} onClick={() => void record(item.id, setNumber)}>{saved ? 'Salvar correção' : isCardio ? 'Registrar cardio' : setNumber === item.sets ? 'Salvar e continuar' : isPreparation ? 'Registrar etapa' : 'Registrar série'}</button>{saved && <button type="button" className="text-button" onClick={() => setEditingEntryKey('')}>Voltar ao treino</button>}</div>
            })()}
            {active?.status === 'IN_PROGRESS' && savedEntries.length > 0 && !isPreparation && <div className="student-saved-sets"><span>Registros feitos</span>{savedEntries.slice().sort((a, b) => a.setNumber - b.setNumber).map(entry => <button type="button" key={entry.setNumber} className="secondary-button" onClick={() => setEditingEntryKey(`${item.id}:${entry.setNumber}`)}>{isCardio ? 'Cardio' : 'Série'} {isCardio ? '' : entry.setNumber} · {isCardio ? `${(entry.durationSeconds ?? 0) / 60} min` : entry.durationSeconds != null ? `${entry.durationSeconds} s` : `${entry.reps} rep.`} <span>Editar</span></button>)}</div>}
            {(done || partiallyDone) && savedEntries.length > 0 && <div className="student-session-results"><strong>Como você registrou</strong>{savedEntries.slice().sort((a, b) => a.setNumber - b.setNumber).map(entry => <div className="student-session-result-row" key={entry.setNumber}><span>{isCardio ? 'Cardio' : isPreparation ? item.setLabels?.[entry.setNumber - 1] || `Etapa ${entry.setNumber}` : item.setLabels?.[entry.setNumber - 1] || `Série ${entry.setNumber}`}</span><small>{entry.completed ? 'Feito' : isCardio ? `${(entry.durationSeconds ?? 0) / 60} min` : entry.durationSeconds != null ? `${entry.durationSeconds} s` : `${entry.reps ?? 0} rep.`}{entry.loadKg != null ? ` · ${entry.loadKg} kg` : ''}{entry.rir != null ? ` · sobrariam ${entry.rir}` : ''}</small></div>)}</div>}</div>}
        </article> })}
        {active?.status === 'IN_PROGRESS' && <div id="student-finish" className="student-finish"><p>{active.entries.length} de {day.items.reduce((sum, item) => sum + item.sets, 0)} registros feitos.</p>{active.entries.length === day.items.reduce((sum, item) => sum + item.sets, 0) ? <button type="button" disabled={busy} onClick={() => void persist(active.entries, 'COMPLETED', active.id, undefined, null)}>Concluir treino do dia</button> : <button type="button" className="secondary-button" disabled={busy} onClick={() => setConfirmPartial(true)}>Encerrar treino incompleto</button>}{confirmPartial && <div className="confirm-box"><p>Isso encerra definitivamente este treino como incompleto. Para continuar depois, escolha “Pausar e continuar depois” acima. Seus registros serão preservados.</p><button type="button" disabled={busy} onClick={() => { setConfirmPartial(false); void persist(active.entries, 'PARTIAL', active.id, undefined, null) }}>Encerrar incompleto</button><button type="button" className="secondary-button" onClick={() => setConfirmPartial(false)}>Voltar ao treino</button></div>}</div>}
        {(done || partiallyDone) && <div className="student-finish-summary" role="status"><strong>{done ? 'Treino concluído' : 'Treino encerrado incompleto'}</strong><span>{day.items.filter(item => (active?.entries ?? selectedRemote?.entries ?? []).filter(entry => entry.itemId === item.id).length === item.sets).length} de {day.items.length} exercícios · {clock(active?.elapsed_seconds ?? selectedRemote?.elapsed_seconds ?? 0)}</span><small>{pending ? 'Salvo neste aparelho; aguardando sincronização.' : 'Registros confirmados no servidor.'}</small></div>}
        {!canStart && !active && !selectedRemote && <p className="feedback">Este período está disponível para consulta. Registre os treinos na semana atual do ciclo.</p>}
      </div>}
      {active && (active.status === 'IN_PROGRESS' || active.status === 'PAUSED') && <div className="student-session-dock"><div className="student-dock-elapsed" role="timer" aria-label={`Tempo total do treino: ${clock(elapsedSeconds)}`}><span>{active.status === 'PAUSED' ? 'Treino pausado' : 'Tempo do treino'}</span><strong>{clock(elapsedSeconds)}</strong></div>{showRest && <div className={`student-rest-clock${remainingRest === 0 ? ' is-ready' : ''}`} role="timer" aria-label={remainingRest ? `Descanso: ${remainingRest} segundos restantes` : 'Descanso terminado'}><span>{remainingRest ? 'Descanso · faltam' : 'Descanso terminado'}</span><strong>{remainingRest ? `${remainingRest}s` : 'Bora!'}</strong><div className="student-rest-controls"><button type="button" onClick={() => { const enabled = !soundEnabled; setSoundEnabled(enabled); localStorage.setItem('personalfit-rest-sound', enabled ? 'on' : 'off'); audio.prepare(enabled) }} aria-label={soundEnabled ? 'Desligar som do descanso' : 'Ligar som do descanso'}>{soundEnabled ? 'Som ligado' : 'Som desligado'}</button>{typeof navigator.vibrate === 'function' && <button type="button" onClick={() => { const enabled = !vibrationEnabled; setVibrationEnabled(enabled); localStorage.setItem('personalfit-rest-vibration', enabled ? 'on' : 'off') }} aria-label={vibrationEnabled ? 'Desligar vibração do descanso' : 'Ligar vibração do descanso'}>{vibrationEnabled ? 'Vibração ligada' : 'Vibração desligada'}</button>}<button type="button" onClick={testRestAlert} disabled={!soundEnabled && (!vibrationEnabled || typeof navigator.vibrate !== 'function')}>Testar alerta</button></div></div>}</div>}
      </>}
    </>}
  </section>
}
