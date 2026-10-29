import { newId, readPath, removeAt, writeAt } from '@/services/offline/offlineStore';
import { TripNote } from '@/types/expenses';

/**
 * The trip's note feed - what everyone needs to know that is not a cost.
 *
 * Notes are kept in the same place as expenses but in their own path, so
 * nothing here can affect a balance. Anything with a price belongs in an
 * expense; a note is for "the van is booked for 7am".
 */
export const createNote = async (
  tripId: string,
  body: string,
  createdBy: string,
  photoUrls?: string[],
): Promise<TripNote> => {
  if (!tripId) throw new Error('No trip was selected.');

  const text = (body || '').trim();
  if (!text) throw new Error('Write something first.');

  const note: TripNote = {
    id: newId(),
    body: text,
    ...(photoUrls?.length ? { photoUrls } : {}),
    createdBy,
    createdAt: new Date().toISOString(),
  };

  await writeAt(`trips/${tripId}/notes/${note.id}`, note);
  return note;
};

/** Newest first, which is how a feed is read. */
export const fetchNotes = async (tripId: string): Promise<TripNote[]> => {
  if (!tripId) return [];

  const data = (await readPath(`trips/${tripId}/notes`)) as Record<
    string,
    Omit<TripNote, 'id'>
  > | null;
  if (!data) return [];

  return Object.entries(data)
    .map(([id, value]) => ({ id, ...value }))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
};

/** Notes can be removed by whoever wrote them, or by the trip's owner. */
export const deleteNote = async (tripId: string, noteId: string): Promise<void> => {
  if (!tripId || !noteId) throw new Error('No note was selected.');
  await removeAt(`trips/${tripId}/notes/${noteId}`);
};
