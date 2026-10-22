import { newId, readPath, removeAt, writeAt, writeUpdates } from '@/services/offline/offlineStore';
import { EditContext, buildEntry, serializeEntry, diffExpense, historyOf } from '@/utils/editLog';
import { EditLogEntry, Expense, ExpenseItem, SplitDetail, SplitMode } from '@/types/expenses';
import { myName, notify, notifyMany, tripLabel } from '@/services/notifications/inbox';
import { formatMoney, parseAmount, todayKey, toAmount } from '@/utils/money';

/**
 * Keeps `trips/{tripId}/totalSpent` in step so the trips list can show a
 * total without loading every expense. Called after each change.
 */
const refreshTripTotal = async (tripId: string): Promise<void> => {
  try {
    const data = (await readPath(`trips/${tripId}/expenses`)) as Record<
      string,
      { amount?: number }
    > | null;
    const total =
      Object.values(data ?? {}).reduce((sum, expense) => sum + parseAmount(expense?.amount), 0) /
      100;
    await writeUpdates({ [`trips/${tripId}/totalSpent`]: Math.round(total * 100) / 100 });
  } catch (error) {
    // A stale total on the trips list is harmless; never block a save for it.
    console.error('Failed to refresh the trip total:', error);
  }
};

export interface ExpenseInput {
  title: string;
  amount: number | string;
  category: string;
  spentOn?: string;
  spentTime?: string;
  notes?: string;
  paidBy: Record<string, number>;
  shares: Record<string, number>;
  splitMode: SplitMode;
  splitDetail?: SplitDetail;
  items?: ExpenseItem[];
  receiptUrls?: string[];
  createdBy: string;
}

const cleanRecord = (record: Record<string, number>): Record<string, number> => {
  const result: Record<string, number> = {};
  Object.entries(record ?? {}).forEach(([id, value]) => {
    const amount = toAmount(parseAmount(value));
    if (id && amount > 0) result[id] = amount;
  });
  return result;
};

/** Adds an expense. Two payers, three payers or everyone is all fine. */
export const createExpense = async (
  tripId: string,
  input: ExpenseInput,
  fixedId?: string,
): Promise<Expense> => {
  if (!tripId) throw new Error('No trip was selected.');

  const title = (input.title || '').trim();
  if (!title) throw new Error('Give this expense a name.');

  const amount = toAmount(parseAmount(input.amount));
  if (amount <= 0) throw new Error('Enter an amount greater than zero.');

  const paidBy = cleanRecord(input.paidBy);
  if (Object.keys(paidBy).length === 0) {
    throw new Error('Pick at least one person who paid.');
  }

  const paidTotal = Object.values(paidBy).reduce((sum, value) => sum + value, 0);
  if (Math.abs(paidTotal - amount) > 0.01) {
    throw new Error('The amounts paid do not add up to the expense total.');
  }

  const shares = cleanRecord(input.shares);
  if (Object.keys(shares).length === 0) {
    throw new Error('Pick at least one person to split with.');
  }

  const shareTotal = Object.values(shares).reduce((sum, value) => sum + value, 0);
  if (Math.abs(shareTotal - amount) > 0.01) {
    throw new Error('The split does not add up to the expense total.');
  }

  // The key is made on the device so an expense can be saved with no
  // connection; the write itself waits in the queue if needed.
  const expense: Expense = {
    id: fixedId || newId(),
    title,
    amount,
    category: input.category || 'other',
    spentOn: input.spentOn || todayKey(),
    ...(input.spentTime ? { spentTime: input.spentTime } : {}),
    ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
    paidBy,
    shares,
    splitMode: input.splitMode,
    ...(input.splitDetail ? { splitDetail: input.splitDetail } : {}),
    ...(input.items?.length ? { items: input.items } : {}),
    ...(input.receiptUrls?.length
      ? { receiptUrls: input.receiptUrls, receiptUrl: input.receiptUrls[0] }
      : {}),
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
  };

  await writeAt(`trips/${tripId}/expenses/${expense.id}`, expense);
  await refreshTripTotal(tripId);
  await announceExpense(tripId, expense, !!fixedId?.startsWith('rec-'));
  return expense;
};

/** Tells everyone who shares in an expense that it was added. */
const announceExpense = async (tripId: string, expense: Expense, repeating: boolean) => {
  try {
    const { name, currency } = await tripLabel(tripId);
    const who = repeating ? 'A repeating expense' : myName();
    await Promise.all(
      Object.entries(expense.shares).map(([id, share]) =>
        notify(
          id,
          repeating ? 'recurring' : 'newExpenses',
          repeating ? 'Recurring expense added' : 'New expense',
          repeating
            ? expense.title + ' was added to ' + name + '. Your share is ' + formatMoney(share, currency) + '.'
            : who + ' added ' + expense.title + ' in ' + name + ' · your share is ' + formatMoney(share, currency) + '.',
          { tripId },
        ),
      ),
    );
  } catch (error) {
    console.warn('Could not announce the expense:', error);
  }
};

export const updateExpense = async (
  tripId: string,
  expenseId: string,
  input: ExpenseInput,
  audit?: { before: Expense; context: EditContext },
): Promise<EditLogEntry | null> => {
  if (!tripId || !expenseId) throw new Error('No expense was selected.');

  const amount = toAmount(parseAmount(input.amount));
  const paidBy = cleanRecord(input.paidBy);
  const shares = cleanRecord(input.shares);

  const paidTotal = Object.values(paidBy).reduce((sum, value) => sum + value, 0);
  const shareTotal = Object.values(shares).reduce((sum, value) => sum + value, 0);

  if (Math.abs(paidTotal - amount) > 0.01) {
    throw new Error('The amounts paid do not add up to the expense total.');
  }
  if (Math.abs(shareTotal - amount) > 0.01) {
    throw new Error('The split does not add up to the expense total.');
  }

  let entry: EditLogEntry | null = null;
  if (audit) {
    const changes = diffExpense(
      audit.before,
      {
        title: input.title.trim(),
        amount,
        category: input.category || 'other',
        spentOn: input.spentOn || todayKey(),
        spentTime: input.spentTime,
        paidBy,
        shares,
        splitMode: input.splitMode,
        items: input.items,
      },
      audit.context,
    );
    if (changes.length) entry = buildEntry(newId(), audit.context, changes);
  }

  await writeUpdates({
    ...(entry
      ? { [`trips/${tripId}/expenses/${expenseId}/history/${entry.id}`]: serializeEntry(entry) }
      : {}),
    [`trips/${tripId}/expenses/${expenseId}/title`]: input.title.trim(),
    [`trips/${tripId}/expenses/${expenseId}/amount`]: amount,
    [`trips/${tripId}/expenses/${expenseId}/category`]: input.category || 'other',
    [`trips/${tripId}/expenses/${expenseId}/spentOn`]: input.spentOn || todayKey(),
    [`trips/${tripId}/expenses/${expenseId}/spentTime`]: input.spentTime || null,
    [`trips/${tripId}/expenses/${expenseId}/notes`]: input.notes?.trim() || null,
    [`trips/${tripId}/expenses/${expenseId}/paidBy`]: paidBy,
    [`trips/${tripId}/expenses/${expenseId}/shares`]: shares,
    [`trips/${tripId}/expenses/${expenseId}/splitMode`]: input.splitMode,
    [`trips/${tripId}/expenses/${expenseId}/splitDetail`]: input.splitDetail ?? null,
    [`trips/${tripId}/expenses/${expenseId}/items`]: input.items?.length ? input.items : null,
    [`trips/${tripId}/expenses/${expenseId}/receiptUrls`]: input.receiptUrls?.length
      ? input.receiptUrls
      : null,
    [`trips/${tripId}/expenses/${expenseId}/receiptUrl`]: input.receiptUrls?.[0] || null,
    [`trips/${tripId}/expenses/${expenseId}/updatedAt`]: new Date().toISOString(),
  });

  await refreshTripTotal(tripId);
  if (entry) {
    const { name } = await tripLabel(tripId);
    await notifyMany(
      Object.keys(shares).concat(Object.keys(audit?.before.shares ?? {})),
      'expenseChanges',
      'Expense edited',
      myName() + ' changed ' + input.title.trim() + ' in ' + name + '.',
      { tripId },
    );
  }
  return entry;
};

export const fetchExpenses = async (
  tripId: string,
  options?: { preferCache?: boolean },
): Promise<Expense[]> => {
  if (!tripId) return [];

  const data = (await readPath(`trips/${tripId}/expenses`, {
    preferCache: options?.preferCache,
  })) as Record<string, Omit<Expense, 'id'>> | null;
  if (!data) return [];

  return Object.entries(data)
    .map(([id, value]) => ({
      id,
      ...value,
      history: historyOf((value as { history?: unknown }).history),
    }))
    .sort((a, b) => {
      if (a.spentOn !== b.spentOn) return a.spentOn < b.spentOn ? 1 : -1;
      const timeA = a.spentTime ?? '';
      const timeB = b.spentTime ?? '';
      if (timeA !== timeB) return timeA < timeB ? 1 : -1;
      return a.createdAt < b.createdAt ? 1 : -1;
    });
};

export const deleteExpense = async (tripId: string, expenseId: string): Promise<void> => {
  if (!tripId || !expenseId) throw new Error('No expense was selected.');
  const doomed = (await readPath(`trips/${tripId}/expenses/${expenseId}`)) as Expense | null;
  await removeAt(`trips/${tripId}/expenses/${expenseId}`);
  await refreshTripTotal(tripId);
  if (doomed) {
    const { name } = await tripLabel(tripId);
    await notifyMany(
      Object.keys(doomed.shares ?? {}),
      'expenseChanges',
      'Expense deleted',
      myName() + ' deleted ' + doomed.title + ' from ' + name + '.',
      { tripId },
    );
  }
};
