import { db } from '@/config/firebase';
import { FriendProfile, UserSearchResult } from '@/types/friends';
import { equalTo, get, orderByChild, query, ref, update } from 'firebase/database';

export const fetchUserFriends = async (userId: string): Promise<FriendProfile[]> => {
  if (!userId) return [];

  const friendsSnapshot = await get(ref(db, `friends/${userId}`));
  if (!friendsSnapshot.exists()) return [];

  const friendsMap = friendsSnapshot.val();
  const friendIds = Object.keys(friendsMap);

  const profilePromises = friendIds.map(async (friendId) => {
    const userSnapshot = await get(ref(db, `users/${friendId}`));
    if (userSnapshot.exists()) {
      return {
        id: friendId,
        ...userSnapshot.val(),
      } as FriendProfile;
    }
    return null;
  });

  const profiles = await Promise.all(profilePromises);

  return profiles.filter((p): p is FriendProfile => p !== null);
};

export const searchUserByEmail = async (
  searchEmail: string,
  currentUserId?: string
): Promise<UserSearchResult | null> => {
  const cleanEmail = searchEmail.trim().toLowerCase();

  if (!cleanEmail) {
    return null;
  }

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

export const addFriendById = async (
  currentUserId: string,
  friendUserId: string
): Promise<void> => {
  if (!currentUserId || !friendUserId) {
    throw new Error('Both user IDs are required.');
  }

  if (currentUserId === friendUserId) {
    throw new Error('You cannot add yourself as a friend.');
  }

  const updates: Record<string, boolean> = {
    [`friends/${currentUserId}/${friendUserId}`]: true,
    [`friends/${friendUserId}/${currentUserId}`]: true,
  };

  await update(ref(db), updates);
};

export const addFriendByEmail = async (
  currentUserId: string,
  friendEmail: string
): Promise<{ success: boolean; friendId?: string; message?: string }> => {
  const cleanEmail = friendEmail.trim().toLowerCase();

  if (!cleanEmail) {
    return { success: false, message: 'Please enter a valid email address.' };
  }

  const usersRef = ref(db, 'users');
  const userQuery = query(usersRef, orderByChild('email'), equalTo(cleanEmail));
  const snapshot = await get(userQuery);

  if (!snapshot.exists()) {
    return { success: false, message: 'User not found.' };
  }

  const usersData = snapshot.val();
  const friendUserId = Object.keys(usersData)[0];

  if (friendUserId === currentUserId) {
    return { success: false, message: 'You cannot add yourself.' };
  }


  await addFriendById(currentUserId, friendUserId);

  return { success: true, friendId: friendUserId };
};