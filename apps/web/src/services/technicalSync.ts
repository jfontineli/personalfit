import { listQueue, markTechnicalFailure, markTechnicalSynced } from '../offline/queue'
import { supabase } from './supabase'

export async function syncTechnicalQueue(): Promise<{ synced: number; pending: number }> {
  if (!supabase) throw new Error('Supabase não configurado')
  if (!navigator.onLine) throw new Error('Conexão offline')
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (sessionError || !session) throw new Error('Faça login para sincronizar')

  const { data: memberships, error: membershipError } = await supabase
    .from('tenant_memberships').select('tenant_id').eq('active', true).limit(1)
  if (membershipError) throw new Error('Falha ao consultar vínculo')
  const tenantId = memberships?.[0]?.tenant_id
  if (!tenantId) throw new Error('Usuário sem vínculo ativo')

  const operations = (await listQueue()).filter(operation =>
    operation.ownerUserId === session.user.id && (operation.status === 'PENDING' || operation.status === 'FAILED'))
  let synced = 0
  for (const operation of operations) {
    const { error } = await supabase.rpc('record_technical_operation', {
      p_tenant_id: tenantId,
      p_operation_id: operation.operationId,
    })
    if (error) {
      await markTechnicalFailure(operation.operationId, 'Falha de sincronização técnica')
      continue
    }
    // Both a first insert and an idempotent replay confirm this operation ID.
    await markTechnicalSynced(operation.operationId)
    synced += 1
  }
  return { synced, pending: (await listQueue()).filter(operation =>
    operation.ownerUserId === session.user.id && operation.status !== 'SYNCED').length }
}
