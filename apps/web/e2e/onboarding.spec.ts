import { expect, test } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

test('superadmin cria tenant, personal ativa acesso e cadastra aluno', async ({ page }) => {
  test.setTimeout(120_000)
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  test.skip(!url || !key, 'Requer Supabase local e chave de serviço somente no processo de teste')
  const admin = createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } })
  const suffix = crypto.randomUUID()
  const tenantName = `Tenant Onboarding ${suffix}`
  const adminEmail = `admin-${suffix}@example.invalid`
  const professionalEmail = `personal-${suffix}@example.invalid`
  const adminPassword = `Test-${crypto.randomUUID()}!`
  const professionalPassword = `Test-${crypto.randomUUID()}!`
  let adminId = ''
  let professionalId = ''
  let tenantId = ''
  try {
    const { data: adminUser, error: adminError } = await admin.auth.admin.createUser({ email: adminEmail, password: adminPassword, email_confirm: true })
    expect(adminError).toBeNull()
    adminId = adminUser.user!.id
    expect((await admin.from('platform_admins').insert({ user_id: adminId })).error).toBeNull()

    await page.goto('/login')
    await page.getByLabel('E-mail').fill(adminEmail)
    await page.getByLabel('Senha').fill(adminPassword)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByText(`Conectado como ${adminEmail}`)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('heading', { name: 'Administração da plataforma' })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Cadastrar personal' }).click()
    await page.getByRole('heading', { name: 'Novo espaço para personal' }).waitFor()
    await page.getByLabel('Nome do espaço do personal').fill(tenantName)
    await page.getByLabel('Nome do personal').fill('Personal Onboarding')
    await page.getByLabel('E-mail do personal').fill(professionalEmail)
    await page.getByRole('button', { name: 'Criar espaço e gerar convite' }).click()
    await expect(page.getByRole('heading', { name: 'Espaço criado. Envie o convite ao personal.' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Copiar convite' })).toBeVisible()
    const spaceCard = page.locator('article.space-card').filter({ has: page.getByRole('heading', { name: tenantName }) })
    await expect(spaceCard).toContainText(professionalEmail)
    await expect(spaceCard).toContainText('Aguardando ativação')
    const newExpiry = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    await spaceCard.getByRole('button', { name: 'Editar plano e prazo' }).click()
    await spaceCard.getByLabel('Tipo de plano').selectOption('MENSAL')
    await spaceCard.getByLabel('Válido até').fill(newExpiry)
    await spaceCard.getByRole('button', { name: 'Salvar plano' }).click()
    await expect(spaceCard).toContainText('Plano e prazo atualizados.', { timeout: 30_000 })
    const invitation = await page.locator('code').textContent()
    const link = invitation?.match(/http:\/\/[^\s]+\/ativar-profissional#token=[0-9a-f]{64}/)?.[0]
    expect(link).toBeTruthy()
    const { data: tenant, error: tenantError } = await admin.from('tenants').select('id').eq('name', tenantName).single()
    expect(tenantError).toBeNull()
    tenantId = tenant!.id
    const { data: plan, error: planError } = await admin.from('tenant_plans').select('plan_type,active,expires_on').eq('tenant_id', tenantId).single()
    expect(planError).toBeNull()
    expect(plan!.plan_type).toBe('MENSAL')
    expect(plan!.active).toBe(true)
    expect(plan!.expires_on).toBe(newExpiry)
    const { data: adminStudents, error: adminStudentsError } = await admin.from('students').select('id').eq('tenant_id', tenantId)
    expect(adminStudentsError).toBeNull()
    expect(adminStudents).toEqual([])

    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible({ timeout: 15_000 })
    await page.goto(link!)
    await page.getByLabel('E-mail').fill(professionalEmail)
    await page.getByLabel('Senha').fill(professionalPassword)
    await page.getByRole('button', { name: 'Criar conta' }).click()
    await expect(page.getByRole('button', { name: 'Ativar meu acesso' })).toBeVisible()
    const { data: profile, error: profileError } = await admin.from('user_profiles').select('user_id').eq('email', professionalEmail).single()
    expect(profileError).toBeNull()
    professionalId = profile!.user_id
    await page.getByRole('button', { name: 'Ativar meu acesso' }).click()
    await expect(page.getByText(`Espaço: ${tenantName}`)).toBeVisible({ timeout: 20_000 })
    await page.getByRole('link', { name: 'Alunos', exact: true }).click()
    await page.getByRole('button', { name: 'Cadastrar aluno' }).click()
    await page.getByLabel('Nome', { exact: true }).fill('Aluno Onboarding')
    await page.getByLabel('E-mail', { exact: true }).fill(`aluno-${suffix}@example.invalid`)
    await page.getByRole('button', { name: 'Salvar aluno' }).click()
    await expect(page.getByRole('heading', { name: 'Aluno Onboarding' })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Conta pendente')).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible({ timeout: 15_000 })
    await page.reload()
    await page.getByLabel('E-mail').fill(adminEmail)
    await page.getByLabel('Senha').fill(adminPassword)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByText(`Conectado como ${adminEmail}`)).toBeVisible({ timeout: 20_000 })
    const activeCard = page.locator('article.space-card').filter({ has: page.getByRole('heading', { name: tenantName }) })
    await expect(activeCard).toContainText('Conta ativada', { timeout: 20_000 })
    await page.getByLabel('Buscar por espaço, nome ou e-mail').fill(professionalEmail)
    await expect(page.locator('article.space-card')).toHaveCount(1)
    await page.getByLabel('Buscar por espaço, nome ou e-mail').clear()
    await activeCard.getByRole('button', { name: 'Suspender acesso' }).click()
    await expect(activeCard.getByText('Suspender este espaço?')).toBeVisible()
    await activeCard.getByRole('button', { name: 'Confirmar suspensão' }).click()
    await expect(activeCard).toContainText('Suspenso')
    await page.getByRole('button', { name: /Suspensos/ }).click()
    await expect(activeCard).toBeVisible()
    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible({ timeout: 15_000 })
    await page.reload()
    await page.getByLabel('E-mail').fill(professionalEmail)
    await page.getByLabel('Senha').fill(professionalPassword)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByText('Não há acesso ativo a um espaço para esta conta. Confira a ativação do convite ou consulte o administrador.')).toBeVisible({ timeout: 20_000 })
    expect((await admin.from('students').select('id').eq('tenant_id', tenantId)).data).toHaveLength(1)
  } finally {
    if (tenantId) {
      await admin.from('student_internal_notes').delete().eq('tenant_id', tenantId)
      await admin.from('student_invitations').delete().eq('tenant_id', tenantId)
      await admin.from('students').delete().eq('tenant_id', tenantId)
      await admin.from('audit_events').delete().eq('tenant_id', tenantId)
      await admin.from('professional_invitations').delete().eq('tenant_id', tenantId)
      await admin.from('professionals').delete().eq('tenant_id', tenantId)
      await admin.from('tenant_memberships').delete().eq('tenant_id', tenantId)
      await admin.from('tenants').delete().eq('id', tenantId)
    }
    if (professionalId) await admin.auth.admin.deleteUser(professionalId)
    if (adminId) await admin.auth.admin.deleteUser(adminId)
  }
})
