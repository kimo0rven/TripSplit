/** Pure helpers for the Trips page: status, search and sort. */

export type TripFilter = 'all' | 'upcoming' | 'ongoing' | 'past' | 'settled' | 'archived';
export type TripSort = 'recent' | 'date' | 'newest' | 'name' | 'spent';

export interface TripSummary {
  /** Latest of the trip's creation, expenses and payments, in ms. */
  lastActivity: number;
  hasExpenses: boolean;
  /** Everyone is even and there is something that was split. */
  settled: boolean;
}

export type TripStatus = 'upcoming' | 'ongoing' | 'past';

/**
 * Where a trip is in time, from its own dates. `today` is YYYY-MM-DD. A trip
 * with a start but no end is a one-day event. A trip with no start date has no
 * status at all, rather than a guess.
 */
export function tripStatus(
  trip: { startDate?: string; endDate?: string },
  today: string,
): TripStatus | null {
  if (!trip.startDate) return null;
  const end = trip.endDate && trip.endDate >= trip.startDate ? trip.endDate : trip.startDate;
  if (today < trip.startDate) return 'upcoming';
  return today <= end ? 'ongoing' : 'past';
}

/**
 * Whether a trip is finished, from its own dates. `today` is YYYY-MM-DD.
 *
 * A trip is over on the day after its last date, so the last day of the trip
 * still counts as a day you can spend money on. A trip with no dates is never
 * over: nothing said when it happens, so it stays open.
 */
export function tripIsOver(trip: { startDate?: string; endDate?: string }, today: string): boolean {
  if (!trip.startDate) return false;
  const end = trip.endDate && trip.endDate >= trip.startDate ? trip.endDate : trip.startDate;
  return today > end;
}

export interface ListableTrip {
  id: string;
  name: string;
  createdAt: string;
  startDate?: string;
  endDate?: string;
  totalSpent?: number;
}

export function filterTrips<T extends ListableTrip>(
  trips: T[],
  options: {
    filter: TripFilter;
    query: string;
    archived: Record<string, boolean>;
    summaries: Record<string, TripSummary>;
    today: string;
  },
): T[] {
  const query = options.query.trim().toLowerCase();
  return trips.filter((trip) => {
    if (query && !trip.name.toLowerCase().includes(query)) return false;
    const isArchived = !!options.archived[trip.id];
    const summary = options.summaries[trip.id];
    switch (options.filter) {
      case 'archived':
        return isArchived;
      case 'upcoming':
      case 'ongoing':
      case 'past':
        return !isArchived && tripStatus(trip, options.today) === options.filter;
      case 'settled':
        return !isArchived && !!summary?.settled;
      default:
        return !isArchived;
    }
  });
}

export function sortTrips<T extends ListableTrip>(
  trips: T[],
  sort: TripSort,
  summaries: Record<string, TripSummary>,
): T[] {
  const created = (t: T) => new Date(t.createdAt).getTime() || 0;
  const activity = (t: T) => summaries[t.id]?.lastActivity ?? created(t);
  const copy = [...trips];
  switch (sort) {
    case 'name':
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    case 'date':
      // Trips with dates first, soonest start first; undated ones after, newest first.
      return copy.sort((a, b) => {
        if (a.startDate && b.startDate) return a.startDate.localeCompare(b.startDate);
        if (a.startDate || b.startDate) return a.startDate ? -1 : 1;
        return created(b) - created(a);
      });
    case 'newest':
      return copy.sort((a, b) => created(b) - created(a));
    case 'spent':
      return copy.sort((a, b) => (b.totalSpent ?? 0) - (a.totalSpent ?? 0));
    default:
      return copy.sort((a, b) => activity(b) - activity(a));
  }
}
