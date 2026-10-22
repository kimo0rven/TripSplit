import AsyncStorage from '@react-native-async-storage/async-storage';
import { convertAll } from '@/utils/convert';
import { useEffect, useState } from 'react';

export { convertAll };

const KEY = 'tripsplit.rates.';
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

interface Cached {
  at: number;
  rates: Record<string, number>;
}

/** Units of every currency that one unit of `base` buys. Cached for half a day. */
export async function fetchRates(base: string): Promise<Record<string, number> | null> {
  const code = base.toUpperCase();
  let stale: Cached | null = null;
  try {
    const raw = await AsyncStorage.getItem(KEY + code);
    if (raw) {
      stale = JSON.parse(raw) as Cached;
      if (Date.now() - stale.at < MAX_AGE_MS) return stale.rates;
    }
  } catch {
    stale = null;
  }

  try {
    const response = await fetch('https://open.er-api.com/v6/latest/' + code);
    const json = await response.json();
    if (json?.result === 'success' && json.rates) {
      const cached: Cached = { at: Date.now(), rates: json.rates };
      AsyncStorage.setItem(KEY + code, JSON.stringify(cached)).catch(() => {});
      return cached.rates;
    }
  } catch (error) {
    console.warn('Could not load exchange rates:', error);
  }
  // Old rates beat none at all when offline.
  return stale?.rates ?? null;
}

/** Rates relative to `base`, or null while loading or if they could not be fetched. */
export function useRates(base: string | undefined, needed: boolean): Record<string, number> | null {
  const [rates, setRates] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    if (!base || !needed) return;
    let active = true;
    fetchRates(base).then((value) => active && setRates(value));
    return () => {
      active = false;
    };
  }, [base, needed]);
  return rates;
}
