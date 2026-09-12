import { saveToken } from '../utils/secureStorage';

async function handleLogin(email, password) {
  const response = await signInWithFirebase(email, password);
  const token = await response.user.getIdToken();

  await saveToken(token);
}