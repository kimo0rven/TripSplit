import { auth } from '@/config/firebase';
import { clearOfflineData } from '@/services/offline/offlineStore';
import { deleteToken } from '@/utils/secureStorage';
import { signOut } from 'firebase/auth';
import { forgetPushToken } from '@/services/reminders/push';

export async function handleLogout() {
  try {
    await deleteToken();
  } catch (error) {
    console.error('Unable to clear the saved token:', error);
  }

  // This phone should stop getting this account's notifications.
  if (auth.currentUser) await forgetPushToken(auth.currentUser.uid);

  // The saved copy of the data belongs to the person signing out, and the
  // queue holds their unsent changes. Neither should outlive the session.
  await clearOfflineData();

  await signOut(auth);
}
