import { auth, db } from '@/config/firebase';
import { saveToken } from '@/utils/secureStorage';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
} from 'firebase/auth';
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

  // The account exists either way. If the email cannot go out now, the
  // "Check your email" screen offers to send it again.
  await sendEmailVerification(user).catch((error) =>
    console.warn('Could not send the verification email:', error),
  );

  return user;
}

/** Sends the verification email again to whoever is signed in. */
export async function resendVerificationEmail() {
  const user = auth.currentUser;
  if (!user) throw Object.assign(new Error('Not signed in.'), { code: 'auth/user-not-found' });
  await sendEmailVerification(user);
}

/**
 * Asks Firebase whether the email has been verified since the app last looked.
 * The sign-in token is refreshed too, so anything that reads the token (like
 * the database rules) sees the verified email straight away.
 */
export async function checkEmailVerified() {
  const user = auth.currentUser;
  if (!user) return false;
  await user.reload();
  const fresh = auth.currentUser;
  if (fresh?.emailVerified) await fresh.getIdToken(true);
  return !!fresh?.emailVerified;
}
