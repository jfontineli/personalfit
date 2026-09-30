import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

export const LOCAL_DB_NAME = 'personalfit-technical-v1'
export const LOCAL_DB_VERSION = 1

export interface TechnicalRecord {
  id: string
  value: string
  updatedAt: string
}

export type QueueStatus = 'PENDING' | 'PROCESSING' | 'SYNCED' | 'FAILED'

export interface QueueOperation {
  operationId: string
  ownerUserId?: string
  entityType: 'TECHNICAL_RECORD'
  entityId: string
  operationType: 'UPSERT' | 'DELETE'
  payload: Record<string, unknown>
  createdAt: string
  attempts: number
  status: QueueStatus
  lastError: string | null
}

interface LocalSchema extends DBSchema {
  records: { key: string; value: TechnicalRecord }
  queue: { key: string; value: QueueOperation; indexes: { 'by-status': QueueStatus } }
  auth: { key: string; value: string }
}

let databasePromise: Promise<IDBPDatabase<LocalSchema>> | undefined

export function localDb(): Promise<IDBPDatabase<LocalSchema>> {
  databasePromise ??= openDB<LocalSchema>(LOCAL_DB_NAME, LOCAL_DB_VERSION, {
    upgrade(db) {
      db.createObjectStore('records', { keyPath: 'id' })
      const queue = db.createObjectStore('queue', { keyPath: 'operationId' })
      queue.createIndex('by-status', 'status')
      db.createObjectStore('auth')
    },
  }).catch((error: unknown) => {
    databasePromise = undefined
    throw error
  })
  return databasePromise
}

export async function probeIndexedDb(): Promise<boolean> {
  try {
    await localDb()
    return true
  } catch {
    return false
  }
}

export async function getTechnicalRecord(id: string): Promise<TechnicalRecord | undefined> {
  return (await localDb()).get('records', id)
}

export async function removeTechnicalRecord(id: string): Promise<void> {
  await (await localDb()).delete('records', id)
}

// Test-only reset. Never call in product flows: it would discard pending operations.
export async function resetLocalDbForTests(): Promise<void> {
  const db = await localDb()
  const tx = db.transaction(['records', 'queue', 'auth'], 'readwrite')
  await Promise.all([tx.objectStore('records').clear(), tx.objectStore('queue').clear(), tx.objectStore('auth').clear()])
  await tx.done
}
