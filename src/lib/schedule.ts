import { getCollection, type CollectionEntry } from 'astro:content';

export const TZ = 'Europe/London';
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Offset (ms) of Europe/London from UTC at a given instant. */
function londonOffset(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - at.getTime();
}

/** Convert a UK wall-clock "YYYY-MM-DDTHH:MM" into a real instant. */
export function ukTime(local: string): Date {
  const [d, t = '00:00'] = local.split('T');
  const [y, m, day] = d.split('-').map(Number);
  const [hh, mm] = t.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, day, hh, mm);
  return new Date(guess - londonOffset(new Date(guess)));
}

/** Today's date in the UK as YYYY-MM-DD. */
function ukDateString(at: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}

function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export const fmt = {
  date: (d: Date) => d.toLocaleDateString('en-GB', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
  shortDate: (d: Date) => d.toLocaleDateString('en-GB', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' }),
  day: (d: Date) => d.toLocaleDateString('en-GB', { timeZone: TZ, day: 'numeric' }),
  month: (d: Date) => d.toLocaleDateString('en-GB', { timeZone: TZ, month: 'short' }).toUpperCase(),
  weekday: (d: Date) => d.toLocaleDateString('en-GB', { timeZone: TZ, weekday: 'long' }),
  time: (d: Date) => d.toLocaleTimeString('en-GB', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase(),
};

/** A single dated happening shown on cards — either a one-off event or an occurrence of a regular activity. */
export interface Occurrence {
  key: string;
  title: string;
  summary: string;
  category: string;
  start: Date;
  end: Date;
  hasTime: boolean;
  timeLabel?: string;
  location: string;
  online: boolean;
  href: string;
  external: boolean;
  registrationUrl?: string;
  featured: boolean;
  image?: string;
  imageAlt?: string;
  recurring: boolean;
  sample?: boolean;
  poster?: boolean;
  audience?: string;
  /** "<schedule id>|YYYY-MM-DD": the regular activity this one-off event stands in for. */
  replaces?: string;
}

export async function getPublishedEvents() {
  return (await getCollection('events', ({ data }) => !data.draft && !data.sample));
}

function eventToOccurrence(e: CollectionEntry<'events'>): Occurrence {
  const tbc = e.data.timeTBC;
  const day = e.data.start.slice(0, 10);
  const start = tbc ? ukTime(`${day}T00:00`) : ukTime(e.data.start);
  const end = tbc ? ukTime(`${(e.data.end ?? e.data.start).slice(0, 10)}T23:59`)
    : e.data.end ? ukTime(e.data.end) : new Date(start.getTime() + 2 * 3600_000);
  return {
    key: `event-${e.id}`, title: e.data.title, summary: e.data.summary, category: e.data.category,
    start, end, hasTime: !tbc, timeLabel: tbc ? 'Time to be confirmed' : undefined,
    audience: e.data.audience, replaces: e.data.replaces ? `${e.data.replaces}|${day}` : undefined,
    location: e.data.location, online: e.data.online,
    href: `/events/${e.id}`, external: false, registrationUrl: e.data.registrationUrl,
    featured: e.data.featured, image: e.data.image, imageAlt: e.data.imageAlt, recurring: false,
    sample: e.data.sample,
    poster: e.data.poster,
  };
}

/**
 * One-off events within a season (e.g. "2026-10-01" to "2026-12-31", inclusive, UK time).
 * Sample events are included only on the local dev server so the layout can be previewed.
 */
export async function getSeasonEvents(start: string, end: string): Promise<Occurrence[]> {
  const from = ukTime(`${start}T00:00`);
  const to = ukTime(`${addDays(end, 1)}T00:00`);
  const showSamples = import.meta.env.DEV;
  const events = await getCollection('events', ({ data }) => data.sample ? showSamples : !data.draft);
  return events
    .map(eventToOccurrence)
    .filter((o) => o.start < to && o.end > from)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

/**
 * Upcoming occurrences from `from` for `days` days. Rendered at build time with start/end
 * stamps; a small client script hides anything that has since finished (AC-EVT-04.1), so the
 * site stays correct between rebuilds. Schedule a daily rebuild in production.
 */
export async function getUpcoming({ from = new Date(), days = 60 } = {}): Promise<Occurrence[]> {
  const schedule = await getCollection('schedule', ({ data }) => !data.draft);
  const out: Occurrence[] = [];
  const today = ukDateString(from);
  const horizon = ukTime(`${addDays(today, days)}T00:00`);
  const allOneOffs = (await getPublishedEvents()).map(eventToOccurrence);
  const oneOffs = allOneOffs.filter((o) => o.end > from && o.start < horizon);
  // Special events can stand in for a regular activity on their date (e.g. Jazz Sunday replaces the Sunday service).
  // Uses every event, including ones that have finished today, so a replaced service never reappears.
  const replacedByEvent = new Set(allOneOffs.map((o) => o.replaces).filter(Boolean));

  for (let i = 0; i < days; i++) {
    const ymd = addDays(today, i);
    const [y, m, d] = ymd.split('-').map(Number);
    const weekday = DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
    const weekOfMonth = Math.ceil(d / 7);
    const todays = schedule.filter((s) => s.data.day === weekday && (!s.data.weekOfMonth || s.data.weekOfMonth === weekOfMonth));
    const replaced = new Set(todays.map((s) => s.data.replaces).filter(Boolean));
    for (const s of todays) {
      if (replaced.has(s.id)) continue;
      if (replacedByEvent.has(`${s.id}|${ymd}`) || (s.data.replaces && replacedByEvent.has(`${s.data.replaces}|${ymd}`))) continue;
      const hasTime = !!s.data.time;
      const start = ukTime(`${ymd}T${s.data.time ?? '00:00'}`);
      const end = hasTime ? new Date(start.getTime() + s.data.durationMins * 60_000) : ukTime(`${ymd}T23:59`);
      const link = s.data.link ?? '/events';
      const monthly = (s.data.monthlyImages ?? []).find((m) => m.month === ymd.slice(0, 7));
      out.push({
        key: `${s.id}-${ymd}`, title: s.data.title, summary: s.data.summary, category: s.data.category,
        start, end, hasTime, timeLabel: s.data.timeLabel, location: s.data.location, online: s.data.online,
        href: link, external: /^https?:/.test(link), featured: s.data.featured, recurring: true,
        image: monthly?.image ?? s.data.image, imageAlt: monthly?.imageAlt ?? s.data.imageAlt,
        poster: monthly ? monthly.poster : s.data.poster,
      });
    }
  }

  out.push(...oneOffs);
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** The next main Sunday service (Thanksgiving on first Sundays, or a special event standing in for it). */
export async function getNextSunday(from = new Date()) {
  const upcoming = await getUpcoming({ from, days: 8 });
  return upcoming.find((o) => o.featured && fmt.weekday(o.start) === 'Sunday' && o.end > from);
}

export { eventToOccurrence };
