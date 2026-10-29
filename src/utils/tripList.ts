/** Pure helpers for the Trips page: status, search and sort. */

export type TripFilter =
  | 'all'
  | 'upcoming'
  | 'ongoing'
  | 'past'
  | 'settled'
  | 'archived'
  /** Trips you own. */
  | 'created'
  /** Trips someone else owns and you are only a member of. */
  | 'joined';
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

/**
 * Which trip the dashboard should open, given the remembered id.
 *
 * The remembered trip wins while it is still open. Otherwise the first open
 * trip is used, and `trips` must already be newest first so that means the
 * newest open trip.
 *
 * `cleared` means the person took the last trip off their dashboard on
 * purpose. That answer beats both rules and leaves no active trip at all -
 * a trip that is still months away should not claim the dashboard just because
 * it happens to be the newest one open. Only picking a trip again brings one
 * back.
 *
 * The result is expected to be remembered by the caller: an automatic pick is
 * still a decision, and remembering it is what stops a trip created later
 * from quietly taking the dashboard over.
 */
export function resolveActiveTripId(
  trips: { id: string; startDate?: string; endDate?: string }[],
  storedId: string,
  today: string,
  cleared = false,
): string {
  if (cleared) return '';
  const openTrips = trips.filter((trip) => !tripIsOver(trip, today));
  const rememberedOpen = storedId ? openTrips.find((trip) => trip.id === storedId) : undefined;
  return rememberedOpen?.id ?? openTrips[0]?.id ?? '';
}

export interface ListableTrip {
  id: string;
  name: string;
  createdAt: string;
  startDate?: string;
  endDate?: string;
  totalSpent?: number;
  members?: Record<string, { role?: string }>;
}

export function filterTrips<T extends ListableTrip>(
  trips: T[],
  options: {
    filter: TripFilter;
    query: string;
    archived: Record<string, boolean>;
    summaries: Record<string, TripSummary>;
    today: string;
    /** Whose trips these are, so "Created" and "Joined" can be told apart. */
    uid?: string;
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
      case 'created':
        return !isArchived && !!options.uid && trip.members?.[options.uid]?.role === 'owner';
      case 'joined':
        // Anything that is not the owner counts as joined. Checking for
        // `role === 'member'` exactly would drop trips whose member record has
        // no role at all, leaving an owner invisible in both Created and
        // Joined.
        return (
          !isArchived &&
          !!options.uid &&
          !!trip.members?.[options.uid] &&
          trip.members[options.uid].role !== 'owner'
        );
      default:
        return !isArchived;
    }
  });
}

/**
 * Moves the active trip to the front, leaving every other trip in the order it
 * arrived in. The active trip is the one the dashboard and the quick actions
 * work on, so it belongs at the top of the Trips page.
 *
 * Run this after filtering: a trip the filter removed is simply not in the
 * list, and nothing is pinned in that case. The sort order still decides
 * everything below the active row.
 */
export function pinActiveTrip<T extends { id: string }>(trips: T[], activeId: string): T[] {
  if (!activeId) return trips;
  const at = trips.findIndex((trip) => trip.id === activeId);
  // Already first, absent, or no active trip: the order is already right.
  if (at <= 0) return trips;
  const rest = [...trips];
  const [active] = rest.splice(at, 1);
  rest.unshift(active);
  return rest;
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
