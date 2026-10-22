import { newId, readPath, removeAt, writeAt, writeUpdates } from '@/services/offline/offlineStore';
import { EditLogEntry, ItineraryItem } from '@/types/expenses';
import { EditContext, buildEntry, diffItinerary, historyOf, serializeEntry } from '@/utils/editLog';
import { todayKey } from '@/utils/money';

export interface ItineraryInput {
  title: string;
  day: string;
  time?: string;
  location?: string;
  notes?: string;
  photoUrls?: string[];
  createdBy: string;
}

export const createItineraryItem = async (
  tripId: string,
  input: ItineraryInput,
): Promise<ItineraryItem> => {
  if (!tripId) throw new Error('No trip was selected.');

  const title = (input.title || '').trim();
  if (!title) throw new Error('Give this plan a name.');

  const item: ItineraryItem = {
    id: newId(),
    title,
    day: input.day || todayKey(),
    ...(input.time?.trim() ? { time: input.time.trim() } : {}),
    ...(input.location?.trim() ? { location: input.location.trim() } : {}),
    ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
    ...(input.photoUrls?.length ? { photoUrls: input.photoUrls } : {}),
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
  };

  await writeAt(`trips/${tripId}/itinerary/${item.id}`, item);
  return item;
};

/**
 * Changes a plan and keeps a log of what moved.
 *
 * The itinerary is shared, so anyone in the trip can edit any plan - and every
 * edit leaves a trail, the same way an edited expense does.
 */
export const updateItineraryItem = async (
  tripId: string,
  itemId: string,
  input: Partial<ItineraryInput>,
  before?: ItineraryItem,
  context?: EditContext,
): Promise<EditLogEntry | null> => {
  if (!tripId || !itemId) throw new Error('No plan was selected.');

  const updates: Record<string, unknown> = {
    [`trips/${tripId}/itinerary/${itemId}/time`]: input.time?.trim() || null,
    [`trips/${tripId}/itinerary/${itemId}/location`]: input.location?.trim() || null,
    [`trips/${tripId}/itinerary/${itemId}/notes`]: input.notes?.trim() || null,
    [`trips/${tripId}/itinerary/${itemId}/photoUrls`]: input.photoUrls?.length
      ? input.photoUrls
      : null,
    [`trips/${tripId}/itinerary/${itemId}/updatedAt`]: new Date().toISOString(),
  };

  if (input.title !== undefined) {
    updates[`trips/${tripId}/itinerary/${itemId}/title`] = input.title.trim();
  }
  if (input.day !== undefined) {
    updates[`trips/${tripId}/itinerary/${itemId}/day`] = input.day;
  }

  let entry: EditLogEntry | null = null;
  if (before && context) {
    const changes = diffItinerary(before, {
      title: (input.title ?? before.title).trim(),
      day: input.day ?? before.day,
      time: input.time?.trim() || undefined,
      location: input.location?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      photoUrls: input.photoUrls?.length ? input.photoUrls : undefined,
    });
    if (changes.length) {
      entry = buildEntry(newId(), context, changes);
      updates[`trips/${tripId}/itinerary/${itemId}/history/${entry.id}`] = serializeEntry(entry);
    }
  }

  await writeUpdates(updates);
  return entry;
};

export const fetchItinerary = async (tripId: string): Promise<ItineraryItem[]> => {
  if (!tripId) return [];

  const data = (await readPath(`trips/${tripId}/itinerary`)) as Record<
    string,
    Omit<ItineraryItem, 'id'>
  > | null;
  if (!data) return [];

  return Object.entries(data)
    .map(([id, value]) => ({
      id,
      ...value,
      history: historyOf((value as { history?: unknown }).history),
    }))
    .sort((a, b) => {
      if (a.day !== b.day) return a.day < b.day ? -1 : 1;
      const aTime = a.time || '99:99';
      const bTime = b.time || '99:99';
      if (aTime !== bTime) return aTime < bTime ? -1 : 1;
      return a.createdAt < b.createdAt ? -1 : 1;
    });
};

export const deleteItineraryItem = async (tripId: string, itemId: string): Promise<void> => {
  if (!tripId || !itemId) throw new Error('No plan was selected.');
  await removeAt(`trips/${tripId}/itinerary/${itemId}`);
};

/** Groups itinerary items by day, keeping the order the service returns. */
export const groupByDay = (
  items: ItineraryItem[],
): Array<{ day: string; items: ItineraryItem[] }> => {
  const groups: Array<{ day: string; items: ItineraryItem[] }> = [];

  items.forEach((item) => {
    const existing = groups.find((group) => group.day === item.day);
    if (existing) {
      existing.items.push(item);
    } else {
      groups.push({ day: item.day, items: [item] });
    }
  });

  return groups;
};
