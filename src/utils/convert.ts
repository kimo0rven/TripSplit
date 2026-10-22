/** Converts every amount to `target`. Returns null when a rate is missing. */
export function convertAll(
  amounts: { currency: string; amount: number }[],
  target: string,
  ratesFromTarget: Record<string, number>,
): number | null {
  let total = 0;
  for (const { currency, amount } of amounts) {
    if (currency === target) {
      total += amount;
      continue;
    }
    const rate = ratesFromTarget[currency];
    if (!rate) return null;
    total += amount / rate;
  }
  return total;
}
