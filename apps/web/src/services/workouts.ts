import { supabase } from './supabase'

export type MuscleGroup = 'MOBILIDADE' | 'PEITO' | 'COSTAS' | 'OMBROS' | 'BRACOS' | 'PERNAS' | 'POSTERIOR_GLUTEOS' | 'PANTURRILHAS' | 'CORE' | 'CARDIO' | 'OUTROS'
export type WorkoutGuideKey = 'COMO_USAR' | 'EXECUCAO' | 'HIPOPRESSIVO' | 'ACOMPANHAMENTO' | 'GLOSSARIO' | 'ACESSORIOS' | 'INDICACOES' | 'CONTATO'
export type CardioStep = { startMinute: number; endMinute: number; inclinePercent: number; speedKmh: number }
export type Exercise = { id: string; tenant_id: string; name: string; instructions: string; video_url: string | null; muscle_group: MuscleGroup }
export type DraftItem = { id: string; exerciseId: string; alternativeExerciseIds?: string[]; sets: number; reps: string; loadHintKg?: number; rirHint?: string; cardioMinutes?: number; cardioSteps?: CardioStep[]; targetKind?: 'REPS' | 'TIME'; recordingStyle?: 'SERIES' | 'PREPARATION' | 'CARDIO'; notes?: string; restSeconds?: number; setLabels?: string[] }
export type DraftDay = { id: string; name: string; items: DraftItem[] }
export type WorkoutDraft = { guidance?: string; guides?: Partial<Record<WorkoutGuideKey, string>>; importantNote?: string; startsOn?: string; durationWeeks?: number; reviewRequired?: boolean; days: DraftDay[] }
export type WorkoutPlan = { id: string; tenant_id: string; student_id: string; title: string; draft: WorkoutDraft }
export type PublishedAlternative = { exerciseId: string; name: string; instructions: string; videoUrl: string | null }
export type PublishedItem = DraftItem & { name: string; instructions: string; videoUrl: string | null; alternatives?: PublishedAlternative[] }
export type PublishedDay = { id: string; name: string; items: PublishedItem[] }
export type WorkoutVersion = { id: string; tenant_id: string; plan_id: string; version_number: number; snapshot: { title: string; guidance?: string; guides?: Partial<Record<WorkoutGuideKey, string>>; importantNote?: string; startsOn?: string; durationWeeks?: number; days: PublishedDay[] }; published_at: string }
export type WorkoutAssignment = { id: string; tenant_id: string; student_id: string; version_id: string; assigned_at: string }
export type WorkoutEntry = { itemId: string; setNumber: number; reps?: number; durationSeconds?: number; loadKg?: number; rir?: number; completed?: true }
export type WorkoutSession = { id: string; tenant_id: string; student_id: string; version_id: string; day_id: string | null; week_start: string | null; revision: number; entries: WorkoutEntry[]; status: 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED' | 'PARTIAL'; started_at: string; updated_at?: string; client_started_at?: string | null; client_finished_at?: string | null; elapsed_seconds?: number; exercise_swaps?: Record<string, string>; exercise_issues?: Record<string, 'APARELHO_INDISPONIVEL'> }
export type StudentServicePlan = { tenant_id: string; student_id: string; name: string; starts_on: string; ends_on: string | null; active: boolean }

function client() {
  if (!supabase) throw new Error('Supabase não configurado')
  return supabase
}
function result<T>(data: T, error: { message: string } | null): T {
  if (error) throw new Error(error.message)
  return data
}

export function normalizeYoutubeUrl(input: string): string {
  let url: URL
  try { url = new URL(input.trim()) } catch { throw new Error('Cole um link válido do YouTube.') }
  if (url.protocol !== 'https:') throw new Error('O link do YouTube deve começar com https://.')
  const host = url.hostname.toLowerCase()
  let videoId = ''
  if (host === 'youtu.be' || host === 'www.youtu.be') videoId = url.pathname.slice(1)
  else if (host === 'youtube.com' || host === 'www.youtube.com' || host === 'm.youtube.com') {
    if (url.pathname === '/watch') videoId = url.searchParams.get('v') ?? ''
    else if (/^\/(shorts|embed)\/[^/]+$/.test(url.pathname)) videoId = url.pathname.split('/')[2]
  }
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) throw new Error('Use um link de vídeo do YouTube, como youtube.com/watch?v=... ou youtu.be/...')
  return `https://www.youtube.com/watch?v=${videoId}`
}

export async function listExercises(tenantId: string): Promise<Exercise[]> {
  const { data, error } = await client().from('exercise_library').select('id,tenant_id,name,instructions,video_url,muscle_group').eq('tenant_id', tenantId).order('name')
  return result(data ?? [], error) as Exercise[]
}
export async function createExercise(tenantId: string, name: string, instructions: string, videoUrl: string | null, muscleGroup: MuscleGroup): Promise<Exercise> {
  const { data, error } = await client().from('exercise_library').insert({ tenant_id: tenantId, name: name.trim(), instructions: instructions.trim(), video_url: videoUrl || null, muscle_group: muscleGroup }).select('id,tenant_id,name,instructions,video_url,muscle_group').single()
  return result(data, error) as Exercise
}
export async function updateExercise(exercise: Exercise, name: string, instructions: string, muscleGroup: MuscleGroup, videoUrl: string | null = exercise.video_url): Promise<Exercise> {
  const { data, error } = await client().from('exercise_library').update({ name: name.trim(), instructions: instructions.trim(), muscle_group: muscleGroup, video_url: videoUrl })
    .eq('tenant_id', exercise.tenant_id).eq('id', exercise.id).select('id,tenant_id,name,instructions,video_url,muscle_group').single()
  return result(data, error) as Exercise
}
export async function uploadExerciseVideo(exercise: Exercise, file: File, changes?: { name: string; instructions: string; muscleGroup: MuscleGroup }): Promise<Exercise> {
  if (file.type !== 'video/mp4' || file.size === 0 || file.size > 25 * 1024 * 1024)
    throw new Error('Escolha um vídeo MP4 de até 25 MB.')
  const path = `${exercise.tenant_id}/${exercise.id}/${crypto.randomUUID()}.mp4`
  const upload = await client().storage.from('exercise-videos').upload(path, file, { contentType: 'video/mp4', upsert: false })
  result(null, upload.error)
  const update = await client().from('exercise_library').update({ video_url: `storage:${path}`,
    ...(changes ? { name: changes.name.trim(), instructions: changes.instructions.trim(), muscle_group: changes.muscleGroup } : {}) })
    .eq('tenant_id', exercise.tenant_id).eq('id', exercise.id).select('id,tenant_id,name,instructions,video_url,muscle_group').single()
  if (update.error) {
    await client().storage.from('exercise-videos').remove([path])
    throw new Error(update.error.message)
  }
  return update.data as Exercise
}
export async function downloadExerciseVideo(path: string): Promise<Blob> {
  if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.mp4$/.test(path)) throw new Error('Vídeo indisponível')
  const { data, error } = await client().storage.from('exercise-videos').download(path)
  return result(data as Blob, error)
}
export async function getWorkoutPlan(tenantId: string, studentId: string): Promise<WorkoutPlan | null> {
  const { data, error } = await client().from('workout_plans').select('id,tenant_id,student_id,title,draft').eq('tenant_id', tenantId).eq('student_id', studentId).maybeSingle()
  return result(data, error) as WorkoutPlan | null
}
export async function saveWorkoutPlan(tenantId: string, studentId: string, title: string, draft: WorkoutDraft): Promise<WorkoutPlan> {
  const existing = await getWorkoutPlan(tenantId, studentId)
  const query = existing
    ? client().from('workout_plans').update({ title: title.trim(), draft, updated_at: new Date().toISOString() }).eq('id', existing.id).eq('tenant_id', tenantId)
    : client().from('workout_plans').insert({ tenant_id: tenantId, student_id: studentId, title: title.trim(), draft })
  const { data, error } = await query.select('id,tenant_id,student_id,title,draft').single()
  return result(data, error) as WorkoutPlan
}
export async function publishWorkoutPlan(planId: string): Promise<string> {
  const { data, error } = await client().rpc('publish_workout_plan', { p_plan_id: planId })
  return result(data, error) as string
}
export async function getCurrentWorkout(tenantId: string, studentId: string): Promise<{ assignment: WorkoutAssignment; version: WorkoutVersion } | null> {
  const { data, error } = await client().from('workout_assignments').select('id,tenant_id,student_id,version_id,assigned_at').eq('tenant_id', tenantId).eq('student_id', studentId).order('assigned_at', { ascending: false }).limit(1).maybeSingle()
  const assignment = result(data, error) as WorkoutAssignment | null
  if (!assignment) return null
  const response = await client().from('workout_plan_versions').select('id,tenant_id,plan_id,version_number,snapshot,published_at').eq('id', assignment.version_id).single()
  return { assignment, version: result(response.data, response.error) as WorkoutVersion }
}
export async function getWorkoutVersion(versionId: string): Promise<WorkoutVersion> {
  const { data, error } = await client().from('workout_plan_versions').select('id,tenant_id,plan_id,version_number,snapshot,published_at').eq('id', versionId).single()
  return result(data, error) as WorkoutVersion
}
export async function getStudentExerciseVideos(studentId: string, versionId: string): Promise<Record<string, string | null>> {
  const { data, error } = await client().rpc('student_exercise_videos', { p_student_id: studentId, p_version_id: versionId })
  return Object.fromEntries((result(data ?? [], error) as { exercise_id: string; video_url: string | null }[])
    .map(row => [row.exercise_id, row.video_url]))
}
export async function listWorkoutSessions(tenantId: string, studentId: string): Promise<WorkoutSession[]> {
  const { data, error } = await client().from('workout_sessions').select('id,tenant_id,student_id,version_id,day_id,week_start,revision,entries,status,started_at,updated_at,client_started_at,client_finished_at,elapsed_seconds,exercise_swaps,exercise_issues').eq('tenant_id', tenantId).eq('student_id', studentId).order('started_at', { ascending: false }).limit(80)
  return result(data ?? [], error) as WorkoutSession[]
}
export async function listWorkoutSessionsForWeek(tenantId: string, studentId: string, weekStart: string): Promise<WorkoutSession[]> {
  const { data, error } = await client().from('workout_sessions').select('id,tenant_id,student_id,version_id,day_id,week_start,revision,entries,status,started_at,updated_at,client_started_at,client_finished_at,elapsed_seconds,exercise_swaps,exercise_issues')
    .eq('tenant_id', tenantId).eq('student_id', studentId).eq('week_start', weekStart).order('started_at', { ascending: false }).limit(30)
  return result(data ?? [], error) as WorkoutSession[]
}
export async function getStudentServicePlan(tenantId: string, studentId: string): Promise<StudentServicePlan | null> {
  const { data, error } = await client().from('student_service_plans').select('tenant_id,student_id,name,starts_on,ends_on,active').eq('tenant_id', tenantId).eq('student_id', studentId).maybeSingle()
  return result(data, error) as StudentServicePlan | null
}
export async function saveStudentServicePlan(tenantId: string, studentId: string, values: Pick<StudentServicePlan, 'name' | 'starts_on' | 'ends_on' | 'active'>): Promise<StudentServicePlan> {
  const existing = await getStudentServicePlan(tenantId, studentId)
  const query = existing
    ? client().from('student_service_plans').update({ ...values, name: values.name.trim(), updated_at: new Date().toISOString() }).eq('tenant_id', tenantId).eq('student_id', studentId)
    : client().from('student_service_plans').insert({ tenant_id: tenantId, student_id: studentId, ...values, name: values.name.trim() })
  const { data, error } = await query.select('tenant_id,student_id,name,starts_on,ends_on,active').single()
  return result(data, error) as StudentServicePlan
}
export async function syncWorkoutSession(operationId: string, session: Pick<WorkoutSession, 'id' | 'version_id' | 'revision' | 'entries' | 'status'> & { day_id?: string | null; week_start?: string | null; client_started_at?: string | null; client_finished_at?: string | null; elapsed_seconds?: number; exercise_swaps?: Record<string, string>; exercise_issues?: Record<string, 'APARELHO_INDISPONIVEL'> }): Promise<boolean> {
  const modern = Boolean(session.day_id && session.week_start && session.client_started_at)
  const { data, error } = await client().rpc(modern ? 'sync_workout_day_session_v3' : session.day_id && session.week_start ? 'sync_workout_day_session' : 'sync_workout_session', { p_operation_id: operationId, p_session_id: session.id,
    p_version_id: session.version_id, p_revision: session.revision, p_entries: session.entries, p_status: session.status,
    ...(session.day_id && session.week_start ? { p_day_id: session.day_id, p_week_start: session.week_start } : {}),
    ...(modern ? { p_client_started_at: session.client_started_at, p_client_finished_at: session.client_finished_at ?? null, p_elapsed_seconds: session.elapsed_seconds ?? 0, p_exercise_swaps: session.exercise_swaps ?? {}, p_exercise_issues: session.exercise_issues ?? {} } : {}) })
  return result(data, error) as boolean
}
