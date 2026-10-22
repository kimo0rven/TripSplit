import { auth, db } from '@/config/firebase';
import { saveToken } from '@/utils/secureStorage';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { ref, set } from 'firebase/database';

export async function signIn(email, password) {
  const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
  const token = await userCredential.user.getIdToken();
  // The sign-in already worked; a failure to cache the token must not block it.
  await saveToken(token).catch((error) => console.warn('Could not store the login token:', error));
  return userCredential.user;
}

export async function signUp(email, password) {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  Promise.all([
    set(ref(db, `users/${user.uid}`), {
      email: user.email,
      createdAt: new Date().toISOString(),
    }),
    user.getIdToken().then((token) => saveToken(token)),
  ]).catch((error) => {
    console.error('Unable to finish saving the new user profile:', error);
    throw error;
  });

  return user;
}
