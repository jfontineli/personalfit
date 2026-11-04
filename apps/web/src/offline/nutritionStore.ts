import { openDB, type DBSchema } from 'idb'
import type { MealState, PublishedNutrition } from '../services/nutrition'

type PendingMeal = { operationId: string; ownerId: string; tenantId: string; studentId: string; versionId: string; mealId: string; day: string; state: MealState; error: string | null; createdAt: string }
type LocalMeal = { key: string; ownerId: string; tenantId: string; studentId: string; versionId: string; mealId: string; day: string; state: MealState; pending: boolean }
type CachedPlan = { key: string; plan: PublishedNutrition }
interface NutritionSchema extends DBSchema {
  plans: { key: string; value: CachedPlan }
  meals: { key: string; value: LocalMeal }
  pending: { key: string; value: PendingMeal }
}
let dbPromise: ReturnType<typeof openDB<NutritionSchema>> | undefined
function db() {
  dbPromise ??= openDB<NutritionSchema>('personalfit-nutrition-v1', 1, { upgrade(database) {
    database.createObjectStore('plans', { keyPath: 'key' })
    database.createObjectStore('meals', { keyPath: 'key' })
    database.createObjectStore('pending', { keyPath: 'operationId' })
  } }).catch(error => { dbPromise = undefined; throw error })
  return dbPromise
}
const planKey = (ownerId: string, tenantId: string, studentId: string) => `${ownerId}:${tenantId}:${studentId}`
const mealKey = (ownerId: string, tenantId: string, studentId: string, versionId: string, day: string, mealId: string) => `${ownerId}:${tenantId}:${studentId}:${versionId}:${day}:${mealId}`
export async function cacheNutritionPlan(ownerId: string, tenantId: string, studentId: string, plan: PublishedNutrition) {
  await (await db()).put('plans', { key: planKey(ownerId, tenantId, studentId), plan })
}
export async function cachedNutritionPlan(ownerId: string, tenantId: string, studentId: string) {
  return (await (await db()).get('plans', planKey(ownerId, tenantId, studentId)))?.plan ?? null
}
export async function localNutritionMeals(ownerId: string, tenantId: string, studentId: string, versionId: string, day: string) {
  const rows = await (await db()).getAll('meals')
  return rows.filter(row => row.ownerId === ownerId && row.tenantId === tenantId && row.studentId === studentId && row.versionId === versionId && row.day === day)
}
export async function queueNutritionMeal(ownerId: string, tenantId: string, studentId: string, versionId: string, day: string, mealId: string, state: MealState) {
  const database = await db()
  const tx = database.transaction(['meals', 'pending'], 'readwrite')
  const operation: PendingMeal = { operationId: crypto.randomUUID(), ownerId, tenantId, studentId, versionId, mealId, day, state, error: null, createdAt: new Date().toISOString() }
  await tx.objectStore('meals').put({ key: mealKey(ownerId, tenantId, studentId, versionId, day, mealId), ownerId, tenantId, studentId, versionId, day, mealId, state, pending: true })
  await tx.objectStore('pending').put(operation)
  await tx.done
  return operation
}
export async function pendingNutritionMeals(ownerId: string, tenantId: string) {
  return (await (await db()).getAll('pending')).filter(row => row.ownerId === ownerId && row.tenantId === tenantId).sort((a,b) => a.createdAt.localeCompare(b.createdAt))
}
export async function confirmNutritionMeal(operation: PendingMeal) {
  const database = await db()
  const tx = database.transaction(['meals', 'pending'], 'readwrite')
  await tx.objectStore('pending').delete(operation.operationId)
  const key = mealKey(operation.ownerId, operation.tenantId, operation.studentId, operation.versionId, operation.day, operation.mealId)
  const row = await tx.objectStore('meals').get(key)
  if (row && row.state === operation.state) await tx.objectStore('meals').put({ ...row, pending: false })
  await tx.done
}
export async function failNutritionMeal(operation: PendingMeal, error: string) {
  await (await db()).put('pending', { ...operation, error })
}
// Test-only reset. Product flows must keep plans and pending operations.
export async function resetNutritionStoreForTests() {
  const database = await db()
  const tx = database.transaction(['plans','meals','pending'], 'readwrite')
  await Promise.all((['plans','meals','pending'] as const).map(name => tx.objectStore(name).clear()))
  await tx.done
}
