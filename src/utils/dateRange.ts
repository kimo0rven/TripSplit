/**
 * Picking a trip's dates on one calendar.
 *
 * Kept free of imports so it can be tested with `node --test`. Days are
 * YYYY-MM-DD strings, which sort in date order as plain text.
 */

export interface DayRange {
  /** '' when not chosen yet. */
  start: string;
  /** '' when not chosen: a one-day trip, or the end is still to be picked. */
  end: string;
}

/**
 * What a tap on `day` does, given which end is being picked:
 *   - picking the start: it is the new start, and the end is cleared so the
 *     next tap picks it (this is also how a finished range starts over);
 *   - picking the end: it is the end. An earlier day swaps with the start, and
 *     the start itself keeps a one-day trip.
 *
 * `done` is true once a tap finishes the range, so the calendar can close.
 */
export const pickDay = (
  range: DayRange,
  day: string,
  picking: 'start' | 'end',
): { range: DayRange; done: boolean } => {
  if (picking === 'start' || !range.start) return { range: { start: day, end: '' }, done: false };
  if (day === range.start) return { range: { start: day, end: '' }, done: true };
  return day > range.start
    ? { range: { start: range.start, end: day }, done: true }
    : { range: { start: day, end: range.start }, done: true };
};

/** Where a day sits in the range, for drawing the band between the ends. */
export type RangePlace = 'start' | 'end' | 'single' | 'inside' | 'outside';

export const placeInRange = (range: DayRange, day: string): RangePlace => {
  if (!range.start) return 'outside';
  if (!range.end || range.end === range.start) return day === range.start ? 'single' : 'outside';
  if (day === range.start) return 'start';
  if (day === range.end) return 'end';
  return day > range.start && day < range.end ? 'inside' : 'outside';
};

/** How many days the range covers, ends included; 1 for a one-day trip. */
export const rangeLength = (range: DayRange): number => {
  if (!range.start) return 0;
  if (!range.end) return 1;
  const [a, b] = [range.start, range.end].map((key) => {
    const [y, m, d] = key.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  });
  return Math.round((b - a) / 86_400_000) + 1;
};

/** Every day from start to end as YYYY-MM-DD, ends included; [] without a start. */
export const daysOf = (range: DayRange): string[] => {
  if (!range.start) return [];
  const [y, m, d] = range.start.split('-').map(Number);
  const out: string[] = [];
  const count = Math.max(1, rangeLength(range));
  for (let i = 0; i < count && i < 366; i += 1) {
    const day = new Date(Date.UTC(y, m - 1, d + i));
    out.push(
      `${day.getUTCFullYear()}-${String(day.getUTCMonth() + 1).padStart(2, '0')}-${String(
        day.getUTCDate(),
      ).padStart(2, '0')}`,
    );
  }
  return out;
};

/** Whether a day falls inside the range; any day counts when there is no range. */
export const isInRange = (range: DayRange, day: string): boolean => {
  if (!range.start) return true;
  return day >= range.start && day <= (range.end || range.start);
};
