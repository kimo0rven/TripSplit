import BackButton from '@/components/Button/back-button';
import PrimaryButton from '@/components/Button/primary-button';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import { TextField } from '@/components/ui/text-input-field';
import { BrandColors, MaxContentWidth, Spacing } from '@/constants/theme';
import { fetchTripPreview, joinTripByCode } from '@/services/Firebase/tripService';
import { useAuth } from '@/services/Firebase/useAuth';
import { TripPreview } from '@/types/trips';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ticket } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';

export default function JoinTripScreen() {
  const router = useRouter();
  const { currentUser } = useAuth();
  // A QR can open this screen with the code already filled in.
  const { code: codeParam } = useLocalSearchParams<{ code?: string }>();

  const [code, setCode] = useState((codeParam || '').toUpperCase());
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<TripPreview | null>(null);

  /**
   * Step one: look the code up without joining, so the person can see which
   * trip it is before they are added to it.
   */
  const handleLookUp = async () => {
    if (!code.trim() || joining) return;

    if (!currentUser?.uid) {
      setError('You need to be signed in.');
      return;
    }

    setJoining(true);
    setError('');

    try {
      const found = await fetchTripPreview(code);
      if (!found) {
        setError('That invite code is not valid. Please check it and try again.');
        setJoining(false);
        return;
      }
      setPreview(found);
    } catch (err) {
      console.error('Failed to look up invite code:', err);
      setError('Could not check that code right now. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  // A code that came from a QR link is looked up straight away, so scanning a
  // QR gets to the "join this trip?" question without typing or tapping.
  const autoLookedUp = useRef(false);
  useEffect(() => {
    const arrivedWithCode = (codeParam || '').trim().length > 0;
    if (!arrivedWithCode || autoLookedUp.current) return;
    if (!currentUser?.uid) return;

    autoLookedUp.current = true;
    handleLookUp();
    // handleLookUp only reads state that is settled by this point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeParam, currentUser?.uid]);

  /** Step two: the person confirmed, so actually join. */
  const handleConfirmJoin = async () => {
    if (!preview || joining) return;
    if (!currentUser?.uid) {
      setError('You need to be signed in.');
      return;
    }

    setJoining(true);
    setError('');

    try {
      const trip = await joinTripByCode(code, {
        id: currentUser.uid,
        fullname: currentUser.displayName || currentUser.email?.split('@')[0] || 'You',
        email: currentUser.email || '',
        ...(currentUser.photoURL ? { photoURL: currentUser.photoURL } : {}),
      });

      setPreview(null);
      router.replace(`/trips/${trip.id}` as any);
    } catch (err: any) {
      console.error('Failed to join trip:', err);
      setPreview(null);
      setError(err?.message || 'Could not join that trip. Please check the code.');
      setJoining(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <View style={styles.backWrapper}>
          <BackButton onPress={() => router.back()} />
        </View>
        <Text style={styles.headerTitle}>Join a Trip</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.iconWrapper}>
          <Ticket size={32} color={BrandColors.primary} />
        </View>

        <View style={styles.textBlock}>
          <Text style={styles.title}>Got an invite code?</Text>
          <Text style={styles.subtitle}>
            Enter the code a friend shared with you to join their trip and start splitting expenses.
          </Text>
        </View>

        <TextField
          title="Invite code"
          placeholder="e.g. AB12CD"
          value={code}
          onChangeText={(text) => setCode(text.toUpperCase())}
        />

        {!!error && <Text style={styles.errorText}>{error}</Text>}

        <PrimaryButton
          title={joining ? 'Checking…' : 'Find trip'}
          onPress={handleLookUp}
          buttonColor={BrandColors.base50}
          textColor={BrandColors.primary}
          borderColor={BrandColors.base50}
          borderWidth={0}
          disabled={!code.trim() || joining}
        />
      </View>

      <ConfirmDialog
        visible={!!preview}
        title={`Join "${preview?.name ?? 'this trip'}"?`}
        message="You will be added to this trip and can see and split its expenses with everyone in it."
        confirmLabel="Join trip"
        cancelLabel="Not now"
        busy={joining}
        onConfirm={handleConfirmJoin}
        onCancel={() => {
          if (!joining) setPreview(null);
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: BrandColors.background,
  },
  header: {
    paddingTop: 40,
    paddingHorizontal: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backWrapper: {
    position: 'absolute',
    left: 15,
    top: 34,
    zIndex: 1,
  },
  headerTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 20,
    color: BrandColors.primary,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'stretch',
    gap: Spacing.five,
    paddingHorizontal: 25,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingBottom: Spacing.six,
  },
  iconWrapper: {
    alignSelf: 'center',
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: BrandColors.base400,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  title: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 24,
    color: BrandColors.primary,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    color: BrandColors.secondary,
    textAlign: 'center',
  },
  errorText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13,
    color: BrandColors.error,
    textAlign: 'center',
  },
});
