import { beforeEach, describe, expect, it } from 'vitest'
import { getTechnicalRecord, localDb, LOCAL_DB_VERSION, removeTechnicalRecord, resetLocalDbForTests } from './db'
import { listQueue, markTechnicalFailure, markTechnicalSynced, saveTechnicalRecord } from './queue'

beforeEach(async () => { await resetLocalDbForTests() })

describe('IndexedDB técnico', () => {
  it('abre schema versionado e permite leitura, escrita e remoção', async () => {
    expect((await localDb()).version).toBe(LOCAL_DB_VERSION)
    const operation = await saveTechnicalRecord('teste')
    expect((await getTechnicalRecord(operation.entityId))?.value).toBe('teste')
    await removeTechnicalRecord(operation.entityId)
    expect(await getTechnicalRecord(operation.entityId)).toBeUndefined()
  })

  it('grava entidade e operação juntas, preservando falha e tentativas', async () => {
    const operation = await saveTechnicalRecord('local')
    expect(await listQueue()).toEqual([operation])
    await markTechnicalFailure(operation.operationId, 'rede indisponível')
    expect(await listQueue()).toEqual([{ ...operation, attempts: 1, status: 'FAILED', lastError: 'rede indisponível' }])
    expect((await getTechnicalRecord(operation.entityId))?.value).toBe('local')
  })

  it('mantém a operação vinculada ao usuário e confirma sem removê-la da fila', async () => {
    const operation = await saveTechnicalRecord('local', undefined, 'user-1')
    expect(operation.ownerUserId).toBe('user-1')
    await markTechnicalSynced(operation.operationId)
    expect(await listQueue()).toEqual([{ ...operation, attempts: 1, status: 'SYNCED' }])
  })
})
