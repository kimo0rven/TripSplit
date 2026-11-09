import { File, Paths } from 'expo-file-system';
import { Appearance, Platform } from 'react-native';

/**
 * Light, dark, or whatever the phone is set to. The choice is read
 * synchronously here, before any screen loads, so the first screen already
 * has the right colours. Changing it later switches the colours straight away
 * (see `setDarkTheme` in theme.ts).
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

let currentChoice = readAppearanceChoice();

const wantsDark = (choice: AppearanceChoice) =>
  choice === 'dark' || (choice === 'system' && Appearance.getColorScheme() === 'dark');

/** Whether the app opens in the dark. */
export const startedDark = wantsDark(currentChoice);

/** The choice in use right now. */
export const getAppearanceChoice = () => currentChoice;

/** Saves the choice and switches the colours to match, straight away. */
export const applyAppearanceChoice = (choice: AppearanceChoice): void => {
  currentChoice = choice;
  saveAppearanceChoice(choice);
  // Loaded here, not at the top, because theme.ts reads `startedDark` from this file.
  require('./theme').setDarkTheme(wantsDark(choice));
};

/** Keeps "Same as phone" in step with the phone. Returns a stop function. */
export const followAppearance = (): (() => void) => {
  const subscription = Appearance.addChangeListener(() => {
    if (currentChoice === 'system') require('./theme').setDarkTheme(wantsDark('system'));
  });
  return () => subscription.remove();
};
