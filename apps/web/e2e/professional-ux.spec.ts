import { expect, test } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

test('personal configura marca, cadastra aluno e compartilha convite', async ({ page, context }) => {
  test.setTimeout(120_000)
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  test.skip(!url || !key, 'Requer Supabase local e chave de serviço apenas no processo de teste')
  const admin = createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } })
  const suffix = crypto.randomUUID()
  const email = `personal-ux-${suffix}@example.invalid`
  const password = `Test-${crypto.randomUUID()}!`
  const tenantName = `Espaço UX ${suffix}`
  let userId = ''
  let tenantId = ''
  try {
    const { data: createdUser, error: userError } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    expect(userError).toBeNull()
    userId = createdUser.user!.id
    const { data: tenant, error: tenantError } = await admin.from('tenants').insert({ name: tenantName }).select('id').single()
    expect(tenantError).toBeNull()
    tenantId = tenant!.id
    expect((await admin.from('tenant_brand').insert({ tenant_id: tenantId, brand_name: tenantName, display_name: 'Personal UX', accent_color: '#123B36', secondary_color: '#FFFFFF' })).error).toBeNull()
    expect((await admin.from('tenant_memberships').insert({ tenant_id: tenantId, user_id: userId, role: 'PROFISSIONAL' })).error).toBeNull()
    expect((await admin.from('professionals').insert({ tenant_id: tenantId, user_id: userId, display_name: 'Personal UX' })).error).toBeNull()

    await page.goto('/login')
    await page.getByLabel('E-mail').fill(email)
    await page.getByLabel('Senha').fill(password)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByRole('heading', { name: 'Área do personal' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Seu espaço' })).toBeVisible()
    await page.getByRole('link', { name: 'Marca', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Sua marca' })).toBeVisible()
    await page.getByLabel('Cor principal').fill('#336699')
    await page.getByLabel('Cor secundária').fill('#f1e5d0')
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/vZsAAAAASUVORK5CYII=', 'base64')
    await page.getByLabel('Logotipo').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: png })
    await expect(page.getByRole('img', { name: 'Prévia do logotipo' })).toBeVisible()
    await page.getByRole('button', { name: 'Salvar marca' }).click()
    await expect(page.getByText(/Marca atualizada/)).toBeVisible()
    await expect(page.getByRole('img', { name: 'Prévia do logotipo' })).toBeVisible()
    const { data: savedBrand, error: brandError } = await admin.from('tenant_brand').select('accent_color,secondary_color,logo_url').eq('tenant_id', tenantId).single()
    expect(brandError).toBeNull()
    expect(savedBrand?.accent_color).toBe('#336699')
    expect(savedBrand?.secondary_color).toBe('#f1e5d0')
    expect(savedBrand?.logo_url).toMatch(new RegExp(`^${tenantId}/[0-9a-f-]+[.]png$`))

    await page.getByRole('link', { name: 'Alunos', exact: true }).click()
    await page.getByRole('button', { name: 'Cadastrar aluno' }).click()
    await page.getByLabel('Nome', { exact: true }).fill('Aluno UX')
    await page.getByLabel('E-mail', { exact: true }).fill(`aluno-ux-${suffix}@example.invalid`)
    await page.getByRole('button', { name: 'Salvar aluno' }).click()
    await expect(page.getByRole('heading', { name: 'Aluno UX' })).toBeVisible()
    await page.getByRole('tab', { name: 'Atendimento' }).click()
    await expect(page.getByLabel('Nome do atendimento')).toBeVisible()
    await page.getByRole('tab', { name: 'Treino' }).click()
    await expect(page.getByText('Nenhum treino publicado para este aluno.')).toBeVisible()
    await page.getByRole('tab', { name: 'Cadastro' }).click()
    await page.getByRole('button', { name: 'Criar convite' }).click()
    await expect(page.getByText('Se existir um link anterior, ele deixará de funcionar.')).toBeVisible()
    await page.getByRole('button', { name: 'Confirmar convite' }).click()
    const invitation = await page.getByLabel('Link do convite').inputValue()
    expect(invitation).toMatch(/\/ativar#token=[0-9a-f]{64}$/)
    const share = page.getByRole('link', { name: 'Compartilhar pelo WhatsApp' })
    await expect(share).toHaveAttribute('target', '_blank')
    const shareUrl = new URL(await share.getAttribute('href') ?? '')
    expect(shareUrl.origin).toBe('https://wa.me')
    expect(shareUrl.searchParams.get('text')).toContain(invitation)
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.getByRole('button', { name: 'Copiar convite' }).click()
    await expect(page.getByRole('button', { name: 'Link copiado' })).toBeVisible()
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(invitation)
    await page.getByRole('button', { name: 'Gerar novo convite' }).click()
    await expect(page.getByText('Se existir um link anterior, ele deixará de funcionar.')).toBeVisible()
    await page.getByRole('button', { name: 'Cancelar' }).click()
  } finally {
    if (tenantId) {
      const { data: objects } = await admin.storage.from('brand-logos').list(tenantId)
      if (objects?.length) await admin.storage.from('brand-logos').remove(objects.map(object => `${tenantId}/${object.name}`))
      await admin.from('student_invitations').delete().eq('tenant_id', tenantId)
      await admin.from('student_internal_notes').delete().eq('tenant_id', tenantId)
      await admin.from('students').delete().eq('tenant_id', tenantId)
      await admin.from('audit_events').delete().eq('tenant_id', tenantId)
      await admin.from('professionals').delete().eq('tenant_id', tenantId)
      await admin.from('tenant_memberships').delete().eq('tenant_id', tenantId)
      await admin.from('tenant_brand').delete().eq('tenant_id', tenantId)
      await admin.from('tenant_plans').delete().eq('tenant_id', tenantId)
      await admin.from('tenants').delete().eq('id', tenantId)
    }
    if (userId) await admin.auth.admin.deleteUser(userId)
  }
})
