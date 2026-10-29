import { BrandColors, Spacing } from '@/constants/theme';
import { StyleSheet, Text, View } from 'react-native';

interface DayDividerProps {
  /** "Today", "Yesterday", or a date like "Oct 21, 2026". */
  label: string;
  /** What the day adds up to, drawn on the right when there is one. */
  total?: string;
  /** How many records the day holds, when the caller wants to say. */
  count?: number;
}

/**
 * The line that starts each day's section of a list.
 *
 * Two thin rules either side of the date, so the eye can jump from day to day
 * while scrolling instead of reading every card.
 */
export default function DayDivider({ label, total, count }: DayDividerProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      {!!count && count > 0 && (
        <Text style={styles.count}>
          {count} {count === 1 ? 'entry' : 'entries'}
        </Text>
      )}
      <View style={styles.rule} />
      {!!total && <Text style={styles.total}>{total}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  label: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 12,
    color: BrandColors.primary,
  },
  count: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    color: BrandColors.secondary,
  },
  rule: {
    flex: 1,
    height: 1,
    backgroundColor: BrandColors.border,
  },
  total: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 12,
    color: BrandColors.primary,
  },
});
