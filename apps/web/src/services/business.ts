import { supabase } from './supabase'

export type Membership = { tenant_id: string; role: 'PROFISSIONAL' | 'ALUNO'; active: boolean }
export type Tenant = { id: string; name: string }
export type Brand = { tenant_id: string; brand_name: string; display_name: string; accent_color: string; secondary_color: string; logo_url: string | null; whatsapp: string | null; instagram: string | null }
export type Student = { id: string; tenant_id: string; user_id: string | null; full_name: string; email: string; phone: string | null; goal: string | null; status: 'ACTIVE' | 'INACTIVE'; start_date: string; created_at: string }
export type StudentInput = Pick<Student, 'full_name' | 'email' | 'phone' | 'goal'>

function client() {
  if (!supabase) throw new Error('Supabase não configurado')
  return supabase
}
function unwrap<T>(data: T, error: { message: string } | null): T {
  if (error) throw new Error(error.message)
  return data
}
export async function listMemberships(): Promise<Membership[]> {
  const { data, error } = await client().from('tenant_memberships').select('tenant_id,role,active').eq('active', true)
  return unwrap((data ?? []) as Membership[], error)
}
export async function isPlatformAdmin(): Promise<boolean> {
  const { data, error } = await client().from('platform_admins').select('user_id').limit(1)
  return unwrap(Boolean(data?.length), error)
}
export async function listTenants(): Promise<Tenant[]> {
  const { data, error } = await client().from('tenants').select('id,name')
  return unwrap((data ?? []) as Tenant[], error)
}
export async function getBrand(tenantId: string): Promise<Brand | null> {
  const { data, error } = await client().from('tenant_brand').select('tenant_id,brand_name,display_name,accent_color,secondary_color,logo_url,whatsapp,instagram').eq('tenant_id', tenantId).maybeSingle()
  return unwrap(data as Brand | null, error)
}
export async function updateBrand(tenantId: string, values: Omit<Brand, 'tenant_id'>): Promise<void> {
  const { data, error } = await client().from('tenant_brand').update(values).eq('tenant_id', tenantId).select('tenant_id')
  unwrap(data, error)
  if (!data?.length) throw new Error('Marca não encontrada ou acesso negado')
}
export async function listStudents(tenantId: string): Promise<Student[]> {
  const { data, error } = await client().from('students').select('id,tenant_id,user_id,full_name,email,phone,goal,status,start_date,created_at').eq('tenant_id', tenantId).order('full_name')
  return unwrap((data ?? []) as Student[], error)
}
export async function getStudent(tenantId: string, studentId: string): Promise<Student | null> {
  const { data, error } = await client().from('students').select('id,tenant_id,user_id,full_name,email,phone,goal,status,start_date,created_at').eq('tenant_id', tenantId).eq('id', studentId).maybeSingle()
  return unwrap(data as Student | null, error)
}
export async function createStudent(tenantId: string, values: StudentInput): Promise<Student> {
  const { data, error } = await client().from('students').insert({ tenant_id: tenantId, ...values }).select('id,tenant_id,user_id,full_name,email,phone,goal,status,start_date,created_at').single()
  return unwrap(data as Student, error)
}
export async function updateStudent(tenantId: string, studentId: string, values: Partial<StudentInput> & { status?: Student['status'] }): Promise<Student> {
  const { data, error } = await client().from('students').update(values).eq('tenant_id', tenantId).eq('id', studentId).select('id,tenant_id,user_id,full_name,email,phone,goal,status,start_date,created_at').single()
  return unwrap(data as Student, error)
}
export async function getStudentNotes(tenantId: string, studentId: string): Promise<string> {
  const { data, error } = await client().from('student_internal_notes').select('body').eq('tenant_id', tenantId).eq('student_id', studentId).maybeSingle()
  return unwrap(data?.body ?? '', error)
}
export async function saveStudentNotes(tenantId: string, studentId: string, body: string): Promise<void> {
  const { data: existing, error: lookupError } = await client().from('student_internal_notes').select('student_id').eq('tenant_id', tenantId).eq('student_id', studentId).maybeSingle()
  unwrap(existing, lookupError)
  const { error } = existing
    ? await client().from('student_internal_notes').update({ body }).eq('tenant_id', tenantId).eq('student_id', studentId)
    : await client().from('student_internal_notes').insert({ tenant_id: tenantId, student_id: studentId, body })
  unwrap(null, error)
}
export async function createInvite(studentId: string): Promise<{ link: string; expiresAt: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const token = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  const tokenHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  const { data, error } = await client().rpc('create_student_invite', { p_student_id: studentId, p_token_hash: tokenHash })
  return { link: `${location.origin}/ativar#token=${token}`, expiresAt: unwrap(data as string, error) }
}
export async function claimInvite(token: string): Promise<string> {
  const { data, error } = await client().rpc('claim_student_invite', { p_token: token })
  return unwrap(data as string, error)
}
