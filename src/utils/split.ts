import type { SplitMode } from '@/types/expenses';

/**
 * Splitting maths.
 *
 * All work happens in cents so the parts always add back up to the total:
 * whatever is left over from rounding is handed out one cent at a time,
 * starting with the members who are owed the most.
 */

/** Spreads `total` cents across `ids` as evenly as possible. */
export const splitEqual = (totalCents: number, ids: string[]): Record<string, number> => {
  const result: Record<string, number> = {};
  if (!ids.length || totalCents <= 0) return result;

  const base = Math.floor(totalCents / ids.length);
  let remainder = totalCents - base * ids.length;

  ids.forEach((id) => {
    const extra = remainder > 0 ? 1 : 0;
    if (remainder > 0) remainder -= 1;
    result[id] = base + extra;
  });

  return result;
};

/** Splits by weight, e.g. percentages or custom shares. */
export const splitByWeights = (
  totalCents: number,
  weights: Record<string, number>,
): Record<string, number> => {
  const entries = Object.entries(weights).filter(
    ([, weight]) => Number.isFinite(weight) && weight > 0,
  );
  const result: Record<string, number> = {};
  if (!entries.length || totalCents <= 0) return result;

  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (totalWeight <= 0) return result;

  let handedOut = 0;
  const remainders: Array<{ id: string; odd: number }> = [];

  entries.forEach(([id, weight]) => {
    const exact = (totalCents * weight) / totalWeight;
    const floor = Math.floor(exact);
    result[id] = floor;
    handedOut += floor;
    remainders.push({ id, odd: exact - floor });
  });

  // Hand the missing cents to whoever lost the most to rounding.
  let missing = totalCents - handedOut;
  remainders.sort((a, b) => b.odd - a.odd);
  let index = 0;
  while (missing > 0 && remainders.length > 0) {
    result[remainders[index % remainders.length].id] += 1;
    missing -= 1;
    index += 1;
  }

  return result;
};

/**
 * Works out each member's share in cents from the split they picked.
 *
 * - equal:      even split.
 * - percentage: `values` are percents (0-100), spread across the total.
 * - custom:     `values` are plain currency amounts, e.g. 250.50.
 */
export const computeShares = (
  mode: SplitMode,
  totalCents: number,
  accountsFor: string[],
  values: Record<string, number> = {},
): Record<string, number> => {
  switch (mode) {
    case 'equal':
      return splitEqual(totalCents, accountsFor.filter(Boolean));
    case 'percentage': {
      // A percent of 0 means "not taking part".
      const weights: Record<string, number> = {};
      accountsFor.forEach((id) => {
        const percent = Number(values[id]);
        if (Number.isFinite(percent) && percent > 0) weights[id] = percent;
      });
      return splitByWeights(totalCents, weights);
    }
    case 'custom': {
      const result: Record<string, number> = {};
      accountsFor.forEach((id) => {
        const amount = Math.round((Number(values[id]) || 0) * 100);
        if (Number.isFinite(amount) && amount > 0) result[id] = amount;
      });
      return result;
    }
    default:
      return splitEqual(totalCents, accountsFor.filter(Boolean));
  }
};

export interface ValidationResult {
  ok: boolean;
  message?: string;
}

export const validateSplit = (
  mode: SplitMode,
  totalCents: number,
  accountsFor: string[],
  values: Record<string, number> = {},
): ValidationResult => {
  if (totalCents <= 0) {
    return { ok: false, message: 'Enter an amount greater than zero.' };
  }
  if (accountsFor.length === 0) {
    return { ok: false, message: 'Pick at least one person to split with.' };
  }

  const picked = accountsFor.map((id) => Number(values[id]) || 0);

  if (mode === 'percentage') {
    const total = picked.reduce((sum, value) => sum + value, 0);
    if (total <= 0) {
      return { ok: false, message: 'Give at least one person a percentage.' };
    }
    // Allow a tiny slippage so 33.33 x 3 still counts as 100.
    if (Math.abs(total - 100) > 0.05) {
      return {
        ok: false,
        message: `Percentages add up to ${round2(total)}%. They must total 100%.`,
      };
    }
  }

  if (mode === 'custom') {
    const total = picked.reduce((sum, value) => sum + value, 0);
    if (total <= 0) {
      return { ok: false, message: 'Give at least one person a share.' };
    }
    if (Math.abs(total - totalCents / 100) > 0.01) {
      return {
        ok: false,
        message: 'The custom amounts do not match the expense total yet.',
      };
    }
  }

  return { ok: true };
};

const round2 = (value: number) => Math.round(value * 100) / 100;

export const percentTotal = (accountsFor: string[], values: Record<string, number> = {}): number =>
  Math.round(accountsFor.reduce((sum, id) => sum + (Number(values[id]) || 0), 0) * 100) / 100;

export const emptyValues = (ids: string[]): Record<string, number> => {
  const result: Record<string, number> = {};
  ids.forEach((id) => {
    result[id] = 0;
  });
  return result;
};

/**
 * For percentage and custom splits: draws the leftover value from the members
 * who are not being edited, so the person typing does not have to add up to
 * exactly 100 themselves.
 */
export const balanceValues = (
  mode: SplitMode,
  totalCents: number,
  ids: string[],
  values: Record<string, number>,
  anchorId: string,
): Record<string, number> => {
  const others = ids.filter((id) => id !== anchorId);
  if (others.length === 0) return values;

  const next = { ...values };

  if (mode === 'percentage') {
    const othersTotal = others.reduce((sum, id) => sum + (Number(values[id]) || 0), 0);
    next[anchorId] = Math.max(0, round2(100 - othersTotal));
    return next;
  }

  const othersAmount = others.reduce((sum, id) => sum + (Number(values[id]) || 0), 0);
  const totalAmount = totalCents / 100;
  next[anchorId] = Math.max(0, round2(totalAmount - othersAmount));
  return next;
};
