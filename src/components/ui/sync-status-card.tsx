import { BrandColors, Spacing } from '@/constants/theme';
import { useOffline } from '@/services/offline/OfflineProvider';
import { CloudOff, RefreshCw } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

/**
 * Connection and sync status, shown on the profile instead of a strip across
 * the top of every screen.
 *
 * It answers the two questions a user actually has after a bad connection:
 * "is my data on the server yet?" and "can I make it send now?".
 */
export default function SyncStatusCard() {
  const { online, pendingWrites, rejectedWrites, syncing, forceSync } = useOffline();
  const [note, setNote] = useState<string | null>(null);

  const spin = useRef(new Animated.Value(0)).current;
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The button's icon turns while a sync runs, so the press is visibly doing
  // something even when there is nothing to send.
  useEffect(() => {
    if (!syncing) {
      spin.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    loop.start();
    return () => loop.stop();
  }, [syncing, spin]);

  useEffect(
    () => () => {
      if (noteTimer.current) clearTimeout(noteTimer.current);
    },
    [],
  );

  const showNote = (text: string) => {
    setNote(text);
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => setNote(null), 4000);
  };

  const onSync = async () => {
    if (syncing) return;

    const result = await forceSync();

    if (!result.online) {
      showNote('No connection yet. Your changes are still saved on this phone.');
      return;
    }

    if (result.remaining > 0) {
      showNote(
        `${result.remaining} ${result.remaining === 1 ? 'change is' : 'changes are'} still waiting to be sent.`,
      );
      return;
    }

    if (result.sent > 0) {
      showNote(`${result.sent} ${result.sent === 1 ? 'change' : 'changes'} sent.`);
      return;
    }

    showNote('Everything is up to date.');
  };

  const statusTitle = !online ? 'You are offline' : pendingWrites > 0 ? 'Saving…' : 'Online';

  const statusMessage = !online
    ? pendingWrites > 0
      ? `${pendingWrites} ${pendingWrites === 1 ? 'change is' : 'changes are'} saved and will be sent when you are back online.`
      : 'Showing the copy saved on this phone.'
    : pendingWrites > 0
      ? `${pendingWrites} ${pendingWrites === 1 ? 'change is' : 'changes are'} waiting to be sent.`
      : 'All your changes are saved to the server.';

  const tone = !online
    ? { bg: BrandColors.warningBg, fg: BrandColors.warning }
    : pendingWrites > 0
      ? { bg: BrandColors.base200, fg: BrandColors.heading }
      : { bg: BrandColors.successBg, fg: BrandColors.success };

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={styles.card}>
      <View style={styles.statusRow}>
        <View style={[styles.statusIcon, { backgroundColor: tone.bg }]}>
          {online ? (
            <RefreshCw size={16} color={tone.fg} />
          ) : (
            <CloudOff size={16} color={tone.fg} />
          )}
        </View>
        <View style={styles.statusText}>
          <Text style={styles.title}>{statusTitle}</Text>
          <Text style={styles.message}>{statusMessage}</Text>
        </View>
      </View>

      <Pressable
        onPress={onSync}
        disabled={syncing}
        accessibilityRole="button"
        accessibilityLabel="Sync now"
        style={({ pressed }) => [styles.button, (pressed || syncing) && styles.buttonPressed]}
      >
        <Animated.View style={{ transform: [{ rotate }] }}>
          <RefreshCw size={16} color={BrandColors.heading} />
        </Animated.View>
        <Text style={styles.buttonText}>{syncing ? 'Syncing…' : 'Sync now'}</Text>
      </Pressable>

      {!!note && <Text style={styles.note}>{note}</Text>}

      {/* A refused change is dropped rather than retried for ever, so it has to
          be said out loud - otherwise the screen would claim everything saved. */}
      {rejectedWrites > 0 && (
        <Text style={styles.rejected}>
          {rejectedWrites === 1
            ? '1 saved change was refused by the server and could not be sent. Please enter it again.'
            : `${rejectedWrites} saved changes were refused by the server and could not be sent. Please enter them again.`}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: BrandColors.surfaceAlt,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 15,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  statusIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    flex: 1,
    gap: Spacing.half,
  },
  title: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 15,
    color: BrandColors.heading,
  },
  message: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 17,
    color: BrandColors.secondary,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    height: 44,
    borderRadius: 15,
    backgroundColor: BrandColors.base500,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    color: BrandColors.heading,
  },
  note: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 17,
    color: BrandColors.primary,
  },
  rejected: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 17,
    color: BrandColors.error,
  },
});
