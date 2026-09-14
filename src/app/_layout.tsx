import LoadingScreen from '@/components/Loader/LoadingScreen';
import { FontAssets } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/services/Firebase/useAuth';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';

SplashScreen.preventAutoHideAsync();

const MIN_LOADING_TIME = 1500;
const FORCE_LOADING_SCREEN = false;

function RootLayoutNav({ fontsLoaded, fontError }: { fontsLoaded: boolean; fontError: Error | null }) {
  const router = useRouter();
  const segments = useSegments();
  
  const { currentUser, loading } = useAuth();
  const authInitialized = !loading;

  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, MIN_LOADING_TIME);

    return () => clearTimeout(timer);
  }, []);

  const isReady =
    !FORCE_LOADING_SCREEN &&
    (fontsLoaded || !!fontError) &&
    minTimeElapsed &&
    authInitialized;

  useEffect(() => {
    if (isReady) {
      SplashScreen.hideAsync();
    }
  }, [isReady]);

  useEffect(() => {
    if (!isReady) return;

    const inAuthGroup = segments[0] === 'auth' || !segments[0];
    const isAccountSetup = segments[0] === 'account-setup';

    if (currentUser) {
      if (!currentUser.displayName) {
        if (!isAccountSetup) {
          router.replace('/account-setup');
        }
      } else {
        if (inAuthGroup || isAccountSetup) {
          router.replace('/homescreen');
        }
      }
    } else {
      if (!inAuthGroup) {
        router.replace('/');
      }
    }
  }, [isReady, currentUser, segments]);

  if (!isReady) {
    return <LoadingScreen />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  const [loaded, error] = useFonts(FontAssets);

  return (
    <AuthProvider>
      <RootLayoutNav fontsLoaded={loaded} fontError={error} />
    </AuthProvider>
  );
}