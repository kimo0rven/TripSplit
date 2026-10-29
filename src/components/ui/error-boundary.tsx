import { BrandColors, Spacing } from '@/constants/theme';
import { ErrorBoundaryProps } from 'expo-router';
import { RotateCcw, TriangleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

/**
 * What the app shows when a screen throws, instead of the raw developer error.
 *
 * Expo Router calls this with `error` and a `retry` that re-renders the screen.
 * The technical message is tucked behind a toggle so it is there when you need
 * to report a bug, but does not greet you first.
 */
export default function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <View style={styles.page}>
      <View style={styles.iconCircle}>
        <TriangleAlert size={26} color={BrandColors.error} />
      </View>

      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.message}>
        This screen ran into a problem. Your trips and expenses are saved and still safe.
      </Text>

      <Pressable
        style={styles.action}
        onPress={() => {
          retry();
        }}
        accessibilityRole="button"
        accessibilityLabel="Try loading this screen again"
      >
        <RotateCcw size={16} color={BrandColors.primary} />
        <Text style={styles.actionText}>Try again</Text>
      </Pressable>

      <Pressable
        style={styles.detailsToggle}
        onPress={() => setShowDetails((current) => !current)}
        accessibilityRole="button"
        accessibilityLabel={showDetails ? 'Hide error details' : 'Show error details'}
      >
        <Text style={styles.detailsToggleText}>
          {showDetails ? 'Hide details' : 'Show details'}
        </Text>
      </Pressable>

      {showDetails && (
        <View style={styles.detailsBox}>
          <Text style={styles.detailsText}>{error?.message || 'Unknown error'}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.four,
    backgroundColor: BrandColors.background,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: BrandColors.errorBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  title: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 16,
    color: BrandColors.primary,
    textAlign: 'center',
  },
  message: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13,
    color: BrandColors.secondary,
    textAlign: 'center',
    maxWidth: 320,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: 12,
    backgroundColor: BrandColors.base50,
  },
  actionText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    color: BrandColors.primary,
  },
  detailsToggle: {
    marginTop: Spacing.two,
    padding: Spacing.one,
  },
  detailsToggleText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: BrandColors.secondary,
  },
  detailsBox: {
    marginTop: Spacing.two,
    padding: Spacing.three,
    borderRadius: 12,
    backgroundColor: BrandColors.surfaceAlt,
    borderWidth: 1,
    borderColor: BrandColors.border,
    maxWidth: 360,
  },
  detailsText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: BrandColors.secondary,
  },
});
