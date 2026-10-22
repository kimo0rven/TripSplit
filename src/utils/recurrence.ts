import type { RepeatEvery } from '@/types/expenses';

export const toDate = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

const toKey = (date: Date) =>
  date.getFullYear() +
  '-' +
  String(date.getMonth() + 1).padStart(2, '0') +
  '-' +
  String(date.getDate()).padStart(2, '0');

/** The day after `key` for the given repeat; a monthly one on the 31st lands on the month's last day. */
export const nextOccurrence = (key: string, every: RepeatEvery, anchorDay?: number): string => {
  const date = toDate(key);
  if (every === 'daily') date.setDate(date.getDate() + 1);
  else if (every === 'weekly') date.setDate(date.getDate() + 7);
  else {
    const day = anchorDay ?? date.getDate();
    const target = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(day, last));
    return toKey(target);
  }
  return toKey(date);
};

export const EVERY_LABEL: Record<RepeatEvery, string> = {
  daily: 'Every day',
  weekly: 'Every week',
  monthly: 'Every month',
};
