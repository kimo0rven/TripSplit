import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// SecureStore has no web implementation, so the browser falls back to localStorage.
const isWeb = Platform.OS === 'web';

export async function saveToken(token) {
  if (isWeb) {
    globalThis.localStorage?.setItem('userToken', token);
    return;
  }
  await SecureStore.setItemAsync('userToken', token);
}

export async function getToken() {
  if (isWeb) {
    return globalThis.localStorage?.getItem('userToken') ?? null;
  }
  return await SecureStore.getItemAsync('userToken');
}

export async function deleteToken() {
  if (isWeb) {
    globalThis.localStorage?.removeItem('userToken');
    return;
  }
  await SecureStore.deleteItemAsync('userToken');
}
