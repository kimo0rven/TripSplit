/**
 * An expense paid in another currency: the amount as paid, the rate used, and
 * what it comes to in the trip's currency. The trip's balances only ever use
 * the converted amount; the original is kept to show what was paid.
 *
 * Kept free of imports so it can be tested with `node --test`.
 */

export interface OriginalAmount {
  /** The currency it was paid in, e.g. USD. */
  currency: string;
  /** The amount as paid, in that currency. */
  amount: number;
  /** Trip-currency units per one unit of the paid currency. */
  rate: number;
  /** With several payers, what each put in, in the paid currency. */
  paidBy?: Record<string, number>;
}

/** The trip-currency cents for an amount paid in another currency. */
export const convertedCents = (foreignCents: number, rate: number): number =>
  foreignCents > 0 && rate > 0 ? Math.round(foreignCents * rate) : 0;

/**
 * The rate from `from` to `to`, out of a table of how many units of each
 * currency one unit of `from` buys. 0 when it is missing.
 */
export const rateBetween = (rates: Record<string, number> | null, to: string): number => {
  const rate = Number(rates?.[to]);
  return Number.isFinite(rate) && rate > 0 ? rate : 0;
};

/** A rate as typed into its box: 56.2, 0.3871, 0.00631. */
export const rateText = (rate: number): string => {
  if (!(rate > 0)) return '';
  const digits = rate >= 100 ? 2 : rate >= 1 ? 4 : 6;
  return String(Number(rate.toFixed(digits)));
};

/** Cleans what is typed into the rate box: digits and one point. */
export const cleanRateText = (text: string): string => {
  const kept = text.replace(/,/g, '.').replace(/[^0-9.]/g, '');
  const [whole, ...rest] = kept.split('.');
  return kept.includes('.') ? `${whole || '0'}.${rest.join('').slice(0, 6)}` : whole;
};

/** Reads a saved original amount, or null when it is missing or broken. */
export const readOriginal = (value: unknown): OriginalAmount | null => {
  if (!value || typeof value !== 'object') return null;
  const entry = value as Record<string, unknown>;
  const amount = Number(entry.amount);
  const rate = Number(entry.rate);
  if (typeof entry.currency !== 'string' || !entry.currency || !(amount > 0) || !(rate > 0)) {
    return null;
  }
  const paidBy =
    entry.paidBy && typeof entry.paidBy === 'object'
      ? Object.fromEntries(
          Object.entries(entry.paidBy as Record<string, unknown>)
            .map(([id, value]) => [id, Number(value)] as const)
            .filter(([, value]) => Number.isFinite(value) && value > 0),
        )
      : null;
  return {
    currency: entry.currency,
    amount,
    rate,
    ...(paidBy && Object.keys(paidBy).length ? { paidBy } : {}),
  };
};
