import { BrandColors, Spacing } from '@/constants/theme';
import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {right}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** Horizontal progress bar, used for budget use and report bars. */
export function ProgressBar({
  ratio,
  color = BrandColors.base50,
  height = 8,
}: {
  ratio: number;
  color?: string;
  height?: number;
}) {
  const safe = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  return (
    <View style={[styles.track, { height }]}>
      <View style={[styles.fill, { width: `${safe * 100}%`, backgroundColor: color, height }]} />
    </View>
  );
}

export function HelperText({
  children,
  tone = 'muted',
}: {
  children: ReactNode;
  tone?: 'muted' | 'error' | 'success';
}) {
  const color =
    tone === 'error'
      ? BrandColors.error
      : tone === 'success'
        ? BrandColors.success
        : BrandColors.secondary;
  return <Text style={[styles.helper, { color }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 16,
    color: BrandColors.primary,
  },
  card: {
    backgroundColor: BrandColors.background,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 15,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  track: {
    width: '100%',
    borderRadius: 99,
    backgroundColor: BrandColors.inputField,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: 99,
  },
  helper: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
  },
});
