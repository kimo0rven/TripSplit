/**
 * The plan-timing helpers.
 *
 * These decide what the Plan tab calls "next", so they are kept free of React
 * and of any import at all - the test runner loads this file directly, and an
 * `@/` alias would not resolve there.
 */

/** The little of a plan this file needs. */
export interface PlannedThing {
  day: string;
  time?: string;
  endTime?: string;
}

/** Where a plan sits relative to the clock right now. */
export type PlanTiming =
  /** The calendar day has not arrived yet. */
  | { state: 'upcoming'; startsInMinutes: number }
  /** Its day is today and its start time has not been reached. */
  | { state: 'today'; startsInMinutes: number }
  /** It is happening right now. */
  | { state: 'now'; endsInMinutes?: number }
  /** Its start time has passed and it is not running any more. */
  | { state: 'past' };

/** The local date as YYYY-MM-DD, matching the day key a plan stores. */
const localDayKey = (date: Date): string =>
  `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`;

/**
 * Reads a stored "HH:MM" clock time as minutes past midnight.
 *
 * Returns null when nothing usable is stored, so a plan with no time is told
 * apart from one set at midnight.
 */
export const toMinutes = (time?: string): number | null => {
  const match = /^(\d{1,2}):(\d{2})$/.exec((time || '').trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
};

/** The number of whole days from one day key to another. */
const daysBetween = (from: string, to: string): number => {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  if (!fy || !fm || !fd || !ty || !tm || !td) return 0;

  // Midday avoids the hour a daylight-saving change can skip or repeat.
  const a = Date.UTC(fy, fm - 1, fd, 12);
  const b = Date.UTC(ty, tm - 1, td, 12);
  return Math.round((b - a) / 86_400_000);
};

/**
 * Works out where a plan sits relative to `now`.
 *
 * A plan with no time is a moment at some point during the day, so it counts
 * as today rather than as something that already happened.
 */
export const planTiming = <T extends PlannedThing>(item: T, now: Date = new Date()): PlanTiming => {
  const dayOffset = daysBetween(localDayKey(now), item.day);
  const startMinutes = toMinutes(item.time);
  const endMinutes = toMinutes(item.endTime);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // Running needs a real range: an end at or before the start is ignored.
  const running = startMinutes !== null && endMinutes !== null && endMinutes > startMinutes;

  if (dayOffset > 0) {
    const untilStart = startMinutes === null ? 0 : startMinutes - nowMinutes;
    return { state: 'upcoming', startsInMinutes: dayOffset * 1440 + untilStart };
  }

  if (dayOffset < 0) return { state: 'past' };

  if (startMinutes === null) return { state: 'today', startsInMinutes: 0 };
  if (nowMinutes < startMinutes)
    return { state: 'today', startsInMinutes: startMinutes - nowMinutes };
  if (running && nowMinutes < (endMinutes as number)) {
    return { state: 'now', endsInMinutes: (endMinutes as number) - nowMinutes };
  }
  return { state: 'past' };
};

/** True when the plan is still to come or happening, rather than over. */
export const isPlanAhead = <T extends PlannedThing>(item: T, now: Date = new Date()): boolean =>
  planTiming(item, now).state !== 'past';

/**
 * The plan to put at the top of the tab: the one happening right now, or the
 * first still to come.
 *
 * The caller passes the list in the service's order (day, then time), so the
 * first match is the soonest.
 */
export const nextPlan = <T extends PlannedThing>(items: T[], now: Date = new Date()): T | null => {
  const running = items.find((item) => planTiming(item, now).state === 'now');
  if (running) return running;
  return items.find((item) => isPlanAhead(item, now)) ?? null;
};

/** "in 3 days", "in 2 hours", "in 15 min" - short enough for a card corner. */
export const startsIn = (minutes: number): string => {
  if (minutes <= 0) return 'now';
  if (minutes < 60) return `in ${minutes} min`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `in ${hours} ${hours === 1 ? 'hour' : 'hours'}`;

  const days = Math.round(hours / 24);
  return `in ${days} ${days === 1 ? 'day' : 'days'}`;
};

/** "Ends in 40 min", or "Happening now" when no end time was given. */
export const runningFor = (endsInMinutes?: number): string => {
  if (endsInMinutes === undefined) return 'Happening now';
  if (endsInMinutes < 60) return `Ends in ${endsInMinutes} min`;
  const hours = Math.round(endsInMinutes / 60);
  return `Ends in ${hours} ${hours === 1 ? 'hour' : 'hours'}`;
};

/**
 * Where a plan's place can be opened in a map.
 *
 * The phone's own map app does the work, so no mapping package is needed. A
 * written place name becomes a search, since that is all a plan stores.
 */
export const mapUrlFor = (location: string): string => {
  const query = (location || '').trim();
  if (!query) return '';
  if (/^https?:\/\//i.test(query)) return query;
  return `https://maps.google.com/?q=${encodeURIComponent(query)}`;
};
