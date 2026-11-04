import { beforeEach, describe, expect, it } from 'vitest'
import { cacheNutritionPlan, cachedNutritionPlan, confirmNutritionMeal, localNutritionMeals, pendingNutritionMeals, queueNutritionMeal, resetNutritionStoreForTests } from './nutritionStore'
import type { PublishedNutrition } from '../services/nutrition'

const plan: PublishedNutrition = { id: 'version-a', version: 1, snapshot: { title: 'Plano A', guidance: '', meals: [] }, published_at: '2026-11-03T00:00:00Z', nutritionist_name: 'Nutricionista', crn: 'CRN 00000' }
beforeEach(async () => resetNutritionStoreForTests())

describe('alimentação no dispositivo', () => {
  it('isola plano e lançamentos por conta e tenant', async () => {
    await cacheNutritionPlan('user-a','tenant-a','student-a',plan)
    expect((await cachedNutritionPlan('user-a','tenant-a','student-a'))?.id).toBe('version-a')
    expect(await cachedNutritionPlan('user-b','tenant-a','student-a')).toBeNull()
    const operation = await queueNutritionMeal('user-a','tenant-a','student-a','version-a','2026-11-03','meal-a','FEITA')
    expect((await localNutritionMeals('user-a','tenant-a','student-a','version-a','2026-11-03'))[0].pending).toBe(true)
    expect(await pendingNutritionMeals('user-b','tenant-a')).toEqual([])
    expect(await pendingNutritionMeals('user-a','tenant-b')).toEqual([])
    expect((await pendingNutritionMeals('user-a','tenant-a'))[0].operationId).toBe(operation.operationId)
    await confirmNutritionMeal(operation)
    expect(await pendingNutritionMeals('user-a','tenant-a')).toEqual([])
    expect((await localNutritionMeals('user-a','tenant-a','student-a','version-a','2026-11-03'))[0].pending).toBe(false)
  })
})
