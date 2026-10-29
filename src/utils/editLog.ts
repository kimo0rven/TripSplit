import { EditLogEntry } from '@/types/expenses';
import { formatDay, formatMoney, formatTime } from '@/utils/money';

export interface EditContext {
  currency: string;
  /** Member id -> display name, used to describe who paid or owes. */
  names: Record<string, string>;
  by: string;
  byName: string;
}

type Change = EditLogEntry['changes'][number];

const nameOf = (ctx: EditContext, id: string) => ctx.names[id] || 'Someone';

const describeMap = (ctx: EditContext, map: Record<string, number> | undefined): string => {
  const parts = Object.entries(map ?? {})
    .filter(([, value]) => Math.round(value * 100) > 0)
    .map(([id, value]) => nameOf(ctx, id) + ' ' + formatMoney(value, ctx.currency))
    .sort();
  return parts.length ? parts.join(', ') : 'nobody';
};

const push = (changes: Change[], label: string, from: string, to: string) => {
  if (from !== to) changes.push({ label, from, to });
};

export interface ExpenseSnapshot {
  title: string;
  amount: number;
  category: string;
  spentOn: string;
  spentTime?: string;
  paidBy: Record<string, number>;
  shares: Record<string, number>;
  splitMode: string;
  items?: { name: string; amount: number; sharedBy: string[] }[];
}

/** Plain words for each split mode, as they appear in the change log. */
const SPLIT_NAME: Record<string, string> = {
  equal: 'equally',
  percentage: 'by percentage',
  custom: 'by exact amount',
};

const describeItems = (ctx: EditContext, items: ExpenseSnapshot['items']): string =>
  items?.length
    ? items
        .map(
          (item) =>
            (item.name || 'Item') +
            ' ' +
            formatMoney(item.amount, ctx.currency) +
            ' (' +
            item.sharedBy
              .map((id) => nameOf(ctx, id))
              .sort()
              .join(', ') +
            ')',
        )
        .join('; ')
    : 'none';

export const diffExpense = (
  before: ExpenseSnapshot,
  after: ExpenseSnapshot,
  ctx: EditContext,
): Change[] => {
  const changes: Change[] = [];
  push(changes, 'Title', before.title, after.title);
  push(
    changes,
    'Amount',
    formatMoney(before.amount, ctx.currency),
    formatMoney(after.amount, ctx.currency),
  );
  push(changes, 'Paid by', describeMap(ctx, before.paidBy), describeMap(ctx, after.paidBy));
  // An itemised bill is stored as a custom split, so name it for what it is.
  const splitName = (s: ExpenseSnapshot) =>
    s.items?.length ? 'by item' : (SPLIT_NAME[s.splitMode] ?? s.splitMode);
  push(
    changes,
    'Split',
    splitName(before) + ': ' + describeMap(ctx, before.shares),
    splitName(after) + ': ' + describeMap(ctx, after.shares),
  );
  push(changes, 'Items', describeItems(ctx, before.items), describeItems(ctx, after.items));
  push(changes, 'Category', before.category, after.category);
  const when = (s: ExpenseSnapshot) =>
    formatDay(s.spentOn) + (s.spentTime ? ' ' + formatTime(s.spentTime) : '');
  push(changes, 'Date', when(before), when(after));

  return changes;
};

export interface SettlementSnapshot {
  from: string;
  to: string;
  amount: number;
  isCash?: boolean;
  method?: string;
}

export const diffSettlement = (
  before: SettlementSnapshot,
  after: SettlementSnapshot,
  ctx: EditContext,
): Change[] => {
  const changes: Change[] = [];
  push(
    changes,
    'Amount',
    formatMoney(before.amount, ctx.currency),
    formatMoney(after.amount, ctx.currency),
  );
  push(changes, 'Paid by', nameOf(ctx, before.from), nameOf(ctx, after.from));
  push(changes, 'Received by', nameOf(ctx, before.to), nameOf(ctx, after.to));
  const how = (s: SettlementSnapshot) =>
    s.isCash === true ? 'Cash' : s.method ? 'Not cash (' + s.method + ')' : 'Not specified';
  push(changes, 'Payment type', how(before), how(after));
  return changes;
};

export interface ItinerarySnapshot {
  title: string;
  day: string;
  time?: string;
  endTime?: string;
  location?: string;
  notes?: string;
  attendeeIds?: string[];
  photoUrls?: string[];
}

/** What changed on a plan, described the same way as an expense change. */
export const diffItinerary = (before: ItinerarySnapshot, after: ItinerarySnapshot): Change[] => {
  const changes: Change[] = [];
  push(changes, 'Title', before.title, after.title);
  push(changes, 'Day', formatDay(before.day), formatDay(after.day));
  push(
    changes,
    'Time',
    before.time ? formatTime(before.time) : 'none',
    after.time ? formatTime(after.time) : 'none',
  );
  push(
    changes,
    'Ends',
    before.endTime ? formatTime(before.endTime) : 'none',
    after.endTime ? formatTime(after.endTime) : 'none',
  );
  push(changes, 'Place', before.location || 'none', after.location || 'none');
  push(changes, 'Description', before.notes || 'none', after.notes || 'none');
  // Attendees are counted rather than listed: an id means nothing to a reader,
  // and the point of the row is that the guest list moved.
  push(changes, 'Going', attendeeLabel(before.attendeeIds), attendeeLabel(after.attendeeIds));
  push(
    changes,
    'Photos',
    String(before.photoUrls?.length ?? 0),
    String(after.photoUrls?.length ?? 0),
  );
  return changes;
};

/**
 * How a plan's guest list reads in the edit log.
 *
 * No ids means the whole trip is coming, which is what an untagged plan means
 * everywhere else in the app.
 */
const attendeeLabel = (ids?: string[]): string => {
  if (!ids?.length) return 'everyone';
  return ids.length === 1 ? '1 person' : `${ids.length} people`;
};

export const buildEntry = (id: string, ctx: EditContext, changes: Change[]): EditLogEntry => ({
  id,
  at: new Date().toISOString(),
  by: ctx.by,
  byName: ctx.byName,
  changes,
});

/** The shape stored in the database: the changes travel as one string so the rules can lock an entry once written. */
export const serializeEntry = (entry: EditLogEntry) => ({
  at: entry.at,
  by: entry.by,
  byName: entry.byName || 'Someone',
  changes: JSON.stringify(entry.changes),
});

const parseChanges = (raw: unknown): Change[] => {
  if (Array.isArray(raw)) return raw as Change[];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

/** Firebase hands the log back as an object keyed by id; turn it into a newest-first list. */
export const historyOf = (raw: unknown): EditLogEntry[] | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;
  const list = Object.entries(raw as Record<string, Record<string, unknown>>)
    .map(([id, value]) => ({
      id,
      at: String(value.at ?? ''),
      by: String(value.by ?? ''),
      byName: String(value.byName ?? ''),
      changes: parseChanges(value.changes),
    }))
    .sort((a, b) => (a.at < b.at ? 1 : -1));
  return list.length ? list : undefined;
};
