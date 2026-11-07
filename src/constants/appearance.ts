import { File, Paths } from 'expo-file-system';
import { Appearance, Platform } from 'react-native';

/**
 * Light, dark, or whatever the phone is set to. The app's colours are fixed
 * when it starts (every screen's styles are built from them once), so the
 * choice is read synchronously here, before any screen loads, and a change
 * takes effect the next time the app opens.
 */
export type AppearanceChoice = 'system' | 'light' | 'dark';

const FILE_NAME = 'appearance.txt';
const WEB_KEY = 'tripsplit.appearance';

const isChoice = (value: unknown): value is AppearanceChoice =>
  value === 'system' || value === 'light' || value === 'dark';

export const readAppearanceChoice = (): AppearanceChoice => {
  try {
    if (Platform.OS === 'web') {
      const stored = globalThis.localStorage?.getItem(WEB_KEY);
      return isChoice(stored) ? stored : 'system';
    }
    const file = new File(Paths.document, FILE_NAME);
    if (!file.exists) return 'system';
    const stored = file.textSync().trim();
    return isChoice(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
};

export const saveAppearanceChoice = (choice: AppearanceChoice): void => {
  try {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.setItem(WEB_KEY, choice);
      return;
    }
    const file = new File(Paths.document, FILE_NAME);
    if (!file.exists) file.create();
    file.write(choice);
  } catch (err) {
    console.warn('Could not save the appearance:', err);
  }
};

/** The choice the app started with, and whether that came out dark. */
export const startupChoice = readAppearanceChoice();
export const startedDark =
  startupChoice === 'dark' ||
  (startupChoice === 'system' && Appearance.getColorScheme() === 'dark');
