/**
 * Finding expenses in a trip: words typed into the search box, plus the
 * filters on the expenses page. Kept free of imports so it can be tested with
 * `node --test`.
 */

interface ExpenseLike {
  id: string;
  title: string;
  amount: number;
  category?: string;
  spentOn: string;
  spentTime?: string;
  createdAt?: string;
  notes?: string;
  paidBy?: Record<string, number>;
  shares?: Record<string, number>;
  items?: { name: string }[];
}

export type ExpenseSort = 'newest' | 'oldest' | 'highest' | 'lowest';

export interface ExpenseQuery {
  /** Words to look for in the title, notes, item names, people and amount. */
  text?: string;
  category?: string | null;
  /** Someone who paid for it. */
  payerId?: string | null;
  /** Someone who shares the cost. */
  sharedWith?: string | null;
  /** A single day, YYYY-MM-DD. */
  day?: string | null;
  sort?: ExpenseSort;
}

const fold = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Whether an expense matches the typed words. Every word has to appear
 * somewhere: "dinner kim" finds Kim's dinner, not every dinner. A number
 * matches the amount, so "250" finds the ₱250 taxi.
 */
export const matchesText = (
  expense: ExpenseLike,
  text: string,
  nameOf: (id: string) => string,
  categoryName: (key: string) => string,
): boolean => {
  const words = fold(text).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const people = [...Object.keys(expense.paidBy ?? {}), ...Object.keys(expense.shares ?? {})].map(
    nameOf,
  );
  const haystack = fold(
    [
      expense.title,
      expense.notes ?? '',
      categoryName(expense.category || 'other'),
      ...(expense.items ?? []).map((item) => item.name),
      ...people,
      String(expense.amount),
      expense.amount.toFixed(2),
    ].join(' \u0001 '),
  );
  return words.every((word) => {
    const number = word.replace(/[,₱$]/g, '');
    if (/^\d+(\.\d+)?$/.test(number)) {
      // A number is an amount: whole pesos match, so "250" finds 250.00.
      return Math.floor(expense.amount) === Math.floor(Number(number)) || haystack.includes(number);
    }
    return haystack.includes(word);
  });
};

const newest = (a: ExpenseLike, b: ExpenseLike) =>
  a.spentOn !== b.spentOn
    ? a.spentOn < b.spentOn
      ? 1
      : -1
    : (b.spentTime ?? '').localeCompare(a.spentTime ?? '') ||
      (b.createdAt ?? '').localeCompare(a.createdAt ?? '');

/** The expenses that fit every filter, in the chosen order. */
export const findExpenses = <T extends ExpenseLike>(
  expenses: T[],
  query: ExpenseQuery,
  nameOf: (id: string) => string,
  categoryName: (key: string) => string,
): T[] => {
  const found = expenses.filter((expense) => {
    if (query.category && (expense.category || 'other') !== query.category) return false;
    if (query.payerId && !(query.payerId in (expense.paidBy ?? {}))) return false;
    if (query.sharedWith && !(query.sharedWith in (expense.shares ?? {}))) return false;
    if (query.day && expense.spentOn !== query.day) return false;
    return matchesText(expense, query.text ?? '', nameOf, categoryName);
  });
  const sort = query.sort ?? 'newest';
  return [...found].sort((a, b) =>
    sort === 'oldest'
      ? -newest(a, b)
      : sort === 'highest'
        ? b.amount - a.amount || newest(a, b)
        : sort === 'lowest'
          ? a.amount - b.amount || newest(a, b)
          : newest(a, b),
  );
};
