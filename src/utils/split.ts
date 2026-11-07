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
  const remainders: { id: string; odd: number }[] = [];

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
      const percentSum = Object.values(weights).reduce((sum, value) => sum + value, 0);
      // Close to 100 (33.33 x 3): spread the whole total, so no cent is lost.
      if (Math.abs(percentSum - 100) <= 0.05) return splitByWeights(totalCents, weights);
      // Otherwise each person gets exactly their percent, so the preview shows
      // what is missing or extra instead of quietly scaling everyone.
      const exact: Record<string, number> = {};
      Object.entries(weights).forEach(([id, percent]) => {
        exact[id] = Math.round((totalCents * percent) / 100);
      });
      return exact;
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
    if (Math.round(total * 100) !== totalCents) {
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

/** What the split must add up to: 100 percent, or the total in currency. */
const targetOf = (mode: SplitMode, totalCents: number) =>
  mode === 'percentage' ? 100 : totalCents / 100;

/**
 * Cleans what is typed into a split box: digits and one decimal point, at most
 * two decimals. Kept as text, so "12." and "0.5" can be typed on the way.
 */
export const cleanSplitText = (text: string): string => {
  const kept = text.replace(/,/g, '.').replace(/[^0-9.]/g, '');
  const [whole, ...rest] = kept.split('.');
  const fraction = rest.join('').slice(0, 2);
  const leading = whole.replace(/^0+(?=\d)/, '');
  return kept.includes('.') ? `${leading || '0'}.${fraction}` : leading;
};

/** A split value as a short string for its box: 33.33, 50, 12.5. */
export const splitText = (value: number): string =>
  value > 0 ? String(Math.round(value * 100) / 100) : '';

/**
 * Even starting values for everyone in a percent or custom split, spread in
 * hundredths so they add up exactly (33.34 + 33.33 + 33.33).
 */
export const evenValues = (
  mode: SplitMode,
  totalCents: number,
  ids: string[],
): Record<string, number> => {
  const units = splitEqual(Math.round(targetOf(mode, totalCents) * 100), ids);
  const result: Record<string, number> = {};
  ids.forEach((id) => {
    result[id] = (units[id] ?? 0) / 100;
  });
  return result;
};

export interface SplitEdit {
  values: Record<string, number>;
  /** Who was typed into, oldest first. Everyone else adjusts on their own. */
  edited: string[];
}

/**
 * One row typed into. The rows nobody typed into share what is left, evenly,
 * so the split keeps adding up. When every row has been typed into, the one
 * typed into longest ago becomes the one that adjusts. Nobody goes below zero:
 * if the typed rows already pass the total, the rest are zero and the split
 * shows as over.
 */
export const editSplit = (
  mode: SplitMode,
  totalCents: number,
  ids: string[],
  current: SplitEdit,
  id: string,
  value: number,
): SplitEdit => {
  let edited = [...current.edited.filter((other) => other !== id && ids.includes(other)), id];
  if (ids.length > 1 && edited.length >= ids.length) edited = edited.slice(1);
  const values = { ...current.values, [id]: value };
  return { values: refill(mode, totalCents, ids, values, edited), edited };
};

/** Shares what the typed rows leave over among the rows nobody typed into. */
export const refill = (
  mode: SplitMode,
  totalCents: number,
  ids: string[],
  values: Record<string, number>,
  edited: string[],
): Record<string, number> => {
  const free = ids.filter((id) => !edited.includes(id));
  if (!free.length) return values;
  const typed = ids
    .filter((id) => edited.includes(id))
    .reduce((sum, id) => sum + (Number(values[id]) || 0), 0);
  const left = Math.max(0, Math.round((targetOf(mode, totalCents) - typed) * 100));
  const units = splitEqual(left, free);
  const next = { ...values };
  free.forEach((id) => {
    next[id] = (units[id] ?? 0) / 100;
  });
  return next;
};
