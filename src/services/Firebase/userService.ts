import { auth } from '@/config/firebase';
import { fetchUserTrips, leaveTrip } from '@/services/Firebase/tripService';
import { readPath, writeUpdates } from '@/services/offline/offlineStore';
import UserProfileUpdate, { AuthProfileUpdate } from '@/types/userService';
import { uploadAvatar } from '@/services/Supabase/storageService';
import {
  EmailAuthProvider,
  deleteUser,
  reauthenticateWithCredential,
  updateEmail,
  updatePassword,
  updateProfile,
} from 'firebase/auth';

export interface UserSearchResult {
  id: string;
  fullname: string;
  email: string;
  exists: boolean;
}

export async function getUserData<T = Record<string, any>>(uid?: string): Promise<T | null> {
  const targetUid = uid ?? auth.currentUser?.uid;

  if (!targetUid) {
    throw new Error('No user is signed in and no uid was provided.');
  }

  try {
    const record = (await readPath(`users/${targetUid}`)) as T | null;
    return record;
  } catch (error) {
    console.error('Failed to fetch database record:', error);
    throw error;
  }
}

export async function updateUserData(data: UserProfileUpdate, uid?: string): Promise<void> {
  const targetUid = uid ?? auth.currentUser?.uid;

  if (!targetUid) {
    throw new Error('No user is signed in and no uid was provided.');
  }

  if (!data || Object.keys(data).length === 0) {
    throw new Error('No data provided to update.');
  }

  try {
    await writeUpdates({
      [`users/${targetUid}`]: {
        ...((await readPath(`users/${targetUid}`)) as Record<string, unknown> | null),
        ...data,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Failed to update user data:', error);
    throw error;
  }
}

export async function updateAuthProfile(data: AuthProfileUpdate): Promise<void> {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error('No user is signed in.');
  }
  if (!data || Object.keys(data).length === 0) {
    throw new Error('No data provided to update.');
  }

  const tasks: Promise<any>[] = [];

  const profileFields: { displayName?: string; photoURL?: string } = {};
  if (data.displayName !== undefined) profileFields.displayName = data.displayName;
  if (data.photoURL !== undefined) profileFields.photoURL = data.photoURL;

  if (Object.keys(profileFields).length > 0) {
    tasks.push(updateProfile(currentUser, profileFields));
  }

  if (data.email !== undefined && data.email !== currentUser.email) {
    tasks.push(updateEmail(currentUser, data.email));
  }

  if (tasks.length === 0) {
    return;
  }

  try {
    await Promise.all(tasks);
  } catch (error) {
    console.error('Failed to update auth profile:', error);
    throw error;
  }
}

/**
 * Saves the signed-in user's name and (optionally) a new photo.
 *
 * The name lives in three places: the sign-in profile, the user's record, and
 * the copy kept on each trip's member list. The first two must succeed; the
 * trip copies are best effort so one unreachable trip cannot block the save.
 */
export async function saveProfile(input: {
  fullname: string;
  photoUri?: string | null;
  removePhoto?: boolean;
}): Promise<{ photoURL?: string }> {
  const user = auth.currentUser;
  if (!user) throw new Error('No user is signed in.');

  const fullname = input.fullname.trim();
  if (!fullname) throw new Error('Please enter your name.');

  let photoURL: string | undefined;
  if (input.photoUri) {
    photoURL = await uploadAvatar(input.photoUri, user.uid);
  }

  const removing = !photoURL && !!input.removePhoto;

  await updateAuthProfile({ displayName: fullname, ...(photoURL ? { photoURL } : {}) });
  if (removing) await updateProfile(user, { photoURL: '' });
  await updateUserData({ fullname, ...(photoURL ? { photoURL } : {}) });
  if (removing) await writeUpdates({ ['users/' + user.uid + '/photoURL']: null });

  try {
    const index = (await readPath('userTrips/' + user.uid)) as Record<string, unknown> | null;
    const updates: Record<string, unknown> = {};
    await Promise.all(
      Object.keys(index ?? {}).map(async (tripId) => {
        const memberPath = 'trips/' + tripId + '/members/' + user.uid;
        const member = await readPath(memberPath);
        if (!member) return;
        updates[memberPath + '/fullname'] = fullname;
        if (photoURL) updates[memberPath + '/photoURL'] = photoURL;
        if (removing) updates[memberPath + '/photoURL'] = null;
      }),
    );
    if (Object.keys(updates).length > 0) await writeUpdates(updates);
  } catch (error) {
    console.warn('Could not refresh your name on your trips:', error);
  }

  return { photoURL };
}

/** Saves the currency new trips start with. */
export async function saveDefaultCurrency(currency: string): Promise<void> {
  await updateUserData({ currency });
}

/** Checks the current password first, as Firebase requires a recent sign-in. */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const user = auth.currentUser;
  if (!user?.email) throw new Error('No user is signed in.');

  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
}

/**
 * Permanently deletes the account. Every trip is left first, which refuses if
 * money is still owed, so nobody is left with a hidden balance.
 */
export async function deleteAccount(password: string): Promise<void> {
  const user = auth.currentUser;
  if (!user?.email) throw new Error('No user is signed in.');

  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));

  const trips = await fetchUserTrips(user.uid);
  for (const trip of trips) {
    await leaveTrip(trip.id, user.uid);
  }

  await writeUpdates({ [`users/${user.uid}`]: null, [`userTrips/${user.uid}`]: null });
  await deleteUser(user);
}
