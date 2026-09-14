import { auth, db } from '@/config/firebase';
import UserProfileUpdate, { AuthProfileUpdate } from '@/types/userService';
import { updateEmail, updateProfile } from 'firebase/auth';
import { get, ref, update } from 'firebase/database';

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
    const snapshot = await get(ref(db, `users/${targetUid}`));
    return snapshot.exists() ? (snapshot.val() as T) : null;
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
    await update(ref(db, `users/${targetUid}`), {
      ...data,
      updatedAt: new Date().toISOString(),
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

