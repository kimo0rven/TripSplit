import PrimaryButton from '@/components/Button/primary-button';
import BottomSheet from '@/components/ui/bottom-sheet';
import { HelperText } from '@/components/ui/card';
import { BrandColors, Spacing } from '@/constants/theme';
import { cancelJoinRequest, joinTripByCode } from '@/services/Firebase/tripService';
import { useAuth } from '@/services/Firebase/useAuth';
import { TripPreview } from '@/types/trips';
import type { JoinStep } from '@/utils/joinInvite';
import { formatLongDay } from '@/utils/money';
import { CalendarDays, Clock, ShieldCheck, Ticket, UserRound } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface JoinTripSheetProps {
  /** The trip behind the code, or null while the sheet is closed. */
  preview: TripPreview | null;
  code: string;
  onClose: () => void;
  /** Called once the person is in the trip, to open it. */
  onJoined: (tripId: string) => void;
}

/**
 * Shows the trip behind an invite code before anything happens: its name, who
 * runs it and its dates. Then joins, or, when the owner lets people in by
 * hand, sends them a request and says so.
 */
export default function JoinTripSheet({ preview, code, onClose, onJoined }: JoinTripSheetProps) {
  const { currentUser } = useAuth();
  const [busy, setBusy] = useState(false);
  // What happened since this preview opened. Tied to the preview, so a new
  // code starts from what its own lookup found.
  const [after, setAfter] = useState<{ for: TripPreview; step?: JoinStep; error?: string } | null>(
    null,
  );
  const current = after?.for === preview ? after : null;
  const step: JoinStep = current?.step ?? preview?.step ?? 'join';
  const error = current?.error ?? '';
  const setStep = (next: JoinStep) => preview && setAfter({ for: preview, step: next });
  const setError = (message: string) =>
    preview && setAfter({ for: preview, step, ...(message ? { error: message } : {}) });

  const owner = preview?.ownerName?.split(' ')[0] || 'The owner';
  const dates = preview?.startDate
    ? preview.endDate && preview.endDate !== preview.startDate
      ? `${formatLongDay(preview.startDate)} – ${formatLongDay(preview.endDate)}`
      : formatLongDay(preview.startDate)
    : '';

  const join = async () => {
    if (!preview || !currentUser?.uid || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await joinTripByCode(code, {
        id: currentUser.uid,
        fullname: currentUser.displayName || currentUser.email?.split('@')[0] || 'Someone',
        email: currentUser.email || '',
        ...(currentUser.photoURL ? { photoURL: currentUser.photoURL } : {}),
      });
      if (result.status === 'joined') {
        onJoined(result.tripId);
        return;
      }
      setStep('pending');
    } catch (err: any) {
      console.error('Failed to join trip:', err);
      setError(err?.message || 'Could not join that trip. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const takeBack = async () => {
    if (!preview || !currentUser?.uid || busy) return;
    setBusy(true);
    setError('');
    try {
      await cancelJoinRequest(preview.tripId, currentUser.uid);
      onClose();
    } catch (err: any) {
      console.error('Failed to take back the request:', err);
      setError(err?.message || 'Could not take back the request.');
    } finally {
      setBusy(false);
    }
  };

  const copy: Record<JoinStep, { message: string; button: string; action: () => void }> = {
    join: {
      message:
        'You’ll be added straight away and can see and split its expenses with everyone in it.',
      button: busy ? 'Joining…' : 'Join trip',
      action: join,
    },
    ask: {
      message: `${owner} lets new members in. Send a request and you’ll get a notification once you’re in. Until then you won’t see anything in the trip.`,
      button: busy ? 'Sending…' : 'Ask to join',
      action: join,
    },
    pending: {
      message: `Request sent. ${owner} will be asked to let you in, and you’ll get a notification when they do.`,
      button: 'Done',
      action: onClose,
    },
    declined: {
      message: `${owner} didn’t let you in last time. You can ask again if you think it was a mistake.`,
      button: busy ? 'Sending…' : 'Ask again',
      action: join,
    },
    member: {
      message: 'You’re already in this trip.',
      button: 'Open trip',
      action: () => preview && onJoined(preview.tripId),
    },
  };
  const now = copy[step];

  return (
    <BottomSheet
      visible={!!preview}
      title={step === 'pending' ? 'Waiting to join' : 'Join this trip?'}
      onClose={() => {
        if (!busy) onClose();
      }}
      footer={
        <>
          {!!error && <HelperText tone="error">{error}</HelperText>}
          <PrimaryButton
            title={now.button}
            onPress={now.action}
            buttonColor={BrandColors.base50}
            textColor={BrandColors.primary}
            borderColor={BrandColors.base50}
            borderWidth={0}
            disabled={busy}
          />
          {step === 'pending' && (
            <Pressable
              onPress={takeBack}
              disabled={busy}
              hitSlop={8}
              accessibilityRole="button"
              style={styles.secondary}
            >
              <Text style={styles.secondaryText}>Take back request</Text>
            </Pressable>
          )}
        </>
      }
    >
      {preview && (
        <View style={styles.body}>
          <View style={styles.card}>
            <View style={styles.icon}>
              <Ticket size={22} color={BrandColors.primary} />
            </View>
            <Text style={styles.name}>{preview.name}</Text>
            <View style={styles.facts}>
              {!!preview.ownerName && (
                <View style={styles.fact}>
                  <UserRound size={14} color={BrandColors.secondary} />
                  <Text style={styles.factText}>Run by {preview.ownerName}</Text>
                </View>
              )}
              {!!dates && (
                <View style={styles.fact}>
                  <CalendarDays size={14} color={BrandColors.secondary} />
                  <Text style={styles.factText}>{dates}</Text>
                </View>
              )}
              {preview.requireApproval && step !== 'member' && (
                <View style={styles.fact}>
                  <ShieldCheck size={14} color={BrandColors.secondary} />
                  <Text style={styles.factText}>New members need approval</Text>
                </View>
              )}
            </View>
          </View>

          <View style={[styles.note, step === 'pending' && styles.notePending]}>
            {step === 'pending' && <Clock size={16} color={BrandColors.warning} />}
            <Text style={styles.noteText}>{now.message}</Text>
          </View>
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: Spacing.three, paddingBottom: Spacing.three },
  card: {
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: BrandColors.inputField,
    borderRadius: 20,
    padding: Spacing.four,
  },
  icon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: BrandColors.base400,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 20,
    color: BrandColors.heading,
    textAlign: 'center',
  },
  facts: { gap: Spacing.one, alignItems: 'center' },
  fact: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  factText: { fontFamily: 'PlusJakartaSans-Medium', fontSize: 13, color: BrandColors.secondary },
  note: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  notePending: {
    backgroundColor: BrandColors.warningBg,
    borderRadius: 12,
    padding: Spacing.three,
  },
  noteText: {
    flex: 1,
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: BrandColors.primary,
  },
  secondary: { alignSelf: 'center', paddingVertical: Spacing.two },
  secondaryText: { fontFamily: 'PlusJakartaSans-Medium', fontSize: 14, color: BrandColors.info },
});
