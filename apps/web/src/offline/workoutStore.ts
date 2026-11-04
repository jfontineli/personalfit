import { openDB, type DBSchema } from 'idb'
import type { Membership, Tenant } from '../services/business'
import type { Brand, Student } from '../services/business'
import type { WorkoutEntry, WorkoutSession, WorkoutVersion } from '../services/workouts'

const DB_NAME = 'personalfit-workouts-v1'
type LocalSession = Pick<WorkoutSession, 'id' | 'version_id' | 'revision' | 'entries' | 'status' | 'client_started_at' | 'client_finished_at' | 'elapsed_seconds' | 'exercise_swaps' | 'exercise_issues'> & {
  day_id?: string | null; week_start?: string | null;
  ownerUserId: string; tenantId: string; studentId: string; version: WorkoutVersion; updatedAt: string; runningSince?: string | null; restEndsAt?: string | null
}
type PendingOperation = { id: string; ownerUserId: string; tenantId: string; session: LocalSession; state: 'PENDING' | 'NEEDS_ATTENTION'; error: string | null; createdAt: string }
type CachedWorkout = { key: string; ownerUserId: string; tenantId: string; studentId: string; version: WorkoutVersion }
type CachedContext = { userId: string; email: string; memberships: Membership[]; tenants: Tenant[] }
type CachedStudentView = { key: string; student: Student; brand: Brand | null }
interface WorkoutSchema extends DBSchema {
  sessions: { key: string; value: LocalSession }
  operations: { key: string; value: PendingOperation }
  workouts: { key: string; value: CachedWorkout }
  context: { key: string; value: CachedContext }
  studentViews: { key: string; value: CachedStudentView }
}
let database: ReturnType<typeof openDB<WorkoutSchema>> | undefined
function db() {
  database ??= openDB<WorkoutSchema>(DB_NAME, 1, { upgrade(store) {
    store.createObjectStore('sessions', { keyPath: 'id' })
    store.createObjectStore('operations', { keyPath: 'id' })
    store.createObjectStore('workouts', { keyPath: 'key' })
    store.createObjectStore('context', { keyPath: 'userId' })
    store.createObjectStore('studentViews', { keyPath: 'key' })
  } }).catch(error => { database = undefined; throw error })
  return database
}
export async function cacheIdentityContext(value: CachedContext) { await (await db()).put('context', value) }
export async function getCachedContext(userId: string) { return (await db()).get('context', userId) }
export async function clearCachedContext(userId: string) { await (await db()).delete('context', userId) }
export async function cacheStudentView(userId: string, tenantId: string, student: Student, brand: Brand | null) {
  await (await db()).put('studentViews', { key: `${userId}:${tenantId}`, student, brand })
}
export async function getCachedStudentView(userId: string, tenantId: string) {
  return (await db()).get('studentViews', `${userId}:${tenantId}`)
}
export async function cacheWorkout(ownerUserId: string, tenantId: string, studentId: string, version: WorkoutVersion) {
  await (await db()).put('workouts', { key: `${ownerUserId}:${tenantId}:${studentId}`, ownerUserId, tenantId, studentId, version })
}
export async function getCachedWorkout(ownerUserId: string, tenantId: string, studentId: string) {
  return (await db()).get('workouts', `${ownerUserId}:${tenantId}:${studentId}`)
}
export async function getLocalSession(ownerUserId: string, tenantId: string, studentId: string, dayId?: string, weekStart?: string) {
  const rows = await (await db()).getAll('sessions')
  return rows.filter(row => row.ownerUserId === ownerUserId && row.tenantId === tenantId && row.studentId === studentId
    && (dayId === undefined || row.day_id === dayId) && (weekStart === undefined || row.week_start === weekStart))
    .sort((a,b) => b.updatedAt.localeCompare(a.updatedAt))[0]
}
export async function listLocalSessions(ownerUserId: string, tenantId: string, studentId: string) {
  const rows = await (await db()).getAll('sessions')
  return rows.filter(row => row.ownerUserId === ownerUserId && row.tenantId === tenantId && row.studentId === studentId)
}
export async function saveLocalWorkoutSession(ownerUserId: string, tenantId: string, studentId: string,
  version: WorkoutVersion, sessionId: string, entries: WorkoutEntry[], status: LocalSession['status'], dayId?: string, weekStart?: string,
  swaps?: Record<string, string>, restEndsAt?: string | null, issues?: Record<string, 'APARELHO_INDISPONIVEL'>) {
  const store = await db()
  const tx = store.transaction(['sessions','operations'], 'readwrite')
  const previous = await tx.objectStore('sessions').get(sessionId)
  if (previous && (previous.ownerUserId !== ownerUserId || previous.tenantId !== tenantId || previous.studentId !== studentId || previous.version_id !== version.id || !['IN_PROGRESS','PAUSED'].includes(previous.status)
    || previous.day_id !== dayId || previous.week_start !== weekStart))
    throw new Error('Esta sessão não pode ser alterada.')
  if (dayId && (!weekStart || !version.snapshot.days.some(day => day.id === dayId && entries.every(entry => day.items.some(item => item.id === entry.itemId)))))
    throw new Error('Os lançamentos precisam pertencer ao dia selecionado.')
  const now = new Date().toISOString()
  const runningSince = previous?.runningSince ?? (previous?.status === 'IN_PROGRESS' ? previous.updatedAt : null)
  const elapsed = (previous?.elapsed_seconds ?? 0) + (previous?.status === 'IN_PROGRESS' && runningSince ? Math.max(0, Math.floor((Date.now() - Date.parse(runningSince)) / 1000)) : 0)
  const session: LocalSession = { id: sessionId, ownerUserId, tenantId, studentId, version_id: version.id, version: previous?.version ?? version,
    day_id: dayId, week_start: weekStart, revision: (previous?.revision ?? 0) + 1, entries, status, updatedAt: now,
    client_started_at: previous?.client_started_at ?? now, client_finished_at: status === 'COMPLETED' || status === 'PARTIAL' ? now : null,
    elapsed_seconds: elapsed, runningSince: status === 'IN_PROGRESS' ? now : null,
    exercise_swaps: swaps ?? previous?.exercise_swaps ?? {}, exercise_issues: issues ?? previous?.exercise_issues ?? {},
    restEndsAt: restEndsAt === undefined ? previous?.restEndsAt ?? null : restEndsAt }
  const operation: PendingOperation = { id: crypto.randomUUID(), ownerUserId, tenantId, session, state: 'PENDING', error: null, createdAt: new Date().toISOString() }
  await tx.objectStore('sessions').put(session)
  await tx.objectStore('operations').put(operation)
  await tx.done
  return session
}
export async function adoptRemoteWorkoutSession(ownerUserId: string, tenantId: string, studentId: string, version: WorkoutVersion, remote: WorkoutSession) {
  if (remote.tenant_id !== tenantId || remote.student_id !== studentId || remote.version_id !== version.id || !remote.day_id || !remote.week_start) throw new Error('Sessão remota inválida.')
  const store = await db()
  const tx = store.transaction(['sessions','operations'], 'readwrite')
  const existing = await tx.objectStore('sessions').get(remote.id)
  const pending = await tx.objectStore('operations').getAll()
  if (pending.some(item => item.session.id === remote.id)) { await tx.done; return false }
  if (existing && existing.revision >= remote.revision) { await tx.done; return false }
  if (existing && (existing.ownerUserId !== ownerUserId || existing.tenantId !== tenantId || existing.studentId !== studentId)) throw new Error('Sessão pertence a outra conta.')
  await tx.objectStore('sessions').put({ id: remote.id, ownerUserId, tenantId, studentId, version_id: version.id, version,
    day_id: remote.day_id, week_start: remote.week_start, revision: remote.revision, entries: remote.entries, status: remote.status,
    updatedAt: remote.updated_at ?? new Date().toISOString(), client_started_at: remote.client_started_at ?? remote.started_at,
    client_finished_at: remote.client_finished_at ?? null, elapsed_seconds: remote.elapsed_seconds ?? 0,
    exercise_swaps: remote.exercise_swaps ?? {}, exercise_issues: remote.exercise_issues ?? {},
    runningSince: remote.status === 'IN_PROGRESS' ? remote.updated_at ?? new Date().toISOString() : null,
    restEndsAt: null })
  await tx.done
  return true
}
export async function pendingWorkoutOperations(ownerUserId: string, tenantId: string) {
  const rows = await (await db()).getAll('operations')
  return rows.filter(row => row.ownerUserId === ownerUserId && row.tenantId === tenantId)
    .sort((a,b) => a.session.id.localeCompare(b.session.id) || a.session.revision - b.session.revision)
}
export async function confirmWorkoutOperation(id: string) { await (await db()).delete('operations', id) }
export async function flagWorkoutOperation(id: string, message: string) {
  const store = await db()
  const row = await store.get('operations', id)
  if (row) await store.put('operations', { ...row, state: 'NEEDS_ATTENTION', error: message })
}
// Test-only. Product flows must retain pending operations across app restarts.
export async function resetWorkoutStoreForTests() {
  const store = await db()
  const tx = store.transaction(['sessions','operations','workouts','context','studentViews'], 'readwrite')
  await Promise.all((['sessions','operations','workouts','context','studentViews'] as const).map(name => tx.objectStore(name).clear()))
  await tx.done
}
