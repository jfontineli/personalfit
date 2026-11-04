import { expect, test } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

test('personal nutricionista prescreve com a mesma conta', async ({ page }) => {
  test.setTimeout(90_000)
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  test.skip(!url || !key, 'Requer Supabase local e chave de serviço apenas no processo de teste')
  const admin = createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } })
  const suffix = crypto.randomUUID()
  const coach = { email: `dual-coach-${suffix}@example.invalid`, password: `Test-${crypto.randomUUID()}!`, id: '' }
  const student = { email: `dual-student-${suffix}@example.invalid`, password: `Test-${crypto.randomUUID()}!`, id: '' }
  let tenantId = ''
  try {
    for (const person of [coach, student]) {
      const created = await admin.auth.admin.createUser({ email: person.email, password: person.password, email_confirm: true })
      expect(created.error).toBeNull()
      person.id = created.data.user!.id
    }
    const tenant = await admin.from('tenants').insert({ name: `Duplo papel E2E ${suffix}` }).select('id').single()
    expect(tenant.error).toBeNull(); tenantId = tenant.data!.id
    expect((await admin.from('tenant_brand').insert({ tenant_id: tenantId, brand_name: 'Marca fictícia', display_name: 'Personal nutricionista', accent_color: '#123B36', secondary_color: '#FFFFFF' })).error).toBeNull()
    expect((await admin.from('tenant_memberships').insert([
      { tenant_id: tenantId, user_id: coach.id, role: 'PROFISSIONAL' },
      { tenant_id: tenantId, user_id: student.id, role: 'ALUNO' },
    ])).error).toBeNull()
    expect((await admin.from('professionals').insert({ tenant_id: tenantId, user_id: coach.id, display_name: 'Personal nutricionista' })).error).toBeNull()
    const row = await admin.from('students').insert({ tenant_id: tenantId, user_id: student.id, full_name: 'Aluno duplo papel', email: student.email }).select('id').single()
    expect(row.error).toBeNull()
    const studentId = row.data!.id

    await page.goto('/login')
    await page.getByLabel('E-mail').fill(coach.email)
    await page.getByLabel('Senha').fill(coach.password)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page).toHaveURL(/\/app$/)
    await page.getByRole('link', { name: 'Alunos', exact: true }).click()
    await page.getByRole('link', { name: 'Ver cadastro' }).click()
    await expect(page).toHaveURL(new RegExp(`/app/alunos/${studentId}$`))
    await page.getByRole('tab', { name: 'Alimentação' }).click()
    await page.getByRole('button', { name: 'Sou nutricionista' }).click()
    await page.getByLabel('Seu registro CRN').fill('CRN TESTE 123')
    await page.getByRole('button', { name: 'Assumir acompanhamento nutricional' }).click()
    await expect(page.getByText('Personal nutricionista · você')).toBeVisible()
    const imported = await admin.from('nutrition_plans').insert({ tenant_id: tenantId, student_id: studentId, nutritionist_user_id: coach.id, draft: { title: '', guidance: '', meals: [], sourceImport: { source: 'Fonte fictícia E2E', importedAt: new Date().toISOString(), reviewRequired: true, rows: [{ section: 'meta', item: 'Texto original reservado', quantity: '1 unidade', note: 'Conteúdo original da fonte' }] } } })
    expect(imported.error).toBeNull()
    await page.reload()
    await page.getByRole('button', { name: 'Editar plano alimentar' }).click()
    await expect(page.getByRole('heading', { name: 'Planos alimentares' })).toBeVisible()
    await page.getByLabel('Nome do plano').fill('Plano individual fictício')
    await page.getByRole('button', { name: /2\. Refeições/ }).click()
    await page.getByRole('button', { name: 'Adicionar refeição' }).click()
    await page.getByLabel('Nome da refeição').fill('Almoço')
    await page.getByLabel('Alimentos e quantidades').fill('Alimento fictício em porção de teste')
    await page.getByRole('button', { name: /3\. Informações individuais/ }).click()
    await page.locator('.nutrition-source-groups > details').first().locator('summary').first().click()
    await page.locator('.nutrition-source-item').first().locator('summary').first().click()
    const importedNote = page.locator('.nutrition-source-item').first()
    await importedNote.getByLabel('Assunto').fill('Meta individual revisada')
    await importedNote.locator('textarea').fill('Orientação individual revisada para o aluno')
    await importedNote.getByRole('checkbox', { name: 'Mostrar esta informação ao aluno após publicar' }).check()
    await page.getByText('Comparar com texto importado').click()
    await expect(page.getByText('Texto original reservado')).toBeVisible()
    await page.getByRole('button', { name: 'Adicionar informação' }).click()
    await page.locator('.nutrition-source-groups > details').last().locator('summary').first().click()
    await page.locator('.nutrition-source-item').last().locator('summary').click()
    const privateNote = page.locator('.nutrition-source-item').last()
    await privateNote.getByLabel('Assunto').fill('Nota clínica privada')
    await privateNote.locator('textarea').fill('Conteúdo reservado ao nutricionista')
    await page.getByLabel('Conferi as informações individuais, as quantidades e o conteúdo clínico desta dieta.').check()
    await page.getByRole('button', { name: 'Confirmar revisão clínica' }).click()
    await page.getByRole('button', { name: 'Salvar rascunho' }).click()
    await expect(page.getByText('Rascunho salvo.', { exact: false })).toBeVisible()
    page.once('dialog', dialog => void dialog.accept())
    await page.getByRole('button', { name: 'Publicar para o aluno' }).click()
    await expect(page.getByText('Plano publicado · versão 1.', { exact: false })).toBeVisible()
    await expect(page.locator('.nutrition-status')).toContainText('Plano publicado · versão 1')
    const membership = await admin.from('tenant_memberships').select('role').eq('tenant_id', tenantId).eq('user_id', coach.id).single()
    expect(membership.error).toBeNull()
    expect(membership.data?.role).toBe('PROFISSIONAL')
    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible()
    await page.getByLabel('E-mail').fill(student.email)
    await page.getByLabel('Senha').fill(student.password)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page).toHaveURL(/\/aluno\/inicio$/)
    await page.getByRole('button', { name: 'Alimentação' }).click()
    await page.locator('.student-nutrition .nutrition-meal').first().locator('summary').click()
    await expect(page.getByText('Alimento fictício em porção de teste')).toBeVisible()
    await expect(page.getByText('Orientação individual revisada para o aluno')).toBeHidden()
    await page.locator('.nutrition-student-notes > summary').click()
    await page.locator('.nutrition-student-note-list summary').first().click()
    await expect(page.getByText('Orientação individual revisada para o aluno')).toBeVisible()
    await expect(page.getByText('Conteúdo reservado ao nutricionista')).toHaveCount(0)
    await expect(page.getByText('Conteúdo original da fonte')).toHaveCount(0)
    const published = await admin.from('nutrition_plan_versions').select('snapshot').eq('tenant_id', tenantId).eq('student_id', studentId).single()
    expect(published.error).toBeNull()
    expect(published.data?.snapshot).not.toHaveProperty('sourceImport')
    expect((published.data?.snapshot as { individualNotes: unknown[] }).individualNotes).toHaveLength(1)
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
    for (const person of [coach, student]) if (person.id) {
      const deleted = await admin.auth.admin.deleteUser(person.id)
      expect(deleted.error).toBeNull()
    }
  }
})
