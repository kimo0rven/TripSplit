import { auth, db } from '@/config/firebase';
import { saveToken } from '@/utils/secureStorage';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { ref, set } from 'firebase/database';

export async function signUp(email, password, displayName) {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  Promise.all([
    set(ref(db, `users/${user.uid}`), {
      email: user.email,
      displayName: displayName || '',
      createdAt: new Date().toISOString(),
    }),
    user.getIdToken().then((token) => saveToken(token)),
  ]).catch((error) => {
    console.error('Unable to finish saving the new user profile:', error);
  });

  return user;
}