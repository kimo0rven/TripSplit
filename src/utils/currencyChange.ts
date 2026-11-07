/**
 * Moving a trip to another currency: every amount converted at one rate, with
 * each expense's parts still adding up to its total to the cent.
 *
 * Kept free of imports so it can be tested with `node --test`.
 */

const cents = (value: number) => Math.round((Number(value) || 0) * 100);

/** Spreads `total` cents over the weights, handing leftover cents to the biggest remainders. */
const shareOut = (total: number, weights: Record<string, number>): Record<string, number> => {
  const entries = Object.entries(weights).filter(([, weight]) => weight > 0);
  const sum = entries.reduce((acc, [, weight]) => acc + weight, 0);
  const result: Record<string, number> = {};
  if (!entries.length || sum <= 0 || total <= 0) return result;
  let given = 0;
  const rests = entries.map(([id, weight]) => {
    const exact = (total * weight) / sum;
    result[id] = Math.floor(exact);
    given += result[id];
    return { id, rest: exact - Math.floor(exact) };
  });
  rests.sort((a, b) => b.rest - a.rest);
  for (let index = 0; given < total; index += 1, given += 1) {
    result[rests[index % rests.length].id] += 1;
  }
  return result;
};

const toUnits = (record: Record<string, number>) =>
  Object.fromEntries(Object.entries(record).map(([id, value]) => [id, value / 100]));

interface ExpenseLike {
  amount: number;
  paidBy?: Record<string, number>;
  shares?: Record<string, number>;
  items?: { id: string; name: string; amount: number; sharedBy: string[] }[];
  splitMode?: string;
  splitDetail?: { mode?: string; input?: Record<string, number> };
  original?: { currency: string; amount: number; rate: number; paidBy?: Record<string, number> };
}

export interface ConvertedExpense {
  amount: number;
  paidBy: Record<string, number>;
  shares: Record<string, number>;
  items: ExpenseLike['items'] | null;
  splitDetail: ExpenseLike['splitDetail'] | null;
  original: ExpenseLike['original'] | null;
}

/**
 * One expense in the new currency. `rate` is how many units of the new
 * currency one unit of the old one buys. An expense first paid in the new
 * currency goes back to exactly what was paid.
 */
export const convertExpense = (
  expense: ExpenseLike,
  rate: number,
  newCurrency: string,
): ConvertedExpense => {
  const nativeAgain = expense.original?.currency === newCurrency;
  const total = nativeAgain
    ? cents(expense.original!.amount)
    : Math.round(cents(expense.amount) * rate);

  const weights = (record?: Record<string, number>) =>
    Object.fromEntries(Object.entries(record ?? {}).map(([id, value]) => [id, cents(value)]));

  // Paid by several people abroad: what each actually paid is known exactly.
  const paidBy =
    nativeAgain && expense.original?.paidBy
      ? weights(expense.original.paidBy)
      : shareOut(total, weights(expense.paidBy));
  const shares = shareOut(total, weights(expense.shares));

  let items: ConvertedExpense['items'] = null;
  if (expense.items?.length) {
    const itemCents = shareOut(
      total,
      Object.fromEntries(expense.items.map((item) => [item.id, cents(item.amount)])),
    );
    items = expense.items.map((item) => ({ ...item, amount: (itemCents[item.id] ?? 0) / 100 }));
  }

  // A custom split's typed amounts were money; percentages stay as they are.
  let splitDetail: ConvertedExpense['splitDetail'] = expense.splitDetail ?? null;
  if (expense.splitDetail?.mode === 'custom' && expense.splitDetail.input) {
    splitDetail = { ...expense.splitDetail, input: toUnits(shares) };
  }

  const original = nativeAgain
    ? null
    : expense.original
      ? { ...expense.original, rate: Math.round(expense.original.rate * rate * 1e6) / 1e6 }
      : null;

  return {
    amount: total / 100,
    paidBy: toUnits(paidBy),
    shares: toUnits(shares),
    items,
    splitDetail,
    original,
  };
};

/** A single amount in the new currency, to the cent. */
export const convertAmount = (amount: number, rate: number): number =>
  Math.round(cents(amount) * rate) / 100;
