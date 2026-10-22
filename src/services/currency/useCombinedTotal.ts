import { getUserData } from '@/services/Firebase/userService';
import { useEffect, useMemo, useState } from 'react';
import { convertAll, useRates } from './rates';

/**
 * Adds amounts in different currencies together in the user's default currency.
 * Returns null when there is only one currency (nothing to combine) or while
 * the rates are unavailable.
 */
export function useCombinedTotal(
  userId: string,
  amounts: { currency: string; amount: number }[],
): { currency: string; total: number } | null {
  const [target, setTarget] = useState<string | undefined>();
  const mixed = new Set(amounts.map((entry) => entry.currency)).size > 1;

  useEffect(() => {
    if (!userId || !mixed) return;
    getUserData<{ currency?: string }>(userId)
      .then((data) => setTarget(data?.currency || amounts[0]?.currency))
      .catch(() => setTarget(amounts[0]?.currency));
    // Only the first fetch matters; the default rarely changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, mixed]);

  const rates = useRates(target, mixed);
  const key = JSON.stringify(amounts);

  return useMemo(() => {
    if (!mixed || !target || !rates) return null;
    const total = convertAll(amounts, target, rates);
    return total === null ? null : { currency: target, total };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mixed, target, rates, key]);
}
