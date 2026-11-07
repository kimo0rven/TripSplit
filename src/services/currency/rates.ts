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

export interface DatedRate {
  /** Units of `to` that one unit of `from` bought. */
  rate: number;
  /** The day the rate is for; can be a few days before the one asked for (weekends). */
  day: string;
  /** 'history' for a past day's published rate, 'latest' for today's. */
  source: 'history' | 'latest';
}

const DAY_KEY = 'tripsplit.rate.';

/** Reads a rate out of either shape the history service answers with. */
const readHistoryRate = (json: any, to: string): { rate: number; day: string } | null => {
  const direct = Number(json?.rate);
  const fromTable = Number(json?.rates?.[to]);
  const rate = Number.isFinite(direct) && direct > 0 ? direct : fromTable;
  if (!(Number.isFinite(rate) && rate > 0)) return null;
  return { rate, day: typeof json?.date === 'string' ? json.date : '' };
};

/**
 * The rate on a given day: a past day's published rate when it can be found,
 * today's otherwise. Past rates never change, so each one is kept for good.
 * History comes from Frankfurter (central-bank reference rates, no key);
 * currencies it doesn't cover fall back to today's rate.
 */
export async function fetchRateOn(
  from: string,
  to: string,
  day: string,
  today: string,
): Promise<DatedRate | null> {
  const base = from.toUpperCase();
  const quote = to.toUpperCase();
  if (base === quote) return { rate: 1, day, source: 'latest' };

  if (day && day < today) {
    const key = `${DAY_KEY}${base}.${quote}.${day}`;
    try {
      const saved = await AsyncStorage.getItem(key);
      if (saved) return JSON.parse(saved) as DatedRate;
    } catch {
      // Not saved yet.
    }
    const urls = [
      `https://api.frankfurter.dev/v2/rate/${base}/${quote}?date=${day}`,
      `https://api.frankfurter.dev/v1/${day}?base=${base}&symbols=${quote}`,
    ];
    for (const url of urls) {
      try {
        const response = await fetch(url);
        if (!response.ok) continue;
        const found = readHistoryRate(await response.json(), quote);
        if (found) {
          const dated: DatedRate = { rate: found.rate, day: found.day || day, source: 'history' };
          AsyncStorage.setItem(key, JSON.stringify(dated)).catch(() => {});
          return dated;
        }
      } catch {
        // Try the next one, then today's rate.
      }
    }
  }

  const rate = Number((await fetchRates(base))?.[quote]);
  return Number.isFinite(rate) && rate > 0 ? { rate, day: today, source: 'latest' } : null;
}
