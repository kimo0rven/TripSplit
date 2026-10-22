import Avatar from '@/components/ui/avatar';
import { BrandColors, Spacing } from '@/constants/theme';
import { Settlement } from '@/types/expenses';
import { TripMember } from '@/types/trips';
import { formatMoney } from '@/utils/money';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface PendingPaymentsProps {
  payments: Settlement[];
  members: TripMember[];
  currency: string;
  onRespond: (payment: Settlement, accept: boolean) => void;
  onViewAll: () => void;
}

/** Payments other people say they made to you, with Confirm and Decline on the spot. */
export default function PendingPayments({
  payments,
  members,
  currency,
  onRespond,
  onViewAll,
}: PendingPaymentsProps) {
  if (payments.length === 0) return null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {payments.length === 1
            ? '1 payment waiting for you'
            : `${payments.length} payments waiting for you`}
        </Text>
        <Pressable onPress={onViewAll} hitSlop={8}>
          <Text style={styles.link}>History</Text>
        </Pressable>
      </View>
      {payments.slice(0, 3).map((payment) => {
        const from = members.find((member) => member.id === payment.from);
        return (
          <View key={payment.id} style={styles.row}>
            <Avatar name={from?.fullname ?? '?'} size={34} photoURL={from?.photoURL} />
            <Text style={styles.text} numberOfLines={1}>
              {(from?.fullname ?? 'Someone').split(' ')[0]} paid {formatMoney(payment.amount, currency)}
            </Text>
            <Pressable style={styles.confirm} onPress={() => onRespond(payment, true)}>
              <Text style={styles.confirmText}>Confirm</Text>
            </Pressable>
            <Pressable style={styles.decline} onPress={() => onRespond(payment, false)}>
              <Text style={styles.declineText}>Decline</Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: BrandColors.infoBg, borderRadius: 16, padding: Spacing.three, gap: Spacing.two },
  header: { flexDirection: 'row', justifyContent: 'space-between' },
  title: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 13, color: BrandColors.primary },
  link: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 12, color: BrandColors.primary },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  text: { flex: 1, fontFamily: 'PlusJakartaSans-Medium', fontSize: 13, color: BrandColors.primary },
  confirm: { backgroundColor: BrandColors.success, borderRadius: 10, paddingHorizontal: Spacing.two, paddingVertical: Spacing.one },
  confirmText: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 11, color: BrandColors.background },
  decline: { borderWidth: 1, borderColor: BrandColors.error, borderRadius: 10, paddingHorizontal: Spacing.two, paddingVertical: Spacing.one },
  declineText: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 11, color: BrandColors.error },
});
