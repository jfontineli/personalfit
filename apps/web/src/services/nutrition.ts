import { supabase } from './supabase'

export type MealOption = { label: string; foods: string; notes: string }
export type Meal = { id: string; name: string; time: string; cycle?: 'ALTO' | 'BAIXO'; options: MealOption[] }
export type NutritionSourceRow = { section: string; item: string; quantity: string; note: string }
export type NutritionIndividualNote = NutritionSourceRow & { id: string; sourceIndex?: number; showToStudent: boolean }
export type NutritionDraft = { title: string; guidance: string; meals: Meal[]; individualNotes?: NutritionIndividualNote[]; sourceImport?: { source: string; importedAt: string; reviewRequired: boolean; rows: NutritionSourceRow[] } }
export type NutritionStatus = { name?: string; crn?: string; version?: number; published_at?: string; is_self?: boolean }
export type NutritionStudent = { student_id: string; full_name: string; latest_version: number | null }
export type PublishedNutrition = { id: string; version: number; snapshot: NutritionDraft; published_at: string; nutritionist_name: string; crn: string }
export type MealState = 'FEITA' | 'ADAPTADA' | 'NAO_FEITA'
export type MealDayRecord = { meal_id: string; state: MealState; note: string; created_at: string }

function client() { if (!supabase) throw new Error('Supabase não configurado'); return supabase }
function result<T>(data: T, error: { message: string } | null): T { if (error) throw new Error(error.message); return data }
async function tokenPair() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const token = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  return { token, hash }
}
export async function inviteNutritionist(studentId: string, email: string, displayName: string) {
  const { token, hash } = await tokenPair()
  const { data, error } = await client().rpc('create_nutrition_invite', { p_student_id: studentId, p_email: email, p_display_name: displayName, p_token_hash: hash })
  return { link: `${location.origin}/ativar-nutricionista#token=${token}`, expiresAt: result(data as string, error) }
}
export async function claimNutritionInvite(token: string, crn: string) {
  const { data, error } = await client().rpc('claim_nutrition_invite', { p_token: token, p_crn: crn })
  return result(data as string, error)
}
export async function assignSelfNutrition(studentId: string, crn: string) {
  const { error } = await client().rpc('nutrition_assign_self', { p_student_id: studentId, p_crn: crn })
  result(null, error)
}
export async function nutritionStatus(studentId: string) {
  const { data, error } = await client().rpc('nutrition_student_status', { p_student_id: studentId })
  return result((data ?? {}) as NutritionStatus, error)
}
export async function nutritionStudents(tenantId: string) {
  const { data, error } = await client().rpc('nutrition_my_students', { p_tenant: tenantId })
  return result((data ?? []) as NutritionStudent[], error)
}
export async function nutritionDraft(studentId: string) {
  const { data, error } = await client().rpc('nutrition_get_draft', { p_student_id: studentId })
  return result(data as NutritionDraft, error)
}
export async function saveNutritionDraft(studentId: string, draft: NutritionDraft) {
  const { error } = await client().rpc('nutrition_save_draft', { p_student_id: studentId, p_draft: draft })
  result(null, error)
}
export async function publishNutrition(studentId: string) {
  const { data, error } = await client().rpc('nutrition_publish', { p_student_id: studentId })
  return result(data as number, error)
}
export async function studentNutrition(studentId: string) {
  const { data, error } = await client().rpc('nutrition_student_plan', { p_student_id: studentId })
  return result(data as PublishedNutrition | null, error)
}
export async function nutritionMealDay(studentId: string, versionId: string, day: string) {
  const { data, error } = await client().rpc('nutrition_meal_day', { p_student_id: studentId, p_version_id: versionId, p_performed_on: day })
  return result((data ?? []) as MealDayRecord[], error)
}
export async function syncNutritionMeal(operationId: string, studentId: string, versionId: string, mealId: string, day: string, state: MealState) {
  const { error } = await client().rpc('nutrition_log_meal', {
    p_operation_id: operationId, p_student_id: studentId, p_version_id: versionId,
    p_meal_id: mealId, p_performed_on: day, p_state: state, p_note: '',
  })
  result(null, error)
}
