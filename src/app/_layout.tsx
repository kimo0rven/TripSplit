// import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
// import * as SplashScreen from 'expo-splash-screen';
// import { useColorScheme } from 'react-native';

// import { AnimatedSplashOverlay } from '@/components/animated-icon';
// import AppTabs from '@/components/app-tabs';

// SplashScreen.preventAutoHideAsync();

// export default function TabLayout() {
//   const colorScheme = useColorScheme();
//   return (
//     <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
//       <AnimatedSplashOverlay />
//       <AppTabs />
//     </ThemeProvider>
//   );
// }

import LoadingScreen from '@/components/Loader/LoadingScreen';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
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
  });
 
  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return <LoadingScreen />;
  }

  return <Stack />;
}