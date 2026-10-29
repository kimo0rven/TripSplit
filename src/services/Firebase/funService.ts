import { newId, readPath, removeAt, writeAt } from '@/services/offline/offlineStore';
import { ReactionMap, Track, parseTrack } from '@/utils/funExtras';

/**
 * Where the playful parts of a trip are stored.
 *
 * All of it lives under `trips/{tripId}/...` next to the expenses, so the
 * offline store already caches it and already queues writes. That is the whole
 * point: a reaction or a song tapped in a dead zone must not vanish.
 *
 * Nothing in this file can change a balance. A reaction, a song and a guess
 * are all kept somewhere that the balance maths never reads.
 */

/* ------------------------------------------------------------------ */
/* Reactions                                                          */
/* ------------------------------------------------------------------ */

/**
 * Saves one person's reaction set for one expense.
 *
 * The whole map for that expense is written, because it belongs to that
 * expense and nobody else edits it at the same moment as this person.
 */
export async function saveReactions(
  tripId: string,
  expenseId: string,
  reactions: ReactionMap,
): Promise<void> {
  if (!tripId || !expenseId) throw new Error('No expense was selected.');

  const clean: ReactionMap = {};
  Object.entries(reactions ?? {}).forEach(([emoji, people]) => {
    if (Array.isArray(people) && people.length > 0) clean[emoji] = people;
  });

  // A removal is a delete: an empty map left behind would read as "nobody
  // reacted" while still costing a field on every expense written after it.
  if (Object.keys(clean).length === 0) {
    await removeAt(`trips/${tripId}/expenses/${expenseId}/reactions`);
    return;
  }

  await writeAt(`trips/${tripId}/expenses/${expenseId}/reactions`, clean);
}

/* ------------------------------------------------------------------ */
/* Soundtrack                                                         */
/* ------------------------------------------------------------------ */

/** Every song anyone has added to the trip, newest first. */
export async function fetchTracks(tripId: string): Promise<Track[]> {
  if (!tripId) return [];

  const data = (await readPath(`trips/${tripId}/tracks`)) as Record<
    string,
    Omit<Track, 'id'>
  > | null;
  if (!data) return [];

  return Object.entries(data)
    .map(([id, value]) => ({ id, ...value }))
    .sort((a, b) => (a.addedAt < b.addedAt ? 1 : -1));
}

/** Adds a song, reading "Artist - Song" the way people type it. */
export async function addTrack(tripId: string, raw: string, addedBy: string): Promise<Track> {
  if (!tripId) throw new Error('No trip was selected.');

  const parsed = parseTrack(raw);
  if (!parsed) throw new Error('Type a song first.');

  const track: Track = {
    id: newId(),
    title: parsed.title,
    artist: parsed.artist,
    addedBy,
    addedAt: new Date().toISOString(),
  };

  await writeAt(`trips/${tripId}/tracks/${track.id}`, track);
  return track;
}

export async function deleteTrack(tripId: string, trackId: string): Promise<void> {
  if (!tripId || !trackId) throw new Error('No song was selected.');
  await removeAt(`trips/${tripId}/tracks/${trackId}`);
}

/* ------------------------------------------------------------------ */
/* Guesses                                                            */
/* ------------------------------------------------------------------ */

/** Everyone's guess, keyed by member id. Read even while guesses are hidden. */
export async function fetchGuesses(tripId: string): Promise<Record<string, number>> {
  if (!tripId) return {};

  const data = (await readPath(`trips/${tripId}/guesses`)) as Record<string, number> | null;
  if (!data) return {};

  const out: Record<string, number> = {};
  Object.entries(data).forEach(([memberId, value]) => {
    const number = Number(value);
    if (memberId && Number.isFinite(number) && number > 0) out[memberId] = number;
  });
  return out;
}

/**
 * Saves one person's guess.
 *
 * Written to their own row rather than the whole map, so two people guessing at
 * the same moment cannot overwrite each other - a lost guess would silently
 * change who wins.
 */
export async function saveGuess(tripId: string, memberId: string, guess: number): Promise<void> {
  if (!tripId || !memberId) throw new Error('No trip was selected.');
  if (!Number.isFinite(guess) || guess <= 0) throw new Error('Enter an amount greater than zero.');

  await writeAt(`trips/${tripId}/guesses/${memberId}`, Math.round(guess * 100) / 100);
}
