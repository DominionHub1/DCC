// A Sunday sermon: preached on a Sunday, in a Sunday or special service (e.g. Thanksgiving) — not midweek teaching.
export function isSundaySermon(m: { date: string; type: string }): boolean {
  const sunday = new Date(`${m.date}T12:00:00Z`).getUTCDay() === 0;
  return sunday && m.type !== 'Discipleship' && m.type !== 'Midweek';
}
