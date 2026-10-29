import { createExpense } from '@/services/Firebase/expenseService';
import { newId, readPath, writeAt, writeUpdates } from '@/services/offline/offlineStore';
import { RecurringExpense } from '@/types/expenses';
import { EVERY_LABEL, nextOccurrence, toDate } from '@/utils/recurrence';
import { todayKey } from '@/utils/money';

export { EVERY_LABEL, nextOccurrence };

const MAX_CATCH_UP = 31;

export const createRecurring = async (
  tripId: string,
  template: Omit<RecurringExpense, 'id' | 'nextDue' | 'createdAt' | 'active'>,
  firstSpentOn: string,
): Promise<void> => {
  const recurring: RecurringExpense = {
    ...template,
    id: newId(),
    nextDue: nextOccurrence(firstSpentOn, template.every),
    createdAt: new Date().toISOString(),
    active: true,
  };
  await writeAt(`trips/${tripId}/recurring/${recurring.id}`, recurring);
};

export const fetchRecurring = async (tripId: string): Promise<RecurringExpense[]> => {
  const data = (await readPath(`trips/${tripId}/recurring`)) as Record<
    string,
    Omit<RecurringExpense, 'id'>
  > | null;
  return Object.entries(data ?? {})
    .map(([id, value]) => ({ id, ...value }))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
};

export const stopRecurring = async (tripId: string, id: string): Promise<void> => {
  await writeUpdates({ [`trips/${tripId}/recurring/${id}/active`]: false });
};

/**
 * Adds every expense that has come due since the trip was last opened.
 * The expense id is built from the schedule and the day, so two phones doing
 * this at the same moment write the same record instead of two copies.
 * The person who opens the trip is recorded as the one who added them.
 * Returns how many were added.
 */
export const runDueRecurring = async (tripId: string, userId: string): Promise<number> => {
  const list = (await fetchRecurring(tripId)).filter((item) => item.active);
  const today = todayKey();
  let added = 0;

  for (const item of list) {
    let due = item.nextDue;
    let guard = 0;
    while (due <= today && guard < MAX_CATCH_UP) {
      await createExpense(
        tripId,
        {
          title: item.title,
          amount: item.amount,
          category: item.category,
          spentOn: due,
          spentTime: item.spentTime,
          notes: item.notes,
          paidBy: item.paidBy,
          shares: item.shares,
          splitMode: item.splitMode,
          createdBy: userId,
        },
        'rec-' + item.id + '-' + due,
      );
      added += 1;
      guard += 1;
      due = nextOccurrence(due, item.every, toDate(item.nextDue).getDate());
    }
    if (due !== item.nextDue) {
      await writeUpdates({ [`trips/${tripId}/recurring/${item.id}/nextDue`]: due });
    }
  }
  return added;
};
