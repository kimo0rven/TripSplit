import { BrandColors, Spacing } from '@/constants/theme';
import { formatMoney } from '@/utils/money';
import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface BalanceCardProps {
  net: number;
  currency: string;
  spent: number;
  memberCount?: number;
  onPress: () => void;
  /** Drop the border so the card can sit inside a shared container. */
  embedded?: boolean;
  /** Small text shown on the same line as the label, on the right. */
  aside?: ReactNode;
}

/** What the active trip adds up to for you: owed, owing, or settled. */
export default function BalanceCard({
  net,
  currency,
  spent,
  onPress,
  embedded,
  aside,
}: BalanceCardProps) {
  const owed = net > 0.009;
  const owe = net < -0.009;

  return (
    <Pressable style={[styles.balanceCard, embedded && styles.embedded]} onPress={onPress}>
      <View style={styles.labelRow}>
        <Text style={styles.balanceLabel}>
          {owed ? 'You are owed' : owe ? 'You owe' : 'You are settled up'}
        </Text>
        {aside}
      </View>
      <Text
        style={[
          styles.balanceValue,
          owe ? styles.balanceOwe : owed ? styles.balanceOwed : styles.balanceEven,
        ]}
      >
        {formatMoney(Math.abs(net) < 0.01 ? 0 : Math.abs(net), currency)}
      </Text>
      {spent > 0 && (
        <Text style={styles.balanceHint}>{formatMoney(spent, currency)} spent in total</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  embedded: { borderWidth: 0, borderRadius: 0, padding: 0 },
  balanceCard: {
    gap: 2,
    backgroundColor: BrandColors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: Spacing.three,
  },
  balanceLabel: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: BrandColors.secondary,
  },
  balanceValue: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 36,
  },
  balanceOwed: {
    color: BrandColors.success,
  },
  balanceOwe: {
    color: BrandColors.error,
  },
  balanceEven: {
    color: BrandColors.primary,
  },
  balanceHint: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    color: BrandColors.secondary,
    marginTop: 2,
  },
});
