import LoadingScreen from '@/components/Loader/LoadingScreen';
import ErrorBoundary from '@/components/ui/error-boundary';
import { FontAssets } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/services/Firebase/useAuth';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { registerPushToken, tripIdFromNotification } from '@/services/reminders/push';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useEffect, useState } from 'react';

SplashScreen.preventAutoHideAsync();

const MIN_LOADING_TIME = 1500;
const FORCE_LOADING_SCREEN = false;

function RootLayoutNav({
  fontsLoaded,
  fontError,
}: {
  fontsLoaded: boolean;
  fontError: Error | null;
}) {
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
    !FORCE_LOADING_SCREEN && (fontsLoaded || !!fontError) && minTimeElapsed && authInitialized;

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
          router.replace('/dashboard');
        }
      }
    } else {
      if (!inAuthGroup) {
        router.replace('/');
      }
    }
  }, [isReady, currentUser, segments]);

  const uid = currentUser?.uid;
  useEffect(() => {
    if (uid) registerPushToken(uid);
  }, [uid]);

  // Tapping a reminder opens the trip it is about.
  useEffect(() => {
    if (Platform.OS === 'web' || !uid) return;
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const tripId = tripIdFromNotification(response);
      if (tripId) router.push(`/trips/${tripId}` as any);
    });
    return () => subscription.remove();
  }, [uid, router]);

  if (!isReady) {
    return <LoadingScreen />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade', animationDuration: 150 }}>
      {/* Joining slides up as a full page, like a sheet that covers the screen. */}
      <Stack.Screen
        name="trips/join"
        options={{ animation: 'slide_from_bottom', animationDuration: 300 }}
      />
    </Stack>
  );
}

// Expo Router catches a thrown screen with this, so a crash shows a way back
// instead of the raw developer error.
export { ErrorBoundary };

export default function RootLayout() {
  const [loaded, error] = useFonts(FontAssets);

  return (
    <AuthProvider>
      <RootLayoutNav fontsLoaded={loaded} fontError={error} />
    </AuthProvider>
  );
}
