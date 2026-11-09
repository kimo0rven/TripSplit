import Avatar from '@/components/ui/avatar';
import { BrandColors, Spacing } from '@/constants/theme';
import { TripMember } from '@/types/trips';
import { formatMoney } from '@/utils/money';
import { Text, View } from 'react-native';

import { chartStyles } from './chart-kit';
import { themedStyles } from '@/constants/themed-styles';

interface BalanceBarsProps {
  /** Each member's net: above zero they are owed, below zero they owe. */
  nets: { member: TripMember; net: number }[];
  currency: string;
  currentUserId: string;
}

/**
 * Who is ahead and who is behind: a bar out from the middle line for each
 * person, green to the right when the group owes them, red to the left when
 * they owe the group.
 */
export default function BalanceBars({ nets, currency, currentUserId }: BalanceBarsProps) {
  const max = Math.max(0, ...nets.map((entry) => Math.abs(entry.net)));
  if (max < 0.01) {
    return <Text style={chartStyles.empty}>Everyone is even. Nobody is ahead or behind.</Text>;
  }
  const sorted = [...nets].sort((a, b) => b.net - a.net);

  return (
    <View style={styles.wrap}>
      <View style={styles.heads}>
        <Text style={[chartStyles.axis, styles.left]}>Owes the group</Text>
        <Text style={[chartStyles.axis, styles.right]}>The group owes them</Text>
      </View>
      {sorted.map(({ member, net }) => {
        const share = Math.abs(net) / max;
        const even = Math.abs(net) < 0.01;
        const owed = net > 0;
        return (
          <View key={member.id} style={styles.row}>
            <View style={styles.who}>
              <Avatar name={member.fullname} size={22} photoURL={member.photoURL} />
              <Text style={styles.name} numberOfLines={1}>
                {member.id === currentUserId ? 'You' : member.fullname.split(' ')[0]}
              </Text>
            </View>
            <View style={styles.track}>
              <View style={styles.half}>
                {!even && !owed && (
                  <View style={[styles.bar, styles.barLeft, { width: `${share * 100}%` }]} />
                )}
              </View>
              <View style={styles.mid} />
              <View style={styles.half}>
                {!even && owed && (
                  <View style={[styles.bar, styles.barRight, { width: `${share * 100}%` }]} />
                )}
              </View>
            </View>
            <Text style={[styles.amount, owed ? styles.green : !even && styles.red]}>
              {even ? 'even' : `${owed ? '+' : '−'}${formatMoney(Math.abs(net), currency)}`}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = themedStyles(() => ({
  wrap: { gap: Spacing.two },
  heads: { flexDirection: 'row', marginLeft: 80, marginRight: 76 },
  left: { flex: 1, textAlign: 'left' },
  right: { flex: 1, textAlign: 'right' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  who: { width: 72, flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flex: 1, fontFamily: 'PlusJakartaSans-Medium', fontSize: 12, color: BrandColors.primary },
  track: { flex: 1, flexDirection: 'row', alignItems: 'center', height: 14 },
  half: { flex: 1, height: 14, justifyContent: 'center' },
  mid: { width: 1.5, height: 18, backgroundColor: BrandColors.border },
  bar: { height: 12 },
  barLeft: {
    alignSelf: 'flex-end',
    backgroundColor: BrandColors.error,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  barRight: {
    alignSelf: 'flex-start',
    backgroundColor: BrandColors.success,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  amount: {
    width: 76,
    textAlign: 'right',
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 12,
    color: BrandColors.secondary,
  },
  green: { color: BrandColors.success },
  red: { color: BrandColors.error },
}));
