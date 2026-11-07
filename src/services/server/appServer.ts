import { auth } from '@/config/firebase';

/**
 * The app's small server (the Supabase function that also handles PayMongo).
 * It does what the phone shouldn't: sending pushes to other people, and
 * handing out storage upload links. Every call carries the person's Firebase
 * sign-in so the server knows who is asking.
 */
const serverUrl = (process.env.EXPO_PUBLIC_PAYMONGO_SERVER_URL || '').trim().replace(/\/$/, '');

/** The project's publishable key, which Supabase wants on every function call. */
const publicKey = (() => {
  const key = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '').trim();
  return key.startsWith('sb_secret_') ? '' : key;
})();

export const hasServer = (): boolean => Boolean(serverUrl);

export async function callServer<T = Record<string, unknown>>(
  path: string,
  body: Record<string, unknown>,
  timeoutMs = 20_000,
): Promise<T> {
  if (!serverUrl)
    throw new Error('This build has no server address (EXPO_PUBLIC_PAYMONGO_SERVER_URL).');
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in first.');
  const token = await user.getIdToken();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(serverUrl + path, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-firebase-token': token,
        ...(publicKey ? { apikey: publicKey, authorization: `Bearer ${publicKey}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.ok === false) {
      throw new Error(payload?.error || `The server answered ${response.status}.`);
    }
    return payload as T;
  } finally {
    clearTimeout(timer);
  }
}
