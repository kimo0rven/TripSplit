import { useSyncExternalStore } from 'react';
import { StyleSheet } from 'react-native';

import { getThemeVersion, subscribeToTheme } from './theme';

/** Redraws the component whenever the app's colours change. */
export const useThemeVersion = () =>
  useSyncExternalStore(subscribeToTheme, getThemeVersion, getThemeVersion);

/**
 * `StyleSheet.create`, but rebuilt from the current colours after the theme
 * switches. The styles are made the first time one is read, and again on the
 * first read after each switch, so `styles.card` always has today's colours.
 */
export const themedStyles = <T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: () => T & StyleSheet.NamedStyles<any>,
): T => {
  let built: T | null = null;
  let builtFor = -1;
  const current = (): T => {
    const version = getThemeVersion();
    if (!built || builtFor !== version) {
      built = StyleSheet.create(factory());
      builtFor = version;
    }
    return built;
  };
  return new Proxy({} as T, {
    get: (_target, key) => (current() as any)[key],
    has: (_target, key) => key in current(),
    ownKeys: () => Reflect.ownKeys(current()),
    getOwnPropertyDescriptor: (_target, key) => {
      const descriptor = Reflect.getOwnPropertyDescriptor(current(), key);
      return descriptor ? { ...descriptor, configurable: true } : undefined;
    },
  });
};
