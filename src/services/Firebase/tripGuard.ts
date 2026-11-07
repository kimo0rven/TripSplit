import { auth } from '@/config/firebase';
import { myName } from '@/services/notifications/inbox';
import { readPath } from '@/services/offline/offlineStore';
import { formatDay, todayKey } from '@/utils/money';
import { canRecordMoney } from '@/utils/tripList';

/**
 * Stops changes to a closed trip's expenses and plans. The database rules
 * refuse them too; this says why in words, before anything is queued.
 */
export const assertTripOpen = async (tripId: string): Promise<void> => {
  let closedAt: unknown = null;
  try {
    closedAt = await readPath(`trips/${tripId}/closedAt`);
  } catch {
    return;
  }
  if (closedAt) {
    throw new Error(
      'This trip is closed, so its expenses and plans can’t change. The owner can reopen it in trip settings.',
    );
  }
};

/**
 * Stops new expenses and payments before a trip has started, unless its owner
 * allowed spending early. Read from the phone's copy, so it works offline.
 */
export const assertTripStarted = async (tripId: string): Promise<void> => {
  let trip: { startDate?: string; allowEarlySpending?: boolean } = {};
  try {
    const [startDate, allowEarlySpending] = await Promise.all([
      readPath(`trips/${tripId}/startDate`),
      readPath(`trips/${tripId}/allowEarlySpending`),
    ]);
    trip = {
      startDate: typeof startDate === 'string' ? startDate : undefined,
      allowEarlySpending: allowEarlySpending === true,
    };
  } catch {
    return;
  }
  if (!canRecordMoney(trip, todayKey())) {
    throw new Error(
      `This trip starts on ${formatDay(trip.startDate ?? '')}. Expenses and payments open then; the owner can allow them earlier in trip settings.`,
    );
  }
};

/** What goes in the trip's trash for a deleted expense or plan. */
export const trashEntry = (kind: 'expense' | 'plan', item: { id?: string }) => ({
  kind,
  item,
  deletedAt: new Date().toISOString(),
  deletedBy: auth.currentUser?.uid ?? '',
  deletedByName: myName(),
});
