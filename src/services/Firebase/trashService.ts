import { refreshTripTotal } from '@/services/Firebase/expenseService';
import { assertTripOpen } from '@/services/Firebase/tripGuard';
import { myName, notifyMany, tripLabel } from '@/services/notifications/inbox';
import { readPath, writeUpdates } from '@/services/offline/offlineStore';
import { Expense, ItineraryItem } from '@/types/expenses';

/** How long a deleted expense or plan can be restored. */
export const TRASH_DAYS = 30;

export interface TrashEntry {
  id: string;
  kind: 'expense' | 'plan';
  item: (Expense | ItineraryItem) & { title: string };
  deletedAt: string;
  deletedBy: string;
  deletedByName?: string;
}

const expired = (entry: { deletedAt?: string }, now: number) =>
  now - Date.parse(entry.deletedAt ?? '') > TRASH_DAYS * 24 * 60 * 60 * 1000;

/**
 * What was deleted in a trip, newest first. Entries past 30 days are cleared
 * out as they are found, so the trash never grows for ever.
 */
export const fetchTrash = async (tripId: string): Promise<TrashEntry[]> => {
  const stored = (await readPath(`trips/${tripId}/trash`).catch(() => null)) as Record<
    string,
    Omit<TrashEntry, 'id'>
  > | null;
  const now = Date.now();
  const entries = Object.entries(stored ?? {})
    .filter(
      ([, entry]) => entry && entry.item && (entry.kind === 'expense' || entry.kind === 'plan'),
    )
    .map(([id, entry]) => ({ ...entry, id }));

  const old = entries.filter((entry) => expired(entry, now));
  if (old.length) {
    writeUpdates(
      Object.fromEntries(old.map((entry) => [`trips/${tripId}/trash/${entry.id}`, null])),
    ).catch((err) => console.warn('Could not empty old trash:', err));
  }

  return entries
    .filter((entry) => !expired(entry, now))
    .sort((a, b) => (b.deletedAt || '').localeCompare(a.deletedAt || ''));
};

/** Puts a deleted expense or plan back exactly as it was. */
export const restoreFromTrash = async (tripId: string, entry: TrashEntry): Promise<void> => {
  await assertTripOpen(tripId);
  const home = entry.kind === 'expense' ? 'expenses' : 'itinerary';
  await writeUpdates({
    [`trips/${tripId}/${home}/${entry.id}`]: { ...entry.item, id: entry.id },
    [`trips/${tripId}/trash/${entry.id}`]: null,
  });

  if (entry.kind === 'expense') {
    await refreshTripTotal(tripId);
    const expense = entry.item as Expense;
    try {
      const { name } = await tripLabel(tripId);
      await notifyMany(
        Object.keys(expense.shares ?? {}),
        'expenseChanges',
        'Expense restored',
        myName() + ' restored ' + expense.title + ' in ' + name + '.',
        { tripId },
      );
    } catch (err) {
      console.warn('Could not announce the restore:', err);
    }
  }
};
