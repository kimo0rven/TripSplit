import { auth } from '@/config/firebase';
import { clearOfflineData } from '@/services/offline/offlineStore';
import { deleteToken } from '@/utils/secureStorage';
import { signOut } from 'firebase/auth';

export async function handleLogout() {
  try {
    await deleteToken();
  } catch (error) {
    console.error('Unable to clear the saved token:', error);
  }

  // The saved copy of the data belongs to the person signing out, and the
  // queue holds their unsent changes. Neither should outlive the session.
  await clearOfflineData();

  await signOut(auth);
}
