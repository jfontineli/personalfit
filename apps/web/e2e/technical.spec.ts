import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const tenantA = 'aaaaaaaa-0000-4000-8000-000000000001'
const tenantB = 'bbbbbbbb-0000-4000-8000-000000000002'

test('abre a aplicação, grava localmente e reabre offline', async ({ page, context }) => {
  await page.goto('/diagnostico')
  await expect(page.getByRole('heading', { name: 'Diagnóstico da aplicação' })).toBeVisible()
  await page.getByRole('button', { name: 'Testar IndexedDB' }).click()
  await expect(page.getByText(/Gravação local: OK/)).toBeVisible()
  await expect.poll(async () => page.evaluate(() => navigator.serviceWorker?.controller !== null)).toBe(true)
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Diagnóstico da aplicação' })).toBeVisible()
  await expect(page.getByText('Conexão').locator('..')).toContainText('offline')
  await context.setOffline(false)
  await page.reload()
  await expect(page.getByText('Conexão').locator('..')).toContainText('online')
})

test('Auth, sessão, RLS e sincronização técnica para A, B e sem vínculo', async ({ page, context }) => {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  test.skip(!url || !key || !serviceKey, 'Requer Supabase local e chave de serviço apenas no processo de testes')

  const admin = createClient(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } })
  const fixtures = [
    { label: 'A', tenantId: tenantA, email: `a-${crypto.randomUUID()}@example.invalid`, password: `Test-${crypto.randomUUID()}!`, id: '' },
    { label: 'B', tenantId: tenantB, email: `b-${crypto.randomUUID()}@example.invalid`, password: `Test-${crypto.randomUUID()}!`, id: '' },
    { label: 'sem vínculo', tenantId: null, email: `none-${crypto.randomUUID()}@example.invalid`, password: `Test-${crypto.randomUUID()}!`, id: '' },
  ]

  try {
    for (const user of fixtures) {
      const { data, error } = await admin.auth.admin.createUser({ email: user.email, password: user.password, email_confirm: true })
      expect(error, `criação do usuário ${user.label}`).toBeNull()
      user.id = data.user!.id
      if (user.tenantId) {
        const { error: membershipError } = await admin.from('tenant_memberships').insert({ tenant_id: user.tenantId, user_id: user.id, role: 'PROFISSIONAL' })
        expect(membershipError, `vínculo do usuário ${user.label}`).toBeNull()
      }
    }

    for (const user of fixtures) {
      const client = createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } })
      const { error: loginError } = await client.auth.signInWithPassword({ email: user.email, password: user.password })
      expect(loginError).toBeNull()
      const { data: tenants, error: tenantsError } = await client.from('tenants').select('id')
      expect(tenantsError).toBeNull()
      expect(tenants?.map(tenant => tenant.id)).toEqual(user.tenantId ? [user.tenantId] : [])
      const { data: brands, error: brandsError } = await client.from('tenant_brand').select('tenant_id')
      expect(brandsError).toBeNull()
      expect(brands?.map(brand => brand.tenant_id)).toEqual(user.tenantId ? [user.tenantId] : [])
      await client.auth.signOut()
    }

    await page.goto('/diagnostico')
    await expect(page.getByText('Supabase').locator('..')).toContainText('online')
    await login(page, fixtures[0].email, fixtures[0].password)
    await page.reload()
    await expect(page.getByTestId('identity')).toContainText(fixtures[0].email)
    const reopened = await context.newPage()
    await reopened.goto('/diagnostico')
    await expect(reopened.getByTestId('identity')).toContainText(fixtures[0].email)
    await reopened.close()
    await page.getByRole('button', { name: 'Renovar sessão' }).click()
    await expect(page.getByText('Sessão renovada')).toBeVisible()
    expect(await page.evaluate(() => localStorage.length)).toBe(0)

    await context.setOffline(true)
    await page.getByRole('button', { name: 'Testar IndexedDB' }).click()
    await expect(page.getByText(/Gravação local: OK/)).toBeVisible()
    await page.getByRole('button', { name: 'Sincronizar teste técnico' }).click()
    await expect(page.getByText('Conexão offline')).toBeVisible()
    await context.setOffline(false)
    await page.getByRole('button', { name: 'Sincronizar teste técnico' }).click()
    await expect(page.getByText(/Sincronização técnica: 1 confirmada/)).toBeVisible()
    const { count: receipts, error: receiptsError } = await admin.from('technical_operation_receipts').select('operation_id', { count: 'exact', head: true }).eq('user_id', fixtures[0].id)
    expect(receiptsError).toBeNull()
    expect(receipts).toBe(1)

    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible()
    await login(page, fixtures[1].email, fixtures[1].password)
    await page.getByRole('button', { name: 'Sincronizar teste técnico' }).click()
    await expect(page.getByText(/Sincronização técnica: 0 confirmada/)).toBeVisible()
    await page.getByRole('button', { name: 'Sair' }).click()
    await login(page, fixtures[2].email, fixtures[2].password)
    await page.getByRole('button', { name: 'Sincronizar teste técnico' }).click()
    await expect(page.getByText('Usuário sem vínculo ativo')).toBeVisible()
    await page.getByRole('button', { name: 'Sair' }).click()
  } finally {
    for (const user of fixtures) if (user.id) await admin.auth.admin.deleteUser(user.id)
  }
})

async function login(page: import('@playwright/test').Page, email: string, password: string) {
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByTestId('identity')).toContainText(email)
}
