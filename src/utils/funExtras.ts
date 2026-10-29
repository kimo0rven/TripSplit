/**
 * The parts of the fun tab that need something saved on the server.
 *
 * Everything here is still pure: no database calls, no React. The services
 * read and write the stored shape, and these functions decide what it means.
 * That split is what keeps the interesting rules testable.
 */

import type { Expense } from '@/types/expenses';
import type { TripMember } from '@/types/trips';

/* ------------------------------------------------------------------ */
/* Expense reactions                                                  */
/* ------------------------------------------------------------------ */

/**
 * The emoji a person may leave on an expense.
 *
 * Kept to six: a longer row stops being a reaction and becomes a menu. Each
 * one has an obvious money meaning, so nobody has to guess.
 */
export const REACTIONS = ['😱', '🔥', '😂', '👏', '😢', '💸'] as const;

export type Reaction = (typeof REACTIONS)[number];

/**
 * Reactions as they are stored: emoji -> the people who chose it.
 *
 * Stored this way so one person can only appear once per emoji without any
 * extra bookkeeping, and so adding a reaction is a single field write rather
 * than a list rewrite that could lose someone else's tap.
 */
export type ReactionMap = Record<string, string[]>;

export const isReaction = (value: string): value is Reaction =>
  (REACTIONS as readonly string[]).includes(value);

/**
 * One person's tap, on or off.
 *
 * Tapping the same emoji twice removes it, which is what every chat app does
 * and needs no "undo" button. Returns a new map: the caller stores it.
 */
export function toggleReaction(current: ReactionMap, emoji: string, memberId: string): ReactionMap {
  const map: ReactionMap = {};
  Object.entries(current ?? {}).forEach(([key, people]) => {
    map[key] = Array.isArray(people) ? [...people] : [];
  });

  const mine = map[emoji] ?? [];
  const had = mine.includes(memberId);

  // One reaction per person per expense, the way a chat works: picking a new
  // face means you changed your mind, not that you left two.
  Object.keys(map).forEach((key) => {
    map[key] = key === emoji ? [] : map[key].filter((id) => id !== memberId);
  });

  map[emoji] = had ? [] : [...mine, memberId];

  // Empty entries are removed, so a stored expense does not fill up with
  // leftover keys nobody reacted to.
  Object.keys(map).forEach((key) => {
    if (map[key].length === 0) delete map[key];
  });

  return map;
}

/** Who reacted to an expense, with the count and whether it is yours. */
export interface ReactionRow {
  emoji: string;
  count: number;
  /** The first names of two people who chose it, for the tooltip text. */
  names: string[];
  mine: boolean;
}

/** Turns a stored map into the rows the card draws, biggest first. */
export function reactionRows(
  current: ReactionMap | undefined,
  members: TripMember[],
  currentUserId: string,
): ReactionRow[] {
  const nameOf = (id: string) =>
    members.find((member) => member.id === id)?.fullname.split(' ')[0] ?? 'Someone';

  return Object.entries(current ?? {})
    .filter(([emoji, people]) => isReaction(emoji) && Array.isArray(people) && people.length > 0)
    .map(([emoji, people]) => ({
      emoji,
      count: people.length,
      names: people.map(nameOf),
      mine: people.includes(currentUserId),
    }))
    .sort((a, b) => b.count - a.count);
}

/* ------------------------------------------------------------------ */
/* Trip soundtrack                                                    */
/* ------------------------------------------------------------------ */

export interface Track {
  id: string;
  /** The song, as typed: "Wonderwall". */
  title: string;
  /** Who sings it, as typed. */
  artist: string;
  addedBy: string;
  addedAt: string;
}

/** The longest a song entry may be, so one paste cannot wreck the card. */
const MAX_TRACK_FIELD = 60;

/**
 * Reads a typed song into its two parts.
 *
 * Accepts "Artist - Song", "Song by Artist", or just a song name, because
 * people type all three and being strict here would only cause errors.
 */
export function parseTrack(raw: string): { title: string; artist: string } | null {
  const text = (raw || '').trim().replace(/\s+/g, ' ');
  if (!text) return null;

  const cut = (value: string) => value.trim().slice(0, MAX_TRACK_FIELD);

  const dash = /^(.+?)\s+[-–—]\s+(.+)$/.exec(text);
  if (dash) return { artist: cut(dash[1]), title: cut(dash[2]) };

  const by = /^(.+?)\s+by\s+(.+)$/i.exec(text);
  if (by) return { title: cut(by[1]), artist: cut(by[2]) };

  return { title: cut(text), artist: '' };
}

/** Whether the same song is already on the list, ignoring case and spacing. */
export function isDuplicateTrack(
  tracks: Track[],
  parsed: { title: string; artist: string },
): boolean {
  const key = (value: string) => value.trim().toLowerCase();
  return tracks.some(
    (track) => key(track.title) === key(parsed.title) && key(track.artist) === key(parsed.artist),
  );
}

/* ------------------------------------------------------------------ */
/* Guess the total                                                    */
/* ------------------------------------------------------------------ */

/**
 * Whether the guess game is open.
 *
 * Guesses hide until the trip is over, otherwise the first person to open the
 * tab could read the total off the recap and win every time.
 */
export function guessesOpen(tripEnded: boolean): boolean {
  return tripEnded;
}

/** The locked message, so the screen and the tests say the same thing. */
export const GUESSES_LOCKED_HINT =
  'Guesses stay hidden until the trip ends, so nobody can peek at the final total.';

/* ------------------------------------------------------------------ */
/* Split roulette                                                     */
/* ------------------------------------------------------------------ */

/**
 * A fun split of one bill, for entertainment only.
 *
 * Returns whole cents that add up to exactly the amount, using the largest
 * remainder method, so a roulette can never leave a cent floating. The shares
 * are deliberately uneven: an even split is not a game.
 */
export function rouletteShares(
  amount: number,
  memberIds: string[],
  random: () => number = Math.random,
): Record<string, number> {
  const cents = Math.round((amount || 0) * 100);
  if (cents <= 0 || memberIds.length === 0) return {};

  // Each person draws a weight; nobody can draw zero, or they would pay
  // nothing at all and the "split" would look broken.
  const weights = memberIds.map(() => 0.2 + random() * 1.8);
  const total = weights.reduce((sum, weight) => sum + weight, 0);

  const exact = weights.map((weight) => (weight / total) * cents);
  const floored = exact.map((value) => Math.floor(value));

  // Hand the leftover cents to the largest fractions, one each.
  let left = cents - floored.reduce((sum, value) => sum + value, 0);
  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);

  for (let i = 0; left > 0 && order.length > 0; i++) {
    floored[order[i % order.length].index] += 1;
    left -= 1;
  }

  const result: Record<string, number> = {};
  memberIds.forEach((id, index) => {
    result[id] = floored[index] / 100;
  });
  return result;
}

/** Whether a split is only being tried, not saved. Always true: it is a toy. */
export const ROULETTE_HINT = 'Just for fun. Nothing here is saved or owed.';

/* ------------------------------------------------------------------ */
/* Photo per note                                                     */
/* ------------------------------------------------------------------ */

/**
 * Whether a queued note photo can be sent now.
 *
 * A photo uploads to cloud storage, which has no offline queue: only expenses
 * and notes do. Saying so plainly beats a spinner that never finishes.
 */
export function canUploadPhotos(online: boolean): { ok: boolean; reason: string } {
  if (online) return { ok: true, reason: '' };
  return {
    ok: false,
    reason: 'Photos need a connection. The note text is still saved and will send on its own.',
  };
}

/** How many photos one note may carry, so the feed stays a feed. */
export const NOTE_PHOTO_LIMIT = 4;

/* ------------------------------------------------------------------ */
/* Who should pay for one expense, amused                             */
/* ------------------------------------------------------------------ */

/** A short line for the roulette result, so the screen has no strings of its own. */
export function rouletteSummary(
  shares: Record<string, number>,
  members: TripMember[],
  formatMoney: (amount: number) => string,
): { memberId: string; name: string; amount: number; label: string }[] {
  return Object.entries(shares)
    .map(([memberId, amount]) => {
      const member = members.find((entry) => entry.id === memberId);
      return {
        memberId,
        name: member?.fullname.split(' ')[0] ?? 'Someone',
        amount,
        label: formatMoney(amount),
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

/** An expense with reactions, as the card reads it. */
export type ReactedExpense = Expense & { reactions?: ReactionMap };
