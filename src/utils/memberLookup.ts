/**
 * Turn a member list into a lookup.
 *
 * Every list in the app needs the same two things while drawing a row: the
 * name behind an id, and the photo behind an id. Doing that with
 * `members.find(...)` is a scan from the top for every id on every row, so a
 * trip with 10 people and 40 expenses does thousands of comparisons just to
 * paint one screen.
 *
 * A record built once and read by key turns each of those into a single
 * property read. Built once per render via `useMemo` in the caller, so the
 * cost is one pass over the members instead of one pass per lookup.
 *
 * No imports: this stays testable with the plain Node runner.
 */
export type MemberLike = {
  id: string;
  fullname?: string;
  photoURL?: string;
};

export interface MemberLookup<T extends MemberLike> {
  /** The whole member, or undefined when they left the trip. */
  get: (id: string) => T | undefined;
  /** Their name, or the fallback the caller wants shown instead. */
  nameOf: (id: string, fallback?: string) => string;
  /** Their photo, or undefined so the avatar falls back to initials. */
  photoOf: (id: string) => string | undefined;
}

/**
 * Build a lookup for one member list.
 *
 * Duplicate ids cannot happen (they are keys in the database), but if one ever
 * does the last one wins rather than throwing: a drawing helper should never be
 * the thing that crashes a screen.
 */
export function memberLookup<T extends MemberLike>(
  members: readonly T[],
  fallback = 'Someone',
): MemberLookup<T> {
  const byId: Record<string, T> = {};
  members.forEach((member) => {
    byId[member.id] = member;
  });

  const get = (id: string): T | undefined => byId[id];

  return {
    get,
    nameOf: (id: string, name = fallback) => byId[id]?.fullname || name,
    photoOf: (id: string) => byId[id]?.photoURL,
  };
}

/**
 * The first name only.
 *
 * Cards are narrow, so "Ana" reads where "Ana Villanueva" would be cut off.
 * A person who has not set a name still gets the fallback rather than an
 * empty string that looks like a missing face.
 */
export function firstName(fullname: string | undefined, fallback = 'Someone'): string {
  const first = (fullname ?? '').trim().split(/\s+/)[0];
  return first || fallback;
}
