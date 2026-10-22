/** Pure helpers behind the Statistics sheet. Amounts are in each trip's own currency. */

export type StatsRange = '1m' | '3m' | 'all';

export const RANGE_LABEL: Record<StatsRange, string> = {
  '1m': 'This month',
  '3m': '3 months',
  all: 'All time',
};

export interface ShareEntry {
  tripId: string;
  tripName: string;
  currency: string;
  title: string;
  /** YYYY-MM-DD */
  spentOn: string;
  /** The whole expense. */
  amount: number;
  /** The user's part of it. */
  share: number;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const monthKey = (date: Date) => date.getFullYear() + '-' + pad(date.getMonth() + 1);

/** The first day a range includes, as YYYY-MM-DD, or '' for no limit. */
export function rangeStart(range: StatsRange, now: Date): string {
  if (range === 'all') return '';
  const back = range === '1m' ? 0 : 2;
  const first = new Date(now.getFullYear(), now.getMonth() - back, 1);
  return monthKey(first) + '-01';
}

export const inRange = (entries: ShareEntry[], range: StatsRange, now: Date): ShareEntry[] => {
  const start = rangeStart(range, now);
  return start ? entries.filter((entry) => entry.spentOn >= start) : entries;
};

/** The currency the user spends the most in; trend and records use it so amounts compare. */
export function mainCurrency(entries: ShareEntry[]): string {
  const totals: Record<string, number> = {};
  entries.forEach((e) => (totals[e.currency] = (totals[e.currency] ?? 0) + e.share));
  return Object.entries(totals).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
}

export interface MonthPoint {
  key: string;
  label: string;
  total: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The user's share per month for the last `months` months, oldest first, empty months included. */
export function monthlyTrend(
  entries: ShareEntry[],
  currency: string,
  now: Date,
  months = 6,
): MonthPoint[] {
  const points: MonthPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    points.push({ key: monthKey(date), label: MONTHS[date.getMonth()], total: 0 });
  }
  entries.forEach((entry) => {
    if (entry.currency !== currency) return;
    const point = points.find((p) => entry.spentOn.startsWith(p.key));
    if (point) point.total += entry.share;
  });
  return points;
}

/** Last month's change as a fraction (0.25 = 25% more), or null when there is nothing to compare. */
export function monthChange(points: MonthPoint[]): number | null {
  if (points.length < 2) return null;
  const [previous, current] = [points[points.length - 2].total, points[points.length - 1].total];
  return previous > 0 ? (current - previous) / previous : null;
}

/** The single largest expense the user was part of, in `currency`. */
export function biggestExpense(entries: ShareEntry[], currency: string): ShareEntry | null {
  return (
    entries.filter((entry) => entry.currency === currency).sort((a, b) => b.amount - a.amount)[0] ??
    null
  );
}

export interface TripSpend {
  tripId: string;
  tripName: string;
  currency: string;
  share: number;
}

/** What the user spent on each trip, biggest first. */
export function tripComparison(entries: ShareEntry[]): TripSpend[] {
  const byTrip: Record<string, TripSpend> = {};
  entries.forEach((entry) => {
    const row = (byTrip[entry.tripId] ??= {
      tripId: entry.tripId,
      tripName: entry.tripName,
      currency: entry.currency,
      share: 0,
    });
    row.share += entry.share;
  });
  return Object.values(byTrip).sort((a, b) => b.share - a.share);
}

export interface PersonBalance {
  id: string;
  name: string;
  currency: string;
  amount: number;
}

/**
 * Adds up debts between the user and each other person across trips. `edges`
 * are one trip's simplified payments; anything not involving the user is ignored.
 */
export function addDebts(
  into: Record<string, PersonBalance>,
  userId: string,
  currency: string,
  names: Record<string, string>,
  edges: { from: string; to: string; amount: number }[],
): void {
  edges.forEach((edge) => {
    if (edge.from !== userId && edge.to !== userId) return;
    const other = edge.from === userId ? edge.to : edge.from;
    const signed = edge.to === userId ? edge.amount : -edge.amount;
    const key = other + '|' + currency;
    const row = (into[key] ??= { id: other, name: names[other] ?? 'Someone', currency, amount: 0 });
    row.amount += signed;
  });
}

/** Positive balances are owed to the user, negative ones are owed by them. */
export function topBalances(all: Record<string, PersonBalance>, owedToMe: boolean, limit = 3) {
  return Object.values(all)
    .filter((row) => (owedToMe ? row.amount > 0.009 : row.amount < -0.009))
    .sort((a, b) => (owedToMe ? b.amount - a.amount : a.amount - b.amount))
    .slice(0, limit);
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export interface Habits {
  count: number;
  averagePerExpense: number;
  averagePerDay: number;
  busiestWeekday: string;
  priciestDay: { date: string; total: number };
}

/** Patterns in the user's own share, for one currency. Null when there is nothing to describe. */
export function spendingHabits(entries: ShareEntry[], currency: string): Habits | null {
  const mine = entries.filter((entry) => entry.currency === currency);
  if (mine.length === 0) return null;

  const perDay: Record<string, number> = {};
  const perWeekday = new Array<number>(7).fill(0);
  let total = 0;
  mine.forEach((entry) => {
    perDay[entry.spentOn] = (perDay[entry.spentOn] ?? 0) + entry.share;
    const [y, m, d] = entry.spentOn.split('-').map(Number);
    perWeekday[new Date(y, m - 1, d).getDay()] += entry.share;
    total += entry.share;
  });

  const days = Object.entries(perDay).sort((a, b) => b[1] - a[1]);
  return {
    count: mine.length,
    averagePerExpense: total / mine.length,
    averagePerDay: total / days.length,
    busiestWeekday: WEEKDAYS[perWeekday.indexOf(Math.max(...perWeekday))],
    priciestDay: { date: days[0][0], total: days[0][1] },
  };
}
