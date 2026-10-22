import { BrandColors, Spacing } from '@/constants/theme';
import { EditLogEntry } from '@/types/expenses';
import { formatDay, formatTime } from '@/utils/money';
import { StyleSheet, Text, View } from 'react-native';

/** The edit log of a money record, newest edit first. */
export default function EditLog({ history }: { history?: EditLogEntry[] }) {
  if (!history?.length) return null;

  return (
    <View style={styles.wrap}>
      {history.map((entry) => (
        <View key={entry.id} style={styles.entry}>
          <Text style={styles.head}>
            {entry.byName || 'Someone'} · {formatDay(entry.at.slice(0, 10))}{' '}
            {formatTime(new Date(entry.at).toTimeString().slice(0, 5))}
          </Text>
          {entry.changes.map((change, index) => (
            <Text key={index} style={styles.change}>
              {change.label}: {change.from} → {change.to}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  entry: {
    gap: 2,
    backgroundColor: BrandColors.surfaceAlt,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 12,
    padding: Spacing.three,
  },
  head: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 12,
    color: BrandColors.primary,
  },
  change: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: BrandColors.secondary,
  },
});
