import PrimaryButton from '@/components/Button/primary-button';
import { ThemedView } from '@/components/themed-view';
import { BrandColors, MaxContentWidth, Spacing } from '@/constants/theme';
import { checkEmailVerified, resendVerificationEmail } from '@/services/Firebase/authService';
import { useAuth } from '@/services/Firebase/useAuth';
import { handleLogout } from '@/utils/logout';
import { RESEND_COOLDOWN_SECONDS, verificationProblem } from '@/utils/verification';
import { useLocalSearchParams } from 'expo-router';
import { MailCheck } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from 'react-native';

/** How often the screen quietly checks, so verifying on another device moves on by itself. */
const AUTO_CHECK_MS = 6000;

/**
 * Shown right after signing up, and to anyone signing in whose new account
 * has not been verified yet.
 *
 * Moving on is the layout's job: once Firebase says the email is verified,
 * `refreshUser` flips `mustVerifyEmail` and the layout sends the person to
 * account setup (or the dashboard if that is done).
 */
export default function VerifyEmailScreen() {
  const { currentUser, refreshUser } = useAuth();
  // Coming from sign-up, the email has only just gone out.
  const { sent } = useLocalSearchParams<{ sent?: string }>();
  const [cooldown, setCooldown] = useState(sent === '1' ? RESEND_COOLDOWN_SECONDS : 0);
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const busy = useRef(false);

  // The countdown on "Resend email".
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  /** Asks Firebase again. Quiet checks say nothing when it is not verified yet. */
  const check = useCallback(
    async (quiet: boolean) => {
      if (busy.current) return;
      busy.current = true;
      if (!quiet) {
        setChecking(true);
        setMessage(null);
      }
      try {
        const verified = await checkEmailVerified();
        if (verified) {
          await refreshUser();
        } else if (!quiet) {
          setMessage({
            tone: 'error',
            text: 'Not verified yet. Tap the link in the email first, and check your spam folder too.',
          });
        }
      } catch (err: any) {
        if (!quiet) setMessage({ tone: 'error', text: verificationProblem(err?.code) });
      } finally {
        busy.current = false;
        if (!quiet) setChecking(false);
      }
    },
    [refreshUser],
  );

  // Coming back from the mail app is the usual moment it has just been verified.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check(true);
    });
    const timer = setInterval(() => void check(true), AUTO_CHECK_MS);
    return () => {
      subscription.remove();
      clearInterval(timer);
    };
  }, [check]);

  const resend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setMessage(null);
    try {
      await resendVerificationEmail();
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setMessage({ tone: 'info', text: 'Sent. It can take a minute to arrive.' });
    } catch (err: any) {
      setMessage({ tone: 'error', text: verificationProblem(err?.code) });
    } finally {
      setResending(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.badge}>
          <MailCheck size={36} color={BrandColors.primary} strokeWidth={2} />
        </View>

        <View style={styles.texts}>
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.body}>
            We sent a verification link to{'\n'}
            <Text style={styles.email}>{currentUser?.email || 'your email'}</Text>
          </Text>
          <Text style={styles.hint}>
            Tap the link in that email, then come back here. This screen moves on by itself once it
            is done.
          </Text>
        </View>

        {!!message && (
          <Text style={[styles.message, message.tone === 'error' && styles.messageError]}>
            {message.text}
          </Text>
        )}

        <View style={styles.actions}>
          <PrimaryButton
            title={checking ? 'Checking…' : "I've verified my email"}
            onPress={() => check(false)}
            buttonColor={BrandColors.base50}
            textColor={BrandColors.primary}
            borderColor="none"
            borderWidth={0}
            disabled={checking}
          />

          <Pressable
            style={({ pressed }) => [
              styles.secondary,
              (cooldown > 0 || resending) && styles.secondaryOff,
              pressed && styles.pressed,
            ]}
            onPress={resend}
            disabled={cooldown > 0 || resending}
            accessibilityRole="button"
            accessibilityLabel={
              cooldown > 0 ? `Resend email in ${cooldown} seconds` : 'Resend email'
            }
          >
            {resending ? (
              <ActivityIndicator size="small" color={BrandColors.primary} />
            ) : (
              <Text style={styles.secondaryText}>
                {cooldown > 0 ? `Resend email in ${cooldown}s` : 'Resend email'}
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => void handleLogout()}
            accessibilityRole="button"
            hitSlop={8}
            style={styles.linkWrap}
          >
            <Text style={styles.link}>Wrong email? Sign out and start again</Text>
          </Pressable>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BrandColors.background,
    alignItems: 'center',
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.four,
  },
  badge: {
    width: 84,
    height: 84,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BrandColors.base50,
  },
  texts: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  title: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 24,
    color: BrandColors.heading,
    textAlign: 'center',
  },
  body: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 15,
    lineHeight: 22,
    color: BrandColors.secondary,
    textAlign: 'center',
  },
  email: {
    fontFamily: 'PlusJakartaSans-Bold',
    color: BrandColors.heading,
  },
  hint: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13,
    lineHeight: 19,
    color: BrandColors.secondary,
    textAlign: 'center',
    paddingHorizontal: Spacing.two,
  },
  message: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 13,
    lineHeight: 19,
    color: BrandColors.success,
    textAlign: 'center',
  },
  messageError: {
    color: BrandColors.error,
  },
  actions: {
    width: '100%',
    gap: Spacing.three,
    alignItems: 'center',
  },
  secondary: {
    width: '100%',
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BrandColors.base50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryOff: {
    borderColor: BrandColors.border,
  },
  secondaryText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 15,
    color: BrandColors.primary,
  },
  linkWrap: {
    paddingVertical: Spacing.one,
  },
  link: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 13,
    color: BrandColors.secondary,
    textDecorationLine: 'underline',
  },
  pressed: {
    opacity: 0.7,
  },
});
