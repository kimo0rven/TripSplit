/** One day's worth of records, newest day first when the input is newest first. */
export interface DayGroup<T> {
  /** The day key, as YYYY-MM-DD. */
  day: string;
  items: T[];
}

/**
 * Splits a list into day sections.
 *
 * The list is expected to arrive sorted by day already (every list in the app is
 * newest first), so this only walks it once and starts a new section each time
 * the day changes. Records with no day at all land in one unnamed section rather
 * than vanishing.
 */
export const groupByDay = <T>(items: T[], dayOf: (item: T) => string): DayGroup<T>[] => {
  const groups: DayGroup<T>[] = [];

  for (const item of items) {
    const day = dayOf(item) || '';
    const last = groups[groups.length - 1];

    if (last && last.day === day) last.items.push(item);
    else groups.push({ day, items: [item] });
  }

  return groups;
};
