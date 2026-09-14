/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

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

export const BrandColors = {
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
} as const;

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
  }
