import { BrandColors, Spacing } from '@/constants/theme';
import { useOffline } from '@/services/offline/OfflineProvider';
import { TriangleAlert } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';

/**
 * A short strip that appears at the top of any screen that asks to show it,
 * the moment the server refuses a saved change and it is dropped.
 *
 * Why this exists: the full sync card lives on the Profile screen, and a
 * refused write is dropped for good after three tries. Without this, a change
 * made inside a trip could vanish while the user is still in the trip and
 * never see Profile - which is exactly how a refused plan edit went unnoticed
 * before. The strip re-checks whenever the app comes back to the foreground,
 * so a drop that happened while the phone was asleep still shows up.
 */
export default function DroppedWritesNotice() {
  const { rejectedWrites } = useOffline();
  const [seen, setSeen] = useState(rejectedWrites);
  const [dismissed, setDismissed] = useState(false);

  // Anything refused while the app was last used is worth showing on open.
  useEffect(() => {
    if (rejectedWrites !== seen) {
      setSeen(rejectedWrites);
      setDismissed(false);
    }
  }, [rejectedWrites, seen]);

  // Coming back from the background is when a drop that happened quietly
  // becomes visible, so re-read the count when the app returns.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setSeen(rejectedWrites);
    });
    return () => subscription.remove();
  }, [rejectedWrites]);

  if (rejectedWrites === 0 || dismissed) return null;

  return (
    <View style={styles.wrap} accessibilityRole="alert">
      <TriangleAlert size={16} color={BrandColors.error} />
      <Text style={styles.text}>
        {rejectedWrites === 1
          ? 'A saved change was refused and could not be sent. Please add it again.'
          : `${rejectedWrites} saved changes were refused and could not be sent. Please add them again.`}
      </Text>
      <Pressable onPress={() => setDismissed(true)} hitSlop={10} accessibilityLabel="Dismiss">
        <Text style={styles.dismiss}>OK</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: BrandColors.errorBg,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  text: {
    flex: 1,
    minWidth: 0,
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: BrandColors.primary,
  },
  dismiss: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 12,
    color: BrandColors.error,
  },
});
