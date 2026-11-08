import { describe, expect, it } from 'vitest'
import { availableTrainingWeek } from './workoutCalendar'

const days = ['day-1', 'day-2', 'day-3']
const terminal = (week: string, statuses = ['COMPLETED', 'PARTIAL', 'COMPLETED']) => days.map((day_id, index) => ({
  version_id: 'version-1', day_id, week_start: week, status: statuses[index],
}))

describe('availableTrainingWeek', () => {
  it('keeps the current sequence while at least one day remains open', () => {
    expect(availableTrainingWeek({
      calendarWeek: '2026-11-02', firstWeek: '2026-11-02', dayIds: days,
      sessions: terminal('2026-11-02').slice(0, 2),
    })).toBe('2026-11-02')
  })

  it('unlocks the next sequence when complete and partial days are all terminal', () => {
    expect(availableTrainingWeek({
      calendarWeek: '2026-11-02', firstWeek: '2026-11-02', dayIds: days,
      sessions: terminal('2026-11-02'),
    })).toBe('2026-11-09')
  })

  it('advances through consecutive closed sequences', () => {
    expect(availableTrainingWeek({
      calendarWeek: '2026-11-02', firstWeek: '2026-11-02', dayIds: days,
      sessions: [...terminal('2026-11-02'), ...terminal('2026-11-09')],
    })).toBe('2026-11-16')
  })

  it('does not advance beyond the prescribed duration', () => {
    expect(availableTrainingWeek({
      calendarWeek: '2026-11-09', firstWeek: '2026-11-02', lastWeek: '2026-11-09', dayIds: days,
      sessions: terminal('2026-11-09'),
    })).toBe('2026-11-09')
  })

  it('preserves the closed week when a newer prescription version is published', () => {
    expect(availableTrainingWeek({
      calendarWeek: '2026-11-02', firstWeek: '2026-11-02', dayIds: days,
      sessions: terminal('2026-11-02'),
    })).toBe('2026-11-09')
  })
})
