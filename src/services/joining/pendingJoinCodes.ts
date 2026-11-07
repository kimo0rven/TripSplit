import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Invite codes typed or scanned with no connection. A code can only be looked
 * up on the server, so it is kept here and offered again once the phone is
 * back online, where the person still sees the trip before joining.
 */
const KEY = 'tripsplit:pending-join-codes';

export interface PendingJoinCode {
  code: string;
  savedAt: string;
}

export const readPendingJoinCodes = async (): Promise<PendingJoinCode[]> => {
  try {
    const parsed = JSON.parse((await AsyncStorage.getItem(KEY)) || '[]');
    return Array.isArray(parsed)
      ? parsed.filter((item) => item && typeof item.code === 'string' && item.code)
      : [];
  } catch {
    return [];
  }
};

const write = async (codes: PendingJoinCode[]) => {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(codes));
  } catch (err) {
    console.warn('Could not save the invite code:', err);
  }
};

/** Keeps a code for later; the same code twice is kept once. */
export const savePendingJoinCode = async (code: string): Promise<void> => {
  const clean = code.trim().toUpperCase();
  if (!clean) return;
  const codes = (await readPendingJoinCodes()).filter((item) => item.code !== clean);
  await write([...codes, { code: clean, savedAt: new Date().toISOString() }]);
};

export const removePendingJoinCode = async (code: string): Promise<void> => {
  const clean = code.trim().toUpperCase();
  await write((await readPendingJoinCodes()).filter((item) => item.code !== clean));
};
