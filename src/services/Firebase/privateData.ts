import { readPath, writeUpdates } from '@/services/offline/offlineStore';

/**
 * Where people's data lives:
 *   users/{uid}        name, photo and email: readable by anyone signed in,
 *                      one person at a time (nobody can list everyone)
 *   userPrivate/{uid}  push token, notification settings, archived trips:
 *                      only that person can read it
 *   emailIndex/{key}   email -> uid, so a friend can be found by exact email
 *                      without anyone being able to list emails
 */
const PRIVATE_KEYS = ['pushToken', 'notificationSettings', 'notificationPrefs', 'archivedTrips'];

/** A Firebase key for an email: the characters keys can't hold are swapped out. */
export const emailKey = (email: string): string =>
  email
    .trim()
    .toLowerCase()
    .replace(/%/g, '%25')
    .replace(/\./g, '%2E')
    .replace(/#/g, '%23')
    .replace(/\$/g, '%24')
    .replace(/\[/g, '%5B')
    .replace(/\]/g, '%5D')
    .replace(/\//g, '%2F');

/**
 * Moves this person's private settings out of their public profile, once,
 * and makes sure they can be found by email. Safe to run on every start.
 */
export const tidyMyData = async (uid: string, email?: string | null): Promise<void> => {
  try {
    const profile = (await readPath(`users/${uid}`, { preferCache: false })) as Record<
      string,
      unknown
    > | null;
    const updates: Record<string, unknown> = {};
    for (const key of PRIVATE_KEYS) {
      if (profile && profile[key] !== undefined && profile[key] !== null) {
        const existing = await readPath(`userPrivate/${uid}/${key}`, { preferCache: false });
        if (existing === null) updates[`userPrivate/${uid}/${key}`] = profile[key];
        updates[`users/${uid}/${key}`] = null;
      }
    }
    if (email) {
      const key = emailKey(email);
      const indexed = await readPath(`emailIndex/${key}`, { preferCache: false }).catch(() => null);
      if (indexed !== uid) updates[`emailIndex/${key}`] = uid;
    }
    if (Object.keys(updates).length) await writeUpdates(updates);
  } catch (err) {
    console.warn('Could not tidy the profile:', err);
  }
};

/**
 * Finds someone by their exact email, shaped like a database query result so
 * the callers that used to query `users` by email stay the same.
 */
export const lookupEmail = async (
  email: string,
): Promise<{ exists: () => boolean; val: () => Record<string, Record<string, any>> }> => {
  const uid = (await readPath(`emailIndex/${emailKey(email)}`, { preferCache: false }).catch(
    () => null,
  )) as string | null;
  const profile = uid
    ? ((await readPath(`users/${uid}`, { preferCache: false }).catch(() => null)) as Record<
        string,
        any
      > | null)
    : null;
  const found = uid && profile ? { [uid]: profile } : null;
  return { exists: () => !!found, val: () => found ?? {} };
};
