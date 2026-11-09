/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

import { startedDark } from './appearance';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const;

const LIGHT_COLORS = {
  base50: '#FEBB1B',
  base200: '#FFE099',
  base400: '#FED766',
  base500: '#FEBB1B',
  base600: '#FEBB1B',
  base700: '#C4900D',
  heading: '#1A1A1A',
  primary: '#333333',
  secondary: '#909090',
  disabled: '#C4C4C4',
  background: '#FFFFFF',
  surfaceAlt: '#FAFAFA',
  inputField: '#F0F0F0',
  border: '#E0E0E0',
  success: '#27AE60',
  successBg: '#E9F9EF',
  error: '#EB5757',
  errorBg: '#FDEDED',
  warning: '#F2994A',
  warningBg: '#FEF3E7',
  info: '#2F80ED',
  infoBg: '#EAF2FE',
  /** Text and icons on the brand yellow: dark in both themes. */
  onBrand: '#333333',
  /**
   * Soft yellow tints, kept as tints in dark mode too (there everything else
   * yellow is the bright brand yellow). Only the dashboard's quick actions use these.
   */
  tint200: '#FFE099',
  tint400: '#FED766',
};

/**
 * The same roles in the dark. Neutrals flip; every yellow, the pale ones
 * included, is the bright brand yellow with dark text on it (`onBrand`).
 * Only the quick actions keep dark gold tints (`tint200`, `tint400`).
 */
const DARK_COLORS: typeof LIGHT_COLORS = {
  base50: '#FEBB1B',
  base200: '#FEBB1B',
  base400: '#FEBB1B',
  base500: '#FEBB1B',
  base600: '#FEBB1B',
  base700: '#F2C04D',
  heading: '#F5F5F5',
  primary: '#E8E8E8',
  secondary: '#A0A0A0',
  disabled: '#5C5C5C',
  background: '#121212',
  surfaceAlt: '#1A1A1A',
  inputField: '#262626',
  border: '#363636',
  success: '#4CC27F',
  successBg: '#143021',
  error: '#F07171',
  errorBg: '#3A1A1A',
  warning: '#F5A75E',
  warningBg: '#3A2A14',
  info: '#6AA6F5',
  infoBg: '#16263E',
  onBrand: '#1A1A1A',
  tint200: '#3D3214',
  tint400: '#5A4613',
};

/**
 * The app's colours. This one object is shared by every screen and is changed
 * in place when the theme switches, so any code that reads
 * `BrandColors.background` while drawing gets the current colour. Styles made
 * with `themedStyles` are rebuilt from it, and the root layout redraws every
 * screen when the version below changes.
 */
export const BrandColors: typeof LIGHT_COLORS = { ...(startedDark ? DARK_COLORS : LIGHT_COLORS) };

let dark = startedDark;
let themeVersion = 0;
const listeners = new Set<() => void>();

/** Whether the dark colours are showing right now. */
export const isDarkTheme = () => dark;

/** Whether a colour is the brand yellow, which needs `onBrand` text on it. */
export const isBrandYellow = (color?: string) =>
  !!color &&
  (color === BrandColors.base50 || color === BrandColors.base500 || color === BrandColors.base600);

/** Goes up by one every time the colours change. */
export const getThemeVersion = () => themeVersion;

export const subscribeToTheme = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Switches every colour to the light or dark set, and redraws the app. */
export const setDarkTheme = (next: boolean) => {
  if (next === dark) return;
  dark = next;
  Object.assign(BrandColors, next ? DARK_COLORS : LIGHT_COLORS);
  themeVersion += 1;
  listeners.forEach((listener) => listener());
};

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

export const FontAssets = {
  'PlusJakartaSans-Bold': require('@/assets/fonts/Plus_Jakarta_Sans/static/PlusJakartaSans-Bold.ttf'),
  'PlusJakartaSans-Bold-Italic': require('@/assets/fonts/Plus_Jakarta_Sans/static/PlusJakartaSans-BoldItalic.ttf'),
  'PlusJakartaSans-ExtraBold': require('@/assets/fonts/Plus_Jakarta_Sans/static/PlusJakartaSans-ExtraBold.ttf'),
  'PlusJakartaSans-ExtraBold-Italic': require('@/assets/fonts/Plus_Jakarta_Sans/static/PlusJakartaSans-ExtraBoldItalic.ttf'),
  'PlusJakartaSans-ExtraLight': require('@/assets/fonts/Plus_Jakarta_Sans/static/PlusJakartaSans-ExtraLight.ttf'),
  'PlusJakartaSans-ExtraLight-Italic': require('@/assets/fonts/Plus_Jakarta_Sans/static/PlusJakartaSans-ExtraLightItalic.ttf'),
  'PlusJakartaSans-Italic': require('@/assets/fonts/Plus_Jakarta_Sans/static/PlusJakartaSans-Italic.ttf'),
  'PlusJakartaSans-Light': require('@/assets/fonts/Plus_Jakarta_Sans/static/PlusJakartaSans-Light.ttf'),
  'PlusJakartaSans-Light-Italic': require('@/assets/fonts/Plus_Jakarta_Sans/static/PlusJakartaSans-LightItalic.ttf'),
  'PlusJakartaSans-Medium': require('@/assets/fonts/Plus_Jakarta_Sans/static/PlusJakartaSans-Medium.ttf'),
  'PlusJakartaSans-Medium-Italic': require('@/assets/fonts/Plus_Jakarta_Sans/static/PlusJakartaSans-MediumItalic.ttf'),
  'PlusJakartaSans-Regular': require('@/assets/fonts/Plus_Jakarta_Sans/static/PlusJakartaSans-Regular.ttf'),
  'PlusJakartaSans-SemiBold': require('@/assets/fonts/Plus_Jakarta_Sans/static/PlusJakartaSans-SemiBold.ttf'),
  'PlusJakartaSans-SemiBold-Italic': require('@/assets/fonts/Plus_Jakarta_Sans/static/PlusJakartaSans-SemiBoldItalic.ttf'),
};
