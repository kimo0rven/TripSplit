import { readPath, writeUpdates } from '@/services/offline/offlineStore';
import { Trip } from '@/types/trips';
import { TripSummary } from '@/utils/tripList';
import { computeBalances } from '@/utils/balance';
import { fetchExpenses } from './expenseService';
import { fetchSettlements } from './settlementService';

const archivePath = (uid: string) => 'users/' + uid + '/archivedTrips';

/** Trips this person has tucked away. Only they see this; the trip itself is unchanged. */
export async function fetchArchivedTrips(uid: string): Promise<Record<string, boolean>> {
  const stored = (await readPath(archivePath(uid), { preferCache: false })) as Record<
    string,
    boolean
  > | null;
  return stored ?? {};
}

export async function setTripArchived(uid: string, tripId: string, archived: boolean) {
  await writeUpdates({ [archivePath(uid) + '/' + tripId]: archived ? true : null });
}

const time = (value?: string) => {
  const ms = value ? new Date(value).getTime() : 0;
  return Number.isNaN(ms) ? 0 : ms;
};

/** Looks into each trip for what the list needs: recent activity and whether it is settled. */
export async function loadTripSummaries(trips: Trip[]): Promise<Record<string, TripSummary>> {
  const entries = await Promise.all(
    trips.map(async (trip): Promise<[string, TripSummary]> => {
      try {
        const [expenses, settlements] = await Promise.all([
          fetchExpenses(trip.id),
          fetchSettlements(trip.id),
        ]);
        const memberIds = Object.keys(trip.members ?? {});
        const balances = computeBalances(memberIds, expenses, settlements);
        const lastActivity = Math.max(
          time(trip.createdAt),
          ...expenses.map((e) => Math.max(time(e.createdAt), time(e.spentOn))),
          ...settlements.map((s) => time(s.createdAt)),
        );
        return [
          trip.id,
          {
            lastActivity,
            hasExpenses: expenses.length > 0,
            settled: expenses.length > 0 && balances.every((b) => Math.abs(b.net) < 0.01),
          },
        ];
      } catch {
        return [
          trip.id,
          { lastActivity: time(trip.createdAt), hasExpenses: false, settled: false },
        ];
      }
    }),
  );
  return Object.fromEntries(entries);
}
