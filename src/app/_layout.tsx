import LoadingScreen from '@/components/Loader/LoadingScreen';
import ErrorBoundary from '@/components/ui/error-boundary';
import { AuthProvider, useAuth } from '@/services/Firebase/useAuth';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { registerPushToken, tripIdFromNotification } from '@/services/reminders/push';
import { tidyMyData } from '@/services/Firebase/privateData';
import { BrandColors, FontAssets, isDarkTheme } from '@/constants/theme';
import { useThemeVersion } from '@/constants/themed-styles';
import { followAppearance } from '@/constants/appearance';
import { StatusBar } from 'expo-status-bar';
import { auth } from '@/config/firebase';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Fragment, useEffect, useState, type ReactNode } from 'react';

SplashScreen.preventAutoHideAsync();

/**
 * Wraps every screen so that switching between light and dark redraws it
 * with the new colours. The key changes with the theme, which rebuilds the
 * screen's content but keeps where you are in the app.
 */
function ThemedScreen({ children }: { children: ReactNode }) {
  const themeVersion = useThemeVersion();
  return <Fragment key={themeVersion}>{children}</Fragment>;
}

const themedScreen = ({ children }: { children: ReactNode }) => (
  <ThemedScreen>{children}</ThemedScreen>
);

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

  const { currentUser, loading, mustVerifyEmail } = useAuth();
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
    const isVerifyEmail = segments[0] === 'verify-email';

    if (currentUser) {
      // A new account verifies its email before anything else.
      if (mustVerifyEmail) {
        if (!isVerifyEmail) router.replace('/verify-email');
      } else if (!currentUser.displayName) {
        if (!isAccountSetup) {
          router.replace('/account-setup');
        }
      } else {
        if (inAuthGroup || isAccountSetup || isVerifyEmail) {
          router.replace('/dashboard');
        }
      }
    } else {
      if (!inAuthGroup) {
        router.replace('/');
      }
    }
  }, [isReady, currentUser, mustVerifyEmail, segments]);

  const uid = currentUser?.uid;
  // Only registers a phone that already allows notifications. The system
  // prompt is shown where it is explained: the setup screen's "Enable
  // notifications" step, and the Push switch in notification settings. So a
  // "Not now" stays a "Not now".
  useEffect(() => {
    if (uid) {
      // Private settings out of the public profile, and findable by email.
      void tidyMyData(uid, auth.currentUser?.email).then(() =>
        registerPushToken(uid, { ask: false }),
      );
    }
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

  // Redraws the status bar and page colour when the theme switches.
  useThemeVersion();

  // In "Same as phone", follow the phone when it switches between light and dark.
  useEffect(() => followAppearance(), []);

  if (!isReady) {
    return <LoadingScreen />;
  }

  return (
    <>
      {/* Light icons over the dark theme, dark icons over the light one. */}
      <StatusBar style={isDarkTheme() ? 'light' : 'dark'} />
      <Stack
        screenLayout={themedScreen}
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          animationDuration: 150,
          // The page behind every screen, so a screen change never flashes white in the dark.
          contentStyle: { backgroundColor: BrandColors.background },
        }}
      >
        {/* Joining slides up as a full page, like a sheet that covers the screen. */}
        <Stack.Screen
          name="trips/join"
          options={{ animation: 'slide_from_bottom', animationDuration: 300 }}
        />
      </Stack>
    </>
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
