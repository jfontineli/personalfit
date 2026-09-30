import { localDb, type QueueOperation, type TechnicalRecord } from './db'

export async function saveTechnicalRecord(value: string, id = crypto.randomUUID(), ownerUserId?: string): Promise<QueueOperation> {
  const now = new Date().toISOString()
  const record: TechnicalRecord = { id, value, updatedAt: now }
  const operation: QueueOperation = {
    operationId: crypto.randomUUID(),
    ownerUserId,
    entityType: 'TECHNICAL_RECORD',
    entityId: id,
    operationType: 'UPSERT',
    payload: { value },
    createdAt: now,
    attempts: 0,
    status: 'PENDING',
    lastError: null,
  }
  const db = await localDb()
  const tx = db.transaction(['records', 'queue'], 'readwrite')
  await tx.objectStore('records').put(record)
  await tx.objectStore('queue').put(operation)
  await tx.done
  return operation
}

export async function listQueue(): Promise<QueueOperation[]> {
  return (await localDb()).getAll('queue')
}

export async function markTechnicalFailure(operationId: string, message: string): Promise<void> {
  const db = await localDb()
  const tx = db.transaction('queue', 'readwrite')
  const operation = await tx.store.get(operationId)
  if (!operation) throw new Error('Operação não encontrada')
  await tx.store.put({ ...operation, attempts: operation.attempts + 1, status: 'FAILED', lastError: message })
  await tx.done
}

export async function markTechnicalSynced(operationId: string): Promise<void> {
  const db = await localDb()
  const tx = db.transaction('queue', 'readwrite')
  const operation = await tx.store.get(operationId)
  if (!operation) throw new Error('Operação não encontrada')
  await tx.store.put({ ...operation, attempts: operation.attempts + 1, status: 'SYNCED', lastError: null })
  await tx.done
}
