/**
 * The numbers behind the Reports charts. Kept free of imports so it can be
 * tested with `node --test`; the screens only draw what comes out of here.
 */

interface ExpenseLike {
  amount: number;
  category?: string;
  spentOn: string;
  spentTime?: string;
  paidBy?: Record<string, number>;
  shares?: Record<string, number>;
}

interface PaymentLike {
  from: string;
  to: string;
  amount: number;
  status?: string;
  settledOn?: string;
  createdAt?: string;
}

/** Distinct colours for the biggest categories; everything else is "Other". */
export const CHART_COLOURS = ['#FEBB1B', '#2F80ED', '#7B4BD6', '#1E874B', '#E5533D'];
export const OTHER_COLOUR = '#B8B8B8';
export const OTHER_KEY = '__other';

const cents = (value: number) => Math.round((Number(value) || 0) * 100);
const fromCents = (value: number) => value / 100;

/** Every day from `from` to `to`, inclusive, as YYYY-MM-DD. */
export const daysBetween = (from: string, to: string): string[] => {
  const days: string[] = [];
  const start = Date.parse(from + 'T00:00:00Z');
  const end = Date.parse(to + 'T00:00:00Z');
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return days;
  for (let at = start; at <= end && days.length < 400; at += 86_400_000) {
    days.push(new Date(at).toISOString().slice(0, 10));
  }
  return days;
};

/**
 * The days a trip's charts cover: the trip's own dates, stretched to take in
 * any expense recorded outside them. A trip without dates uses its expenses.
 */
export const chartDays = (
  trip: { startDate?: string; endDate?: string },
  expenses: { spentOn: string }[],
): string[] => {
  const spent = expenses
    .map((expense) => expense.spentOn)
    .filter(Boolean)
    .sort();
  const starts = [trip.startDate, spent[0]].filter(Boolean) as string[];
  const ends = [trip.endDate || trip.startDate, spent[spent.length - 1]].filter(
    Boolean,
  ) as string[];
  if (!starts.length || !ends.length) return [];
  return daysBetween(starts.sort()[0], ends.sort()[ends.length - 1]);
};

/**
 * The categories worth their own colour: the biggest five by total, in order.
 * The rest are drawn together as "Other".
 */
export const topCategories = (expenses: ExpenseLike[], limit = CHART_COLOURS.length): string[] => {
  const totals: Record<string, number> = {};
  expenses.forEach((expense) => {
    const key = expense.category || 'other';
    totals[key] = (totals[key] ?? 0) + cents(expense.amount);
  });
  return Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key]) => key);
};

export const colourFor = (category: string, top: string[]): string => {
  const index = top.indexOf(category);
  return index >= 0 ? CHART_COLOURS[index % CHART_COLOURS.length] : OTHER_COLOUR;
};

export interface DayBar {
  day: string;
  total: number;
  /** The day's spend per category, biggest categories first, "Other" last. */
  parts: { key: string; amount: number }[];
}

/** One bar per day, split into the top categories. Days with nothing are zero. */
export const dailyBars = (expenses: ExpenseLike[], days: string[], top: string[]): DayBar[] =>
  days.map((day) => {
    const byKey: Record<string, number> = {};
    expenses
      .filter((expense) => expense.spentOn === day)
      .forEach((expense) => {
        const raw = expense.category || 'other';
        const key = top.includes(raw) ? raw : OTHER_KEY;
        byKey[key] = (byKey[key] ?? 0) + cents(expense.amount);
      });
    const order = [...top, OTHER_KEY];
    const parts = order
      .filter((key) => byKey[key] > 0)
      .map((key) => ({ key, amount: fromCents(byKey[key]) }));
    return { day, total: fromCents(Object.values(byKey).reduce((a, b) => a + b, 0)), parts };
  });

export interface DonutSlice {
  key: string;
  amount: number;
  fraction: number;
}

/** The donut's slices: the top categories, then everything else as one. */
export const categorySlices = (expenses: ExpenseLike[], top: string[]): DonutSlice[] => {
  const byKey: Record<string, number> = {};
  let total = 0;
  expenses.forEach((expense) => {
    const raw = expense.category || 'other';
    const key = top.includes(raw) ? raw : OTHER_KEY;
    byKey[key] = (byKey[key] ?? 0) + cents(expense.amount);
    total += cents(expense.amount);
  });
  if (total <= 0) return [];
  return [...top, OTHER_KEY]
    .filter((key) => byKey[key] > 0)
    .map((key) => ({ key, amount: fromCents(byKey[key]), fraction: byKey[key] / total }));
};

export interface BudgetLine {
  /** Spent so far by the end of each day, up to today (or the last day). */
  spent: { day: string; total: number }[];
  /** Where the trip ends up at the pace so far, when the trip is not over. */
  forecast: number | null;
  /** Whole days elapsed, for the "per day" pace. */
  daysSoFar: number;
  pacePerDay: number;
}

/** Spending against the budget, day by day, with a forecast at the pace so far. */
export const budgetLine = (expenses: ExpenseLike[], days: string[], today: string): BudgetLine => {
  const lastShown = days.filter((day) => day <= today);
  const shown = lastShown.length ? lastShown : days.slice(0, 1);
  let running = 0;
  const spent = shown.map((day) => {
    running += expenses
      .filter((expense) => expense.spentOn === day)
      .reduce((sum, expense) => sum + cents(expense.amount), 0);
    return { day, total: fromCents(running) };
  });
  // Anything recorded before the first chart day still counts.
  const before = expenses
    .filter((expense) => days.length && expense.spentOn < days[0])
    .reduce((sum, expense) => sum + cents(expense.amount), 0);
  spent.forEach((point) => (point.total += fromCents(before)));

  const daysSoFar = shown.length;
  const soFar = spent.length ? spent[spent.length - 1].total : 0;
  const pacePerDay = daysSoFar ? soFar / daysSoFar : 0;
  const remaining = days.length - daysSoFar;
  return {
    spent,
    forecast:
      remaining > 0 && daysSoFar > 0
        ? Math.round((soFar + pacePerDay * remaining) * 100) / 100
        : null,
    daysSoFar,
    pacePerDay: Math.round(pacePerDay * 100) / 100,
  };
};

export type DayPart = 'morning' | 'afternoon' | 'evening' | 'night';
export const DAY_PARTS: { key: DayPart; label: string }[] = [
  { key: 'morning', label: 'Morning' },
  { key: 'afternoon', label: 'Afternoon' },
  { key: 'evening', label: 'Evening' },
  { key: 'night', label: 'Night' },
];

/** Morning 5–12, afternoon 12–5, evening 5–9, night 9–5. */
export const dayPartOf = (time?: string): DayPart | null => {
  const match = (time ?? '').match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hour = Number(match[1]);
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
};

export interface TimeGrid {
  /** cells[dayIndex][partIndex], in the trip's currency. */
  cells: number[][];
  max: number;
  /** Expenses without a time, which have no cell. */
  untimed: number;
}

/** How much went out in each part of each day. */
export const timeGrid = (expenses: ExpenseLike[], days: string[]): TimeGrid => {
  const cells = days.map(() => DAY_PARTS.map(() => 0));
  let untimed = 0;
  expenses.forEach((expense) => {
    const dayIndex = days.indexOf(expense.spentOn);
    if (dayIndex < 0) return;
    const part = dayPartOf(expense.spentTime);
    if (!part) {
      untimed += 1;
      return;
    }
    const partIndex = DAY_PARTS.findIndex((entry) => entry.key === part);
    cells[dayIndex][partIndex] = fromCents(
      cents(cells[dayIndex][partIndex]) + cents(expense.amount),
    );
  });
  return { cells, max: Math.max(0, ...cells.flat()), untimed };
};

const counts = (payment: PaymentLike) =>
  payment.status !== 'declined' && payment.status !== 'rejected';

export interface SettlePoint {
  day: string;
  /** Money still to move between people at the end of the day. */
  outstanding: number;
  /** Money paid back so far. */
  paidBack: number;
}

/**
 * Settling up over the trip: at the end of each day, how much is still owed
 * between people, and how much has been paid back.
 */
export const settleProgress = (
  expenses: ExpenseLike[],
  payments: PaymentLike[],
  days: string[],
  today: string,
): SettlePoint[] => {
  const shown = days.filter((day) => day <= today);
  const dayOfPayment = (payment: PaymentLike) =>
    payment.settledOn || (payment.createdAt ?? '').slice(0, 10);
  return shown.map((day) => {
    const net: Record<string, number> = {};
    expenses
      .filter((expense) => expense.spentOn <= day)
      .forEach((expense) => {
        Object.entries(expense.paidBy ?? {}).forEach(([id, value]) => {
          net[id] = (net[id] ?? 0) + cents(value);
        });
        Object.entries(expense.shares ?? {}).forEach(([id, value]) => {
          net[id] = (net[id] ?? 0) - cents(value);
        });
      });
    let paidBack = 0;
    payments
      .filter((payment) => counts(payment) && dayOfPayment(payment) <= day)
      .forEach((payment) => {
        net[payment.from] = (net[payment.from] ?? 0) + cents(payment.amount);
        net[payment.to] = (net[payment.to] ?? 0) - cents(payment.amount);
        paidBack += cents(payment.amount);
      });
    const outstanding = Object.values(net).reduce((sum, value) => sum + Math.max(0, value), 0);
    return { day, outstanding: fromCents(outstanding), paidBack: fromCents(paidBack) };
  });
};

/** A round number at or above `value`, for a chart's top line: 1, 2, 2.5, 5 × 10ⁿ. */
export const niceCeiling = (value: number): number => {
  if (!(value > 0)) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((option) => option * power >= value) ?? 10;
  return step * power;
};
