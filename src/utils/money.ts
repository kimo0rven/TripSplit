/**
 * Money helpers.
 *
 * Every calculation runs on integer cents (or the currency's smallest unit) so
 * that 0.1 + 0.2 never turns into 0.30000000000000004.
 */

export const MAX_AMOUNT = 1_000_000_000;

/** Reads user typing ("1,250.50", "₱80") and returns whole cents. */
export const parseAmount = (text: string | number | undefined | null): number => {
  if (typeof text === 'number') {
    return Number.isFinite(text) ? Math.round(text * 100) : 0;
  }
  if (!text) return 0;

  const cleaned = String(text).replace(/[^0-9.]/g, '');
  if (!cleaned) return 0;

  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100);
};

/** Turns cents back into a plain number for storage. */
export const toAmount = (cents: number): number => Math.round(cents) / 100;

/** Cents -> "1,250.50" without a currency symbol, for text inputs. */
export const centsToInput = (cents: number): string => (Math.round(cents) / 100).toFixed(2);

export const formatMoney = (amount: number, currency: string = 'PHP'): string => {
  const value = Number.isFinite(amount) ? amount : 0;

  try {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: currency || 'PHP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency || ''} ${value.toFixed(2)}`.trim();
  }
};

/** Compact form for tight spots: ₱1.2k instead of ₱1,250.00. */
export const formatMoneyShort = (amount: number, currency: string = 'PHP'): string => {
  const value = Number.isFinite(amount) ? amount : 0;
  if (Math.abs(value) < 10000) return formatMoney(value, currency);

  const units = [
    { limit: 1_000_000_000, suffix: 'B' },
    { limit: 1_000_000, suffix: 'M' },
    { limit: 1_000, suffix: 'k' },
  ];

  for (const unit of units) {
    if (Math.abs(value) >= unit.limit) {
      const scaled = value / unit.limit;
      return `${currency || ''} ${scaled.toFixed(1).replace(/\.0$/, '')}${unit.suffix}`.trim();
    }
  }

  return formatMoney(value, currency);
};

/** Today as YYYY-MM-DD in the device's own time zone. */
export const todayKey = (): string => {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
};

export const addDaysKey = (key: string, days: number): string => {
  const date = parseDayKey(key) ?? new Date();
  date.setDate(date.getDate() + days);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

/** Parses YYYY-MM-DD at local noon, so time zones cannot shift the day. */
export const parseDayKey = (key: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((key || '').trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);

  if (Number.isNaN(date.getTime())) return null;
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
};

export const isValidDayKey = (key: string): boolean => parseDayKey(key) !== null;

/** "2025-06-14" -> "Jun 14, 2025". */
export const formatDay = (key: string): string => {
  const date = parseDayKey(key);
  if (!date) return key || '—';

  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  } catch {
    return key;
  }
};

/** Long date with the month spelled out, e.g. "October 21, 2026". */
export const formatLongDay = (key: string): string => {
  const date = parseDayKey(key);
  if (!date) return key || '—';

  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  } catch {
    return key;
  }
};

/** All receipt photos of an expense, including ones saved with the older single field. */
export const receiptsOf = (
  expense?: { receiptUrl?: string; receiptUrls?: string[] } | null,
): string[] => {
  if (!expense) return [];
  if (expense.receiptUrls?.length) return expense.receiptUrls;
  return expense.receiptUrl ? [expense.receiptUrl] : [];
};

/** The current clock time as 24-hour "HH:MM". */
export const nowTime = (): string => {
  const now = new Date();
  return `${`${now.getHours()}`.padStart(2, '0')}:${`${now.getMinutes()}`.padStart(2, '0')}`;
};

/** "Wed, Oct 21 · 3:45 PM", or just the day when there is no time. */
export const formatDayTime = (key: string, time?: string): string => {
  const clock = formatTime(time);
  return clock ? `${formatDay(key)} · ${clock}` : formatDay(key);
};

export const formatTime = (time?: string): string => {
  const match = /^(\d{1,2}):(\d{2})$/.exec((time || '').trim());
  if (!match) return '';
  const hours = Number(match[1]);
  if (hours > 23) return '';

  const suffix = hours >= 12 ? 'PM' : 'AM';
  const shown = hours % 12 === 0 ? 12 : hours % 12;
  return `${shown}:${match[2]} ${suffix}`;
};

/** The local date as YYYY-MM-DD, so it can be compared with a record's day key. */
const localDayKey = (date: Date): string =>
  `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`;

/**
 * A readable heading for one day of a list.
 *
 * The two days people care about most get a plain word - "Today" and
 * "Yesterday" - because a date there makes them do the maths themselves.
 */
export const dayHeading = (key: string): string => {
  if (!key) return 'No date';

  const today = new Date();
  if (key === localDayKey(today)) return 'Today';

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (key === localDayKey(yesterday)) return 'Yesterday';

  return formatDay(key);
};
