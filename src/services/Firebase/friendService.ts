import { db } from '@/config/firebase';
import { isConnected, readPath, writeUpdates } from '@/services/offline/offlineStore';
import { myName, notify } from '@/services/notifications/inbox';
import { fetchExpenses } from '@/services/Firebase/expenseService';
import { fetchSettlements } from '@/services/Firebase/settlementService';
import { fetchUserTrips } from '@/services/Firebase/tripService';
import { FriendProfile, FriendRequest, UserSearchResult } from '@/types/friends';
import { computeBalances, simplifyDebts } from '@/utils/balance';
import { equalTo, get, orderByChild, query, ref } from 'firebase/database';

/** Said whenever a step needs the server and the phone has no connection. */
export const OFFLINE_MESSAGE =
  'This needs a connection. It will work again once you are back online.';

const requireConnection = (): void => {
  if (!isConnected()) throw new Error(OFFLINE_MESSAGE);
};

/** Path of one request inside the receiver's inbox. */
const inboxPath = (toId: string, fromId: string) => `friendRequests/incoming/${toId}/${fromId}`;

/** Path of the same request inside the sender's outbox. */
const outboxPath = (fromId: string, toId: string) => `friendRequests/outgoing/${fromId}/${toId}`;

/**
 * A user's display name. Older accounts only stored their name in Firebase Auth
 * (which the app cannot read for other people), so fall back to the email, then
 * to a plain placeholder. Saving the name into the database is what makes the
 * friends list show real names - see `saveMyProfileName` below.
 */
const nameOf = (record: any): string => {
  const fullname = typeof record?.fullname === 'string' ? record.fullname.trim() : '';
  if (fullname) return fullname;
  return '';
};

/**
 * Writes the signed-in user's own name and email into the database.
 *
 * Without this, `users/$uid` holds only an email, and every friend sees the
 * word "Friend" instead of a name. Safe to call on every app start: it only
 * writes when something actually differs.
 */
export const saveMyProfileName = async (
  uid: string,
  fullname?: string | null,
  email?: string | null,
): Promise<void> => {
  const name = (fullname || '').trim();
  if (!uid || !name) return;

  const current = ((await readPath(`users/${uid}`)) as Record<string, any> | null) ?? {};

  const patch: Record<string, any> = {};
  if (current.fullname !== name) patch.fullname = name;
  if (email && current.email !== email) patch.email = email;

  if (Object.keys(patch).length === 0) return;
  await writeUpdates({ [`users/${uid}`]: { ...current, ...patch } });
};

export const fetchUserFriends = async (userId: string): Promise<FriendProfile[]> => {
  if (!userId) return [];

  const friendsMap = (await readPath(`friends/${userId}`)) as Record<string, unknown> | null;
  if (!friendsMap) return [];

  const friendIds = Object.keys(friendsMap);

  const profilePromises = friendIds.map(async (friendId) => {
    const record = (await readPath(`users/${friendId}`)) as Record<string, any> | null;
    if (record) {
      return {
        ...record,
        id: friendId,
        fullname: nameOf(record) || record.email || 'Friend',
      } as FriendProfile;
    }
    return null;
  });

  const profiles = await Promise.all(profilePromises);

  return profiles.filter((p): p is FriendProfile => p !== null);
};

export const searchUserByEmail = async (
  searchEmail: string,
  currentUserId?: string,
): Promise<UserSearchResult | null> => {
  const cleanEmail = searchEmail.trim().toLowerCase();

  if (!cleanEmail) {
    return null;
  }

  requireConnection();
  const usersRef = ref(db, 'users');
  const userQuery = query(usersRef, orderByChild('email'), equalTo(cleanEmail));
  const snapshot = await get(userQuery);

  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.val();
  const userId = Object.keys(data)[0];

  if (currentUserId && userId === currentUserId) {
    throw new Error('You cannot search or add yourself.');
  }

  return {
    id: userId,
    ...data[userId],
  } as UserSearchResult;
};

/** True when the two users are already friends. */
export const areFriends = async (a: string, b: string): Promise<boolean> => {
  if (!a || !b) return false;
  const record = await readPath(`friends/${a}/${b}`);
  return record !== null;
};

/**
 * Sends a friendship request. Nothing is linked until the other person accepts.
 *
 * Two copies of the request are written - one into the receiver's inbox and one
 * into the sender's outbox - so each side can see it under its own permissions.
 */
export const sendFriendRequest = async (
  from: { id: string; fullname: string; email: string },
  toId: string,
): Promise<void> => {
  if (!from.id || !toId) throw new Error('Both users are required.');
  if (from.id === toId) throw new Error('You cannot add yourself.');

  if (await areFriends(from.id, toId)) {
    throw new Error('You are already friends.');
  }

  // Already sent? Don't spam a second request.
  const sentAlready = await readPath(outboxPath(from.id, toId));
  if (sentAlready !== null) {
    throw new Error('You already sent them a request. It is waiting to be accepted.');
  }

  // They asked first? Then the answer is on this screen, not a new request.
  const theyAsked = await readPath(inboxPath(from.id, toId));
  if (theyAsked !== null) {
    throw new Error('They already sent you a request. Accept it from the list below.');
  }

  const toRecord = (await readPath(`users/${toId}`)) as Record<string, any> | null;
  if (!toRecord) {
    throw new Error('User not found.');
  }

  const fromRecord = (await readPath(`users/${from.id}`)) as Record<string, any> | null;
  const fromPhoto = typeof fromRecord?.photoURL === 'string' ? fromRecord.photoURL : '';
  const toPhoto = typeof toRecord.photoURL === 'string' ? toRecord.photoURL : '';

  const request: FriendRequest = {
    ...(fromPhoto ? { fromPhotoURL: fromPhoto } : {}),
    ...(toPhoto ? { toPhotoURL: toPhoto } : {}),
    fromId: from.id,
    fromName: from.fullname,
    fromEmail: from.email,
    toId,
    toName: nameOf(toRecord) || toRecord.email || '',
    toEmail: toRecord.email || '',
    createdAt: new Date().toISOString(),
  };

  await writeUpdates({
    [inboxPath(toId, from.id)]: request,
    [outboxPath(from.id, toId)]: request,
  });

  await notify(toId, 'friendRequests', 'New friend request', from.fullname + ' wants to be your friend.');
};

const readRequests = (value: unknown): FriendRequest[] => {
  if (!value) return [];
  return Object.values(value as Record<string, FriendRequest>);
};

/** Requests waiting for this user to say yes or no. */
export const fetchIncomingRequests = async (userId: string): Promise<FriendRequest[]> => {
  if (!userId) return [];
  const value = await readPath(`friendRequests/incoming/${userId}`);
  return readRequests(value).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
};

/** Requests this user has sent that nobody has answered yet. */
export const fetchOutgoingRequests = async (userId: string): Promise<FriendRequest[]> => {
  if (!userId) return [];
  const value = await readPath(`friendRequests/outgoing/${userId}`);
  return readRequests(value).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
};

/**
 * Accepts a request. Both people become friends in one atomic write, and the
 * request itself is removed from both inboxes.
 */
export const acceptFriendRequest = async (meId: string, fromId: string): Promise<void> => {
  if (!meId || !fromId) throw new Error('Both users are required.');

  await writeUpdates({
    [`friends/${meId}/${fromId}`]: true,
    [`friends/${fromId}/${meId}`]: true,
    [inboxPath(meId, fromId)]: null,
    [outboxPath(fromId, meId)]: null,
  });

  await notify(fromId, 'friendAccepted', 'Friend request accepted', myName() + ' is now your friend.');
};

/** Refuses a request, or withdraws one you sent. Either way it disappears. */
export const removeFriendRequest = async (meId: string, otherId: string): Promise<void> => {
  if (!meId || !otherId) throw new Error('Both users are required.');

  await writeUpdates({
    [inboxPath(meId, otherId)]: null,
    [inboxPath(otherId, meId)]: null,
    [outboxPath(meId, otherId)]: null,
    [outboxPath(otherId, meId)]: null,
  });
};

/** Removes a friendship, in both directions. */
export const removeFriend = async (meId: string, friendId: string): Promise<void> => {
  if (!meId || !friendId) throw new Error('Both users are required.');

  await writeUpdates({
    [`friends/${meId}/${friendId}`]: null,
    [`friends/${friendId}/${meId}`]: null,
  });
};

/**
 * One trip where the signed-in user and a friend both belong, and what sits
 * between them there.
 */
export interface FriendDebt {
  tripId: string;
  tripName: string;
  currency: string;
  /**
   * What YOU owe them in this trip. Positive means you owe them; negative means
   * they owe you. Only the simplified debts are counted, so a trip where the
   * two of you cancel out reads as nothing owed.
   */
  youOwe: number;
}

/**
 * Finds every trip the two of you share and works out what is owed between you.
 *
 * The balances are simplified first, so a chain like "you owe Maria, Maria owes
 * Jun" is turned into the smallest set of payments before the pair is read off
 * it. Trips where the two of you are level are left out entirely.
 */
export const fetchDebtsWithFriend = async (
  meId: string,
  friendId: string,
): Promise<FriendDebt[]> => {
  if (!meId || !friendId) return [];

  const trips = await fetchUserTrips(meId);
  const shared = trips.filter((trip) => !!trip.members?.[friendId]);
  if (shared.length === 0) return [];

  const results = await Promise.all(
    shared.map(async (trip) => {
      const [expenses, settlements] = await Promise.all([
        fetchExpenses(trip.id),
        fetchSettlements(trip.id),
      ]);

      const memberIds = Object.keys(trip.members ?? {});
      const balances = computeBalances(memberIds, expenses, settlements);
      const edges = simplifyDebts(balances);

      const owed = edges
        .filter(
          (edge) =>
            (edge.from === meId && edge.to === friendId) ||
            (edge.from === friendId && edge.to === meId),
        )
        .reduce((sum, edge) => sum + (edge.from === meId ? edge.amount : -edge.amount), 0);

      return {
        tripId: trip.id,
        tripName: trip.name,
        currency: trip.currency || 'PHP',
        youOwe: Math.round(owed * 100) / 100,
      };
    }),
  );

  return results
    .filter((entry) => Math.abs(entry.youOwe) >= 0.01)
    .sort((a, b) => Math.abs(b.youOwe) - Math.abs(a.youOwe));
};

/** Kept for older callers: sends a request rather than linking straight away. */
export const addFriendById = async (currentUserId: string, friendUserId: string): Promise<void> => {
  if (!currentUserId || !friendUserId) {
    throw new Error('Both user IDs are required.');
  }

  if (currentUserId === friendUserId) {
    throw new Error('You cannot add yourself as a friend.');
  }

  const me = ((await readPath(`users/${currentUserId}`)) as Record<string, any> | null) ?? {};

  await sendFriendRequest(
    {
      id: currentUserId,
      fullname: nameOf(me) || me.email || 'Someone',
      email: me.email || '',
    },
    friendUserId,
  );
};

export const addFriendByEmail = async (
  currentUserId: string,
  friendEmail: string,
): Promise<{ success: boolean; friendId?: string; message?: string }> => {
  const cleanEmail = friendEmail.trim().toLowerCase();

  if (!cleanEmail) {
    return { success: false, message: 'Please enter a valid email address.' };
  }

  requireConnection();

  const usersRef = ref(db, 'users');
  const userQuery = query(usersRef, orderByChild('email'), equalTo(cleanEmail));
  const snapshot = await get(userQuery);

  if (!snapshot.exists()) {
    return { success: false, message: 'No TripSplit account uses that email.' };
  }

  const usersData = snapshot.val();
  const friendUserId = Object.keys(usersData)[0];

  if (friendUserId === currentUserId) {
    return { success: false, message: 'You cannot add yourself.' };
  }

  if (await areFriends(currentUserId, friendUserId)) {
    return { success: false, message: 'You are already friends.' };
  }

  try {
    await addFriendById(currentUserId, friendUserId);
  } catch (err: any) {
    return { success: false, message: err?.message || 'Could not send that request.' };
  }

  return { success: true, friendId: friendUserId };
};
