import { expect, test, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const tenantA = 'aaaaaaaa-0000-4000-8000-000000000001'
const tenantB = 'bbbbbbbb-0000-4000-8000-000000000002'

test('papéis, tenant, cadastro, convite e acesso negado por ID', async ({ page }) => {
  test.setTimeout(180_000)
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  test.skip(!url || !key, 'Requer Supabase local e chave de serviço apenas no processo de teste')
  const admin = createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } })
  const suffix = crypto.randomUUID()
  const people = [
    { email: `pro-a-${suffix}@example.invalid`, password: `Test-${crypto.randomUUID()}!`, tenants: [tenantA], id: '' },
    { email: `pro-b-${suffix}@example.invalid`, password: `Test-${crypto.randomUUID()}!`, tenants: [tenantB], id: '' },
    { email: `multi-${suffix}@example.invalid`, password: `Test-${crypto.randomUUID()}!`, tenants: [tenantA, tenantB], id: '' },
    { email: `student-${suffix}@example.invalid`, password: `Test-${crypto.randomUUID()}!`, tenants: [], id: '' },
  ]
  let studentId = ''
  let originalBrandName = ''
  try {
    const { data: originalBrand, error: brandReadError } = await admin.from('tenant_brand').select('display_name').eq('tenant_id', tenantA).maybeSingle()
    expect(brandReadError).toBeNull()
    test.skip(!originalBrand, 'Os tenants fictícios A/B do seed não existem neste banco local preservado')
    originalBrandName = originalBrand!.display_name
    for (const person of people.slice(0, 3)) {
      const { data, error } = await admin.auth.admin.createUser({ email: person.email, password: person.password, email_confirm: true })
      expect(error).toBeNull()
      person.id = data.user!.id
      for (const tenantId of person.tenants) {
        const { error: linkError } = await admin.from('tenant_memberships').insert({ tenant_id: tenantId, user_id: person.id, role: 'PROFISSIONAL' })
        expect(linkError).toBeNull()
        const { error: professionalError } = await admin.from('professionals').insert({ tenant_id: tenantId, user_id: person.id, display_name: 'Profissional de teste' })
        expect(professionalError).toBeNull()
      }
    }

    await page.goto('/login')
    await login(page, people[0])
    await expect(page.getByText('Espaço:')).toBeVisible()
    await page.getByRole('link', { name: 'Alunos', exact: true }).click()
    await expect(page.getByText('Aluno A1')).toBeVisible()
    await expect(page.getByText('Aluno B1')).toHaveCount(0)
    await page.getByRole('button', { name: 'Cadastrar aluno' }).click()
    await page.getByLabel('Nome', { exact: true }).fill('Aluno E2E')
    await page.getByLabel('E-mail', { exact: true }).fill(people[3].email)
    await page.getByRole('button', { name: 'Salvar aluno' }).click()
    await expect(page.getByRole('heading', { name: 'Aluno E2E' })).toBeVisible()
    studentId = new URL(page.url()).pathname.split('/')[3]
    await expect(page.locator('.student-heading').getByText('Conta pendente')).toBeVisible()
    await page.getByLabel('Objetivo').fill('Objetivo de teste')
    await page.getByRole('button', { name: 'Salvar aluno' }).click()
    await expect(page.getByText('Aluno atualizado')).toBeVisible()
    await page.getByRole('button', { name: 'Criar convite' }).click()
    await page.getByRole('button', { name: 'Confirmar convite' }).click()
    const invitation = await page.getByLabel('Link do convite').inputValue()
    const link = invitation.match(/http:\/\/[^\s]+\/ativar#token=[0-9a-f]{64}/)?.[0]
    expect(link).toBeTruthy()
    await page.getByRole('button', { name: 'Inativar aluno' }).click()
    await expect(page.locator('.student-heading').getByText('Inativo', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Reativar aluno' }).click()
    await expect(page.locator('.student-heading .status-badge').getByText('Ativo', { exact: true })).toBeVisible()
    await page.getByRole('link', { name: 'Marca', exact: true }).click()
    await page.getByLabel('Nome exibido aos alunos').fill('Marca A E2E')
    await page.getByRole('button', { name: 'Salvar marca' }).click()
    await expect(page.getByText('Marca atualizada')).toBeVisible()
    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible({ timeout: 15_000 })

    await login(page, people[1])
    await page.goto(`/app/alunos/${studentId}`)
    await expect(page.getByText('Aluno não encontrado ou acesso negado.')).toBeVisible()
    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible({ timeout: 15_000 })

    await login(page, people[2])
    await expect(page.getByLabel('Selecionar espaço')).toBeVisible()
    await page.getByLabel('Selecionar espaço').selectOption(tenantB)
    await expect(page.locator('main > p strong')).toHaveText('Tenant B')
    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible({ timeout: 15_000 })

    await page.goto(link!)
    await page.getByLabel('E-mail').fill(people[3].email)
    await page.getByLabel('Senha').fill(people[3].password)
    await page.getByRole('button', { name: 'Criar conta' }).click()
    await expect(page.getByRole('button', { name: 'Ativar meu cadastro' })).toBeVisible()
    const { data: newProfile, error: profileError } = await admin.from('user_profiles').select('user_id').eq('email', people[3].email).single()
    expect(profileError).toBeNull()
    people[3].id = newProfile!.user_id
    await page.goto('/app')
    await expect(page.getByText('Não há acesso ativo a um espaço para esta conta. Confira a ativação do convite ou consulte o administrador.')).toBeVisible()
    await page.goto(link!)
    await page.getByRole('button', { name: 'Ativar meu cadastro' }).click()
    await expect(page.locator('.student-app-header')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Olá, Aluno' })).toBeVisible()
    await expect(page.getByText('Seu personal ainda não publicou um treino.')).toBeVisible()
    await page.getByRole('button', { name: 'Sair' }).click()
  } finally {
    if (originalBrandName) await admin.from('tenant_brand').update({ display_name: originalBrandName }).eq('tenant_id', tenantA)
    if (!people[3].id) {
      const { data: signupProfile } = await admin.from('user_profiles').select('user_id').eq('email', people[3].email).maybeSingle()
      people[3].id = signupProfile?.user_id ?? ''
    }
    if (studentId) {
      await admin.from('student_invitations').delete().eq('student_id', studentId)
      await admin.from('student_internal_notes').delete().eq('student_id', studentId)
      await admin.from('students').update({ user_id: null }).eq('id', studentId)
      await admin.from('students').delete().eq('id', studentId)
    }
    for (const person of people) if (person.id) {
      await admin.from('professionals').delete().eq('user_id', person.id)
      await admin.from('audit_events').delete().eq('actor_user_id', person.id)
      await admin.auth.admin.deleteUser(person.id)
    }
  }
})

async function login(page: Page, person: { email: string; password: string }) {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(person.email)
  await page.getByLabel('Senha').fill(person.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByText(`Conectado como ${person.email}`)).toBeVisible({ timeout: 15_000 })
}
