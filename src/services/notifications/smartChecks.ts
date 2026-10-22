import { fetchExpenses } from '@/services/Firebase/expenseService';
import { fetchSettlements, fetchTripBudget } from '@/services/Firebase/settlementService';
import { fetchUserTrips } from '@/services/Firebase/tripService';
import { fetchDelivery, notify } from '@/services/notifications/inbox';
import { computeBalances } from '@/utils/balance';
import { formatMoney, parseAmount } from '@/utils/money';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SEEN_KEY = 'tripsplit.noticeKeys';
const DAY = 86_400_000;

/**
 * The app has no server to watch for budgets, quiet trips or the weekly recap,
 * so it looks for them itself each time the dashboard opens. Every notice has a
 * key, remembered on the phone, so the same one is never raised twice.
 */
export async function runSmartChecks(uid: string): Promise<void> {
  if (!uid) return;
  try {
    const [delivery, trips, seenRaw] = await Promise.all([
      fetchDelivery(uid),
      fetchUserTrips(uid),
      AsyncStorage.getItem(SEEN_KEY),
    ]);
    const seen = new Set<string>(seenRaw ? JSON.parse(seenRaw) : []);
    const raise = async (
      key: string,
      type: Parameters<typeof notify>[1],
      title: string,
      body: string,
      tripId?: string,
    ) => {
      if (seen.has(key)) return;
      seen.add(key);
      await notify(uid, type, title, body, { tripId, id: key, push: false });
    };

    const now = Date.now();
    const week = Math.floor(now / (7 * DAY));
    const totals: Record<string, { owe: number; owed: number }> = {};

    for (const trip of trips) {
      const [expenses, settlements, budgetData] = await Promise.all([
        fetchExpenses(trip.id),
        fetchSettlements(trip.id),
        fetchTripBudget(trip.id),
      ]);
      const memberIds = Object.keys(trip.members ?? {});
      const money = (value: number) => formatMoney(value, trip.currency);

      const mine = computeBalances(memberIds, expenses, settlements).find((b) => b.memberId === uid);
      if (mine && Math.abs(mine.net) >= 0.01) {
        const bucket = (totals[trip.currency] ??= { owe: 0, owed: 0 });
        if (mine.net < 0) bucket.owe -= mine.net;
        else bucket.owed += mine.net;
      }

      if (delivery.mutedTrips[trip.id]) continue;

      const budget = parseAmount(budgetData?.amount) / 100;
      if (budget > 0) {
        const spent = expenses.reduce((sum, e) => sum + e.amount, 0);
        const ratio = spent / budget;
        if (ratio >= 1) {
          await raise(
            'budget100-' + trip.id + '-' + budget,
            'budget',
            'Over budget',
            trip.name + ' has passed its ' + money(budget) + ' budget (' + money(spent) + ' spent).',
            trip.id,
          );
        } else if (ratio >= 0.8) {
          await raise(
            'budget80-' + trip.id + '-' + budget,
            'budget',
            'Close to the budget',
            trip.name + ' has used ' + Math.round(ratio * 100) + '% of its ' + money(budget) + ' budget.',
            trip.id,
          );
        }
      }

      const lastActivity = Math.max(
        0,
        ...expenses.map((e) => Date.parse(e.createdAt) || 0),
        ...settlements.map((s) => Date.parse(s.createdAt) || 0),
      );
      if (mine && Math.abs(mine.net) >= 0.01 && lastActivity && now - lastActivity > 7 * DAY) {
        await raise(
          'settle-' + trip.id + '-' + week,
          'settleUp',
          'Time to settle up?',
          trip.name + ' has been quiet and you ' + (mine.net < 0 ? 'still owe ' : 'are still owed ') + money(Math.abs(mine.net)) + '.',
          trip.id,
        );
      }

      for (const settlement of settlements) {
        const waited = now - (Date.parse(settlement.createdAt) || now);
        if (settlement.to === uid && settlement.status === 'pending' && waited > 2 * DAY) {
          await raise(
            'pending-' + settlement.id + '-' + Math.floor(waited / (2 * DAY)),
            'pendingPayments',
            'A payment is waiting for you',
            'Confirm or decline the ' + money(settlement.amount) + ' payment in ' + trip.name + '.',
            trip.id,
          );
        }
      }
    }

    const parts = Object.entries(totals).map(([currency, t]) =>
      [t.owe > 0 && 'you owe ' + formatMoney(t.owe, currency), t.owed > 0 && 'you are owed ' + formatMoney(t.owed, currency)]
        .filter(Boolean)
        .join(' and '),
    );
    if (parts.length) {
      await raise('summary-' + week, 'summary', 'Your week in TripSplit', parts.join('; ') + '.');
    }

    await AsyncStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-300)));
  } catch (error) {
    console.warn('Could not run the notification checks:', error);
  }
}
