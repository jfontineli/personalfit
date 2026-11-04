import { supabase } from './supabase'

export type Membership = { tenant_id: string; role: 'PROFISSIONAL' | 'ALUNO' | 'NUTRICIONISTA'; active: boolean }
export type Tenant = { id: string; name: string }
export type Brand = { tenant_id: string; brand_name: string; display_name: string; accent_color: string; secondary_color: string; logo_url: string | null; whatsapp: string | null; instagram: string | null }
export type Student = { id: string; tenant_id: string; user_id: string | null; full_name: string; email: string; phone: string | null; goal: string | null; status: 'ACTIVE' | 'INACTIVE'; start_date: string; created_at: string }
export type StudentInput = Pick<Student, 'full_name' | 'email' | 'phone' | 'goal'>
export type PlatformSpace = {
  tenant_id: string; tenant_name: string; professional_name: string; professional_email: string
  onboarding_status: 'ATIVADO' | 'CONVITE_PENDENTE' | 'SEM_CONVITE'
  plan_type: 'AVALIACAO' | 'MENSAL' | 'ANUAL'; plan_active: boolean; expires_on: string | null
}

function invitationToken(): Promise<{ token: string; hash: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const token = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)).then(digest => ({
    token,
    hash: Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join(''),
  }))
}

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
export async function listPlatformSpaces(): Promise<PlatformSpace[]> {
  const { data, error } = await client().rpc('list_platform_spaces')
  return unwrap((data ?? []) as PlatformSpace[], error)
}
export async function setPlatformSpacePlan(space: PlatformSpace): Promise<void> {
  const { error } = await client().rpc('set_platform_space_plan', {
    p_tenant_id: space.tenant_id,
    p_plan_type: space.plan_type,
    p_expires_on: space.expires_on,
    p_active: space.plan_active,
  })
  unwrap(null, error)
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
const logoBucket = 'brand-logos'
const logoTypes: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }

export function isManagedLogoPath(path: string | null): path is string {
  return Boolean(path && /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(png|jpg|webp)$/.test(path))
}

export async function uploadBrandLogo(tenantId: string, file: File): Promise<string> {
  const extension = logoTypes[file.type]
  if (!extension) throw new Error('Escolha uma imagem PNG, JPG ou WebP.')
  if (file.size > 2 * 1024 * 1024) throw new Error('O logotipo deve ter até 2 MB.')
  if (file.size === 0) throw new Error('O arquivo selecionado está vazio.')
  const path = `${tenantId}/${crypto.randomUUID()}.${extension}`
  const { error } = await client().storage.from(logoBucket).upload(path, file, { contentType: file.type, upsert: false })
  unwrap(null, error)
  return path
}

export async function downloadBrandLogo(path: string): Promise<Blob> {
  if (!isManagedLogoPath(path)) throw new Error('Logotipo indisponível')
  const { data, error } = await client().storage.from(logoBucket).download(path)
  return unwrap(data as Blob, error)
}

export async function removeBrandLogo(path: string): Promise<void> {
  if (!isManagedLogoPath(path)) return
  const { error } = await client().storage.from(logoBucket).remove([path])
  unwrap(null, error)
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
  const { token, hash } = await invitationToken()
  const { data, error } = await client().rpc('create_student_invite', { p_student_id: studentId, p_token_hash: hash })
  return { link: `${location.origin}/ativar#token=${token}`, expiresAt: unwrap(data as string, error) }
}
export async function claimInvite(token: string): Promise<string> {
  const { data, error } = await client().rpc('claim_student_invite', { p_token: token })
  return unwrap(data as string, error)
}

export async function createProfessionalTenantInvite(values: { tenantName: string; professionalName: string; professionalEmail: string }): Promise<{ link: string; expiresAt: string }> {
  const { token, hash } = await invitationToken()
  const { data, error } = await client().rpc('create_professional_tenant_invite', {
    p_tenant_name: values.tenantName,
    p_professional_name: values.professionalName,
    p_professional_email: values.professionalEmail,
    p_token_hash: hash,
  })
  const result = unwrap(data as { tenant_id: string; expires_at: string }, error)
  return { link: `${location.origin}/ativar-profissional#token=${token}`, expiresAt: result.expires_at }
}

export async function claimProfessionalInvite(token: string): Promise<string> {
  const { data, error } = await client().rpc('claim_professional_invite', { p_token: token })
  return unwrap(data as string, error)
}
