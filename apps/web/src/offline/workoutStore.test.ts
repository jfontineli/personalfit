import { beforeEach, describe, expect, it } from 'vitest'
import { cacheWorkout, confirmWorkoutOperation, getCachedWorkout, getLocalSession, pendingWorkoutOperations, resetWorkoutStoreForTests, saveLocalWorkoutSession } from './workoutStore'
import type { WorkoutVersion } from '../services/workouts'

const version: WorkoutVersion = { id: 'version-1', tenant_id: 'tenant-a', plan_id: 'plan-1', version_number: 1,
  published_at: '2026-10-01T00:00:00Z', snapshot: { title: 'Treino A', days: [{ id: 'day-1', name: 'Dia A', items: [] }] } }
beforeEach(async () => { await resetWorkoutStoreForTests() })

describe('execução local do treino', () => {
  it('mantém sessões e filas separadas por dia e semana', async () => {
    const planned: WorkoutVersion = { ...version, snapshot: { ...version.snapshot, days: [
      { id: 'day-1', name: 'Dia A', items: [{ id: 'item-1', exerciseId: 'exercise-1', name: 'Exercício A', sets: 1, reps: '8', instructions: '', videoUrl: null }] },
      { id: 'day-2', name: 'Dia B', items: [{ id: 'item-2', exerciseId: 'exercise-2', name: 'Exercício B', sets: 1, reps: '8', instructions: '', videoUrl: null }] },
    ] } }
    await saveLocalWorkoutSession('user-a','tenant-a','student-a',planned,'session-a',[], 'IN_PROGRESS','day-1','2026-11-02')
    await saveLocalWorkoutSession('user-a','tenant-a','student-a',planned,'session-b',[], 'IN_PROGRESS','day-2','2026-11-02')
    await saveLocalWorkoutSession('user-a','tenant-a','student-a',planned,'session-c',[], 'IN_PROGRESS','day-1','2026-11-09')
    expect((await getLocalSession('user-a','tenant-a','student-a','day-1','2026-11-02'))?.id).toBe('session-a')
    expect((await getLocalSession('user-a','tenant-a','student-a','day-2','2026-11-02'))?.id).toBe('session-b')
    expect((await getLocalSession('user-a','tenant-a','student-a','day-1','2026-11-09'))?.id).toBe('session-c')
    await expect(saveLocalWorkoutSession('user-a','tenant-a','student-a',planned,'session-a',
      [{ itemId: 'item-2', setNumber: 1, reps: 8, loadKg: 10 }], 'IN_PROGRESS','day-1','2026-11-02')).rejects.toThrow()
    expect(await pendingWorkoutOperations('user-a','tenant-a')).toHaveLength(3)
  })
  it('isola a prescrição e a fila pelo usuário e tenant', async () => {
    await cacheWorkout('user-a', 'tenant-a', 'student-a', version)
    expect((await getCachedWorkout('user-a','tenant-a','student-a'))?.version.id).toBe(version.id)
    expect(await getCachedWorkout('user-b','tenant-a','student-a')).toBeUndefined()
    await saveLocalWorkoutSession('user-a','tenant-a','student-a',version,'session-1',[],'IN_PROGRESS')
    expect((await pendingWorkoutOperations('user-a','tenant-a'))).toHaveLength(1)
    expect(await pendingWorkoutOperations('user-b','tenant-a')).toEqual([])
    expect(await getLocalSession('user-b','tenant-a','student-a')).toBeUndefined()
  })

  it('preserva revisões e operações até confirmação individual', async () => {
    const first = await saveLocalWorkoutSession('user-a','tenant-a','student-a',version,'session-1',[],'IN_PROGRESS')
    const second = await saveLocalWorkoutSession('user-a','tenant-a','student-a',version,'session-1',
      [{ itemId: 'item-1', setNumber: 1, reps: 10, loadKg: 20 }], 'IN_PROGRESS')
    expect(first.revision).toBe(1)
    expect(second.revision).toBe(2)
    expect((await getLocalSession('user-a','tenant-a','student-a'))?.version.id).toBe(version.id)
    const operations = await pendingWorkoutOperations('user-a','tenant-a')
    expect(operations.map(item => item.session.revision)).toEqual([1, 2])
    await confirmWorkoutOperation(operations[0].id)
    expect((await pendingWorkoutOperations('user-a','tenant-a')).map(item => item.session.revision)).toEqual([2])
  })
})
