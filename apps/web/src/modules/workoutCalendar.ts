export type WorkoutWeekSession = {
  version_id: string
  day_id?: string | null
  week_start?: string | null
  status: string
}

export function shiftWorkoutWeek(iso: string, weeks: number) {
  const date = new Date(`${iso}T12:00:00`)
  date.setDate(date.getDate() + weeks * 7)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function weekIsClosed(week: string, dayIds: string[], sessions: WorkoutWeekSession[]) {
  return dayIds.length > 0 && dayIds.every(dayId => sessions.some(session =>
    session.week_start === week
    && session.day_id === dayId
    && (session.status === 'COMPLETED' || session.status === 'PARTIAL')))
}

export function availableTrainingWeek({
  calendarWeek,
  firstWeek,
  lastWeek,
  dayIds,
  sessions,
}: {
  calendarWeek: string
  firstWeek: string
  lastWeek?: string
  dayIds: string[]
  sessions: WorkoutWeekSession[]
}) {
  let available = calendarWeek < firstWeek ? firstWeek : calendarWeek
  if (lastWeek && available > lastWeek) available = lastWeek

  // A legacy plan may not have a prescribed duration. The guard prevents
  // malformed imported data from causing an unbounded scan.
  for (let count = 0; count < 104 && weekIsClosed(available, dayIds, sessions); count += 1) {
    const next = shiftWorkoutWeek(available, 1)
    if (lastWeek && next > lastWeek) break
    available = next
  }
  return available
}
