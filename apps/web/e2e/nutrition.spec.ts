import { expect, test } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

test('personal convida nutricionista, que publica plano para o aluno registrar refeição', async ({ page }) => {
  test.setTimeout(120_000)
  page.setDefaultTimeout(8_000)
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  test.skip(!url || !key, 'Requer Supabase local e chave de serviço apenas no processo de teste')
  const admin = createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } })
  const suffix = crypto.randomUUID()
  const people = ['personal', 'nutricionista', 'aluno'].map(role => ({ email: `${role}-nutrition-${suffix}@example.invalid`, password: `Test-${crypto.randomUUID()}!`, id: '' }))
  let tenantId = ''
  try {
    for (const person of people) {
      const created = await admin.auth.admin.createUser({ email: person.email, password: person.password, email_confirm: true })
      expect(created.error).toBeNull()
      person.id = created.data.user!.id
    }
    const tenant = await admin.from('tenants').insert({ name: `Nutrição E2E ${suffix}` }).select('id').single()
    expect(tenant.error).toBeNull()
    tenantId = tenant.data!.id
    expect((await admin.from('tenant_brand').insert({ tenant_id: tenantId, brand_name: 'Nutrição fictícia', display_name: 'Personal fictício', accent_color: '#123B36', secondary_color: '#FFFFFF' })).error).toBeNull()
    expect((await admin.from('tenant_memberships').insert([
      { tenant_id: tenantId, user_id: people[0].id, role: 'PROFISSIONAL' },
      { tenant_id: tenantId, user_id: people[2].id, role: 'ALUNO' },
    ])).error).toBeNull()
    expect((await admin.from('professionals').insert({ tenant_id: tenantId, user_id: people[0].id, display_name: 'Personal fictício' })).error).toBeNull()
    const student = await admin.from('students').insert({ tenant_id: tenantId, user_id: people[2].id, full_name: 'Aluno Nutrição', email: people[2].email }).select('id').single()
    expect(student.error).toBeNull()
    const studentId = student.data!.id

    await login(people[0], /\/app$/)
    await page.getByRole('link', { name: 'Alunos', exact: true }).click()
    await expect(page).toHaveURL(/\/app\/alunos$/)
    await page.getByRole('link', { name: 'Ver cadastro' }).click()
    await expect(page).toHaveURL(new RegExp(`/app/alunos/${studentId}$`))
    await page.getByRole('tab', { name: 'Alimentação' }).click()
    await page.getByLabel('Nome do nutricionista').fill('Nutricionista fictícia')
    await page.getByLabel('E-mail do nutricionista').fill(people[1].email)
    await page.getByRole('button', { name: 'Convidar nutricionista' }).click()
    const invitation = await page.getByLabel('Link do convite do nutricionista').inputValue()
    expect(invitation).toMatch(/\/ativar-nutricionista#token=[0-9a-f]{64}$/)
    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible()

    await login(people[1], /\/app$/)
    await page.goto(invitation)
    await page.getByLabel('Registro CRN').fill('CRN TESTE 123')
    await page.getByRole('button', { name: 'Ativar meu acesso' }).click()
    await expect(page.getByRole('heading', { name: 'Planos alimentares' })).toBeVisible()
    await page.getByLabel('Nome do plano').fill('Plano fictício E2E')
    await page.getByRole('button', { name: /2\. Refeições/ }).click()
    await page.getByRole('button', { name: 'Adicionar refeição' }).click()
    await page.getByLabel('Nome da refeição').fill('Café da manhã')
    await page.getByLabel('Alimentos e quantidades').fill('Alimento fictício: uma porção de teste')
    await page.getByRole('button', { name: 'Salvar rascunho' }).click()
    await expect(page.getByText('Rascunho salvo.', { exact: false })).toBeVisible()
    page.once('dialog', dialog => void dialog.accept())
    await page.getByRole('button', { name: 'Publicar para o aluno' }).click()
    await expect(page.getByText('Plano publicado · versão 1.', { exact: false })).toBeVisible()
    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible()

    await login(people[2], /\/aluno\/inicio$/)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole('button', { name: 'Alimentação' }).click()
    await expect(page.getByRole('heading', { name: 'Meu plano alimentar' })).toBeVisible()
    await expect(page.getByText('Alimento fictício: uma porção de teste')).toBeHidden()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.locator('.student-nutrition .nutrition-meal').first().locator('summary').click()
    await expect(page.getByText('Alimento fictício: uma porção de teste')).toBeVisible()
    await page.getByRole('button', { name: 'Fiz conforme o plano' }).click()
    await expect(page.getByText('Conforme o plano · confirmado no servidor')).toBeVisible({ timeout: 20_000 })
    await page.evaluate(async () => { await navigator.serviceWorker.ready })
    await page.context().setOffline(true)
    await page.getByRole('button', { name: 'Fiz diferente' }).click()
    await expect(page.getByText('Fiz diferente · salvo neste aparelho')).toBeVisible()
    await page.reload()
    await page.getByRole('button', { name: 'Alimentação' }).click()
    await page.locator('.student-nutrition .nutrition-meal').first().locator('summary').click()
    await expect(page.getByText('Alimento fictício: uma porção de teste')).toBeVisible()
    await expect(page.getByText('Fiz diferente · salvo neste aparelho')).toBeVisible()
    await page.context().setOffline(false)
    await expect(page.getByText('Fiz diferente · confirmado no servidor')).toBeVisible({ timeout: 20_000 })
  } finally {
    if (tenantId) {
      await admin.from('nutrition_meal_events').delete().eq('tenant_id', tenantId)
      await admin.from('nutrition_plan_versions').delete().eq('tenant_id', tenantId)
      await admin.from('nutrition_plans').delete().eq('tenant_id', tenantId)
      await admin.from('nutrition_assignments').delete().eq('tenant_id', tenantId)
      await admin.from('nutrition_invitations').delete().eq('tenant_id', tenantId)
      await admin.from('nutritionists').delete().eq('tenant_id', tenantId)
      await admin.from('students').delete().eq('tenant_id', tenantId)
      await admin.from('audit_events').delete().eq('tenant_id', tenantId)
      await admin.from('professionals').delete().eq('tenant_id', tenantId)
      await admin.from('tenant_memberships').delete().eq('tenant_id', tenantId)
      await admin.from('tenants').delete().eq('id', tenantId)
    }
    for (const person of people) if (person.id) {
      const deleted = await admin.auth.admin.deleteUser(person.id)
      expect(deleted.error).toBeNull()
    }
  }

  async function login(person: { email: string; password: string }, destination: RegExp) {
    await page.goto('/login')
    await page.getByLabel('E-mail').fill(person.email)
    await page.getByLabel('Senha').fill(person.password)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page).toHaveURL(destination, { timeout: 20_000 })
  }
})
