import Avatar from '@/components/ui/avatar';
import { BrandColors, Spacing } from '@/constants/theme';
import { DebtEdge } from '@/types/expenses';
import { TripMember } from '@/types/trips';
import { formatMoney } from '@/utils/money';
import { remindDebtor } from '@/services/reminders/push';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface DebtsListProps {
  edges: DebtEdge[];
  members: TripMember[];
  userId: string;
  currency: string;
  tripId: string;
  tripName: string;
  onPay: (edge: DebtEdge) => void;
  embedded?: boolean;
}

/** The debts you are part of: who owes you (Remind) and who you owe (Pay). */
export default function DebtsList({
  edges,
  members,
  userId,
  currency,
  tripId,
  tripName,
  onPay,
  embedded,
}: DebtsListProps) {
  const [sentKey, setSentKey] = useState('');
  const mine = edges.filter((edge) => edge.from === userId || edge.to === userId);
  const shown = mine.slice(0, 2);
  if (mine.length === 0) return null;

  const find = (id: string) => members.find((member) => member.id === id);

  const remind = async (edge: DebtEdge) => {
    try {
      const result = await remindDebtor({
        debtorId: edge.from,
        debtorName: find(edge.from)?.fullname ?? 'there',
        amount: edge.amount,
        currency,
        tripId,
        tripName,
        fromName: find(userId)?.fullname ?? 'Someone',
      });
      if (result === 'pushed') setSentKey(`${edge.from}-${edge.to}`);
    } catch (err) {
      console.warn('Could not send the reminder:', err);
    }
  };

  return (
    <View style={[styles.card, embedded && styles.embedded]}>
      {shown.map((edge) => {
        const owedToMe = edge.to === userId;
        const other = find(owedToMe ? edge.from : edge.to);
        return (
          <View key={`${edge.from}-${edge.to}`} style={styles.row}>
            <Avatar name={other?.fullname ?? '?'} size={34} photoURL={other?.photoURL} />
            <View style={styles.info}>
              <Text style={styles.name} numberOfLines={1}>
                {(other?.fullname ?? 'Someone').split(' ')[0]}
              </Text>
              <Text style={styles.hint}>{owedToMe ? 'owes you' : 'you owe'}</Text>
            </View>
            <Text
              numberOfLines={1}
              style={[styles.amount, { color: owedToMe ? BrandColors.success : BrandColors.error }]}
            >
              {formatMoney(edge.amount, currency)}
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.action,
                !owedToMe && styles.actionPay,
                pressed && styles.actionPressed,
              ]}
              hitSlop={Spacing.two}
              accessibilityRole="button"
              accessibilityLabel={
                owedToMe
                  ? `Remind ${(other?.fullname ?? 'someone').split(' ')[0]} to pay you`
                  : `Pay ${(other?.fullname ?? 'someone').split(' ')[0]}`
              }
              onPress={() => (owedToMe ? remind(edge) : onPay(edge))}
            >
              <Text style={[styles.actionText, !owedToMe && styles.actionTextPay]}>
                {owedToMe ? (sentKey === `${edge.from}-${edge.to}` ? 'Sent ✓' : 'Remind') : 'Pay'}
              </Text>
            </Pressable>
          </View>
        );
      })}
      {mine.length > shown.length && (
        <Text style={styles.more}>+{mine.length - shown.length} more on the trip</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  embedded: {
    borderWidth: 0,
    borderRadius: 0,
    paddingHorizontal: 0,
    paddingBottom: 0,
    paddingTop: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: BrandColors.border,
  },
  card: {
    backgroundColor: BrandColors.background,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  more: { fontFamily: 'PlusJakartaSans-Medium', fontSize: 12, color: BrandColors.secondary },
  title: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: BrandColors.primary },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  info: { flex: 1 },
  name: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 13, color: BrandColors.primary },
  hint: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 11, color: BrandColors.secondary },
  amount: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 13, flexShrink: 1 },
  action: {
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 12,
    minHeight: 36,
    minWidth: 76,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPay: { backgroundColor: BrandColors.base500, borderColor: BrandColors.base500 },
  actionPressed: { opacity: 0.75 },
  actionText: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 13, color: BrandColors.primary },
  actionTextPay: { color: BrandColors.heading },
});
