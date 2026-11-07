import { auth } from '@/config/firebase';
import { fetchExpenses, refreshTripTotal } from '@/services/Firebase/expenseService';
import { fetchRecurring } from '@/services/Firebase/recurringService';
import { fetchSettlements, fetchTripBudget } from '@/services/Firebase/settlementService';
import { myName, notifyMany } from '@/services/notifications/inbox';
import { isConnected, newId, readPath, writeUpdates } from '@/services/offline/offlineStore';
import { convertAmount, convertExpense } from '@/utils/currencyChange';
import { buildEntry, serializeEntry } from '@/utils/editLog';

/**
 * Moves a whole trip to another currency in one write: every expense (with its
 * payers, shares, items and custom split), every payment, the budget and the
 * repeating expenses, at one rate. All of it lands together or none of it
 * does, so the trip is never half in one currency. Owner only.
 *
 * `rate` is how many units of `to` one unit of `from` buys.
 */
export const convertTripCurrency = async (
  tripId: string,
  from: string,
  to: string,
  rate: number,
): Promise<void> => {
  if (!isConnected()) {
    throw new Error('Converting a trip’s currency needs a connection.');
  }
  if (!(rate > 0)) throw new Error('Enter the exchange rate to convert at.');
  const uid = auth.currentUser?.uid ?? '';
  const ownerId = (await readPath(`trips/${tripId}/createdBy`, { preferCache: false })) as string;
  if (ownerId !== uid) throw new Error('Only the trip owner can change its currency.');

  const [expenses, settlements, budget, recurring, memberMap] = await Promise.all([
    fetchExpenses(tripId, { preferCache: false }),
    fetchSettlements(tripId, { preferCache: false }),
    fetchTripBudget(tripId),
    fetchRecurring(tripId),
    readPath(`trips/${tripId}/members`, { preferCache: false }) as Promise<Record<
      string,
      { fullname?: string }
    > | null>,
  ]);

  const names = Object.fromEntries(
    Object.entries(memberMap ?? {}).map(([id, member]) => [id, member?.fullname ?? '']),
  );
  const context = { currency: to, names, by: uid, byName: myName() };
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { [`trips/${tripId}/currency`]: to };

  expenses.forEach((expense) => {
    const path = `trips/${tripId}/expenses/${expense.id}`;
    const next = convertExpense(expense, rate, to);
    const entry = buildEntry(newId(), context, [
      {
        label: 'Currency',
        from: `${from} ${expense.amount.toFixed(2)}`,
        to: `${to} ${next.amount.toFixed(2)}`,
      },
    ]);
    updates[`${path}/amount`] = next.amount;
    updates[`${path}/paidBy`] = next.paidBy;
    updates[`${path}/shares`] = next.shares;
    updates[`${path}/items`] = next.items;
    updates[`${path}/splitDetail`] = next.splitDetail;
    updates[`${path}/original`] = next.original;
    updates[`${path}/revision`] = (expense.revision ?? 0) + 1;
    updates[`${path}/updatedAt`] = now;
    updates[`${path}/history/${entry.id}`] = serializeEntry(entry);
  });

  settlements.forEach((payment) => {
    updates[`trips/${tripId}/settlements/${payment.id}/amount`] = convertAmount(
      payment.amount,
      rate,
    );
  });

  if (budget?.amount) {
    updates[`trips/${tripId}/budget/amount`] = convertAmount(budget.amount, rate);
  }

  recurring.forEach((item) => {
    updates[`trips/${tripId}/recurring/${item.id}/amount`] = convertAmount(item.amount, rate);
  });

  await writeUpdates(updates).catch((err) => {
    if (/permission|denied/i.test(String(err?.message ?? ''))) {
      throw new Error(
        'The database refused the conversion. Make sure the latest database rules are published, then try again.',
      );
    }
    throw err;
  });
  await refreshTripTotal(tripId);

  await notifyMany(
    Object.keys(memberMap ?? {}),
    'tripActivity',
    'Trip currency changed',
    `${myName()} changed the trip to ${to}. Every amount was converted at 1 ${from} = ${rate} ${to}.`,
    { tripId },
  ).catch((err) => console.warn('Could not tell the members:', err));
};
