import BottomSheet from '@/components/ui/bottom-sheet';
import { HelperText } from '@/components/ui/card';
import { BrandColors, Spacing } from '@/constants/theme';
import { DebtEdge, Expense, Settlement } from '@/types/expenses';
import { TripMember } from '@/types/trips';
import { countsTowardBalance } from '@/utils/balance';
import { coverageFor } from '@/utils/coverage';
import { formatDay, formatMoney } from '@/utils/money';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

interface WhyOweSheetProps {
  /** Whose debt to explain, or '' while closed. */
  debtorId: string;
  onClose: () => void;
  edges: DebtEdge[];
  expenses: Expense[];
  settlements: Settlement[];
  members: TripMember[];
  currency: string;
  currentUserId: string;
}

/**
 * Why someone owes what they owe: their shares of each expense, what they
 * paid for others, what they already settled, and the unpaid shares left.
 * Debts are simplified, so the people they pay are just the shortest route;
 * the expenses below are what the money is really for.
 */
export default function WhyOweSheet({
  debtorId,
  onClose,
  edges,
  expenses,
  settlements,
  members,
  currency,
  currentUserId,
}: WhyOweSheetProps) {
  const money = (value: number) => formatMoney(value, currency);
  const nameOf = (id: string) =>
    id === currentUserId
      ? 'you'
      : (members.find((member) => member.id === id)?.fullname ?? 'someone').split(' ')[0];
  const isMe = debtorId === currentUserId;
  const who = isMe ? 'You' : nameOf(debtorId);
  const their = isMe ? 'your' : `${who}’s`;

  const counted = settlements.filter(countsTowardBalance);
  const shares = expenses.reduce((sum, e) => sum + (Number(e.shares?.[debtorId]) || 0), 0);
  const paid = expenses.reduce((sum, e) => sum + (Number(e.paidBy?.[debtorId]) || 0), 0);
  const sent = counted.filter((s) => s.from === debtorId).reduce((sum, s) => sum + s.amount, 0);
  const received = counted.filter((s) => s.to === debtorId).reduce((sum, s) => sum + s.amount, 0);
  const owing = edges.filter((edge) => edge.from === debtorId);
  const totalOwed = owing.reduce((sum, edge) => sum + edge.amount, 0);

  const open = debtorId ? coverageFor(debtorId, expenses, settlements).open : [];
  const expenseOf = (id: string) => expenses.find((expense) => expense.id === id);
  const payersOf = (expense?: Expense) =>
    Object.keys(expense?.paidBy ?? {})
      .filter((id) => id !== debtorId)
      .map(nameOf)
      .join(' & ');

  const rows: [string, number][] = [
    [`${isMe ? 'Your' : `${who}’s`} share of every expense`, shares],
    [`Paid ${isMe ? 'by you' : `by ${who}`} for the group`, -paid],
    ...(sent ? ([['Already paid back', -sent]] as [string, number][]) : []),
    ...(received ? ([['Paid back to them by others', received]] as [string, number][]) : []),
  ];

  return (
    <BottomSheet
      visible={!!debtorId}
      title={`Why ${who.toLowerCase() === 'you' ? 'you owe' : `${who} owes`}`}
      onClose={onClose}
    >
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          {rows.map(([label, value]) => (
            <View key={label} style={styles.sumRow}>
              <Text style={styles.sumLabel}>{label}</Text>
              <Text style={styles.sumValue}>
                {value < 0 ? '− ' : ''}
                {money(Math.abs(value))}
              </Text>
            </View>
          ))}
          <View style={[styles.sumRow, styles.sumTotal]}>
            <Text style={styles.totalLabel}>Still owed</Text>
            <Text style={styles.totalValue}>{money(totalOwed)}</Text>
          </View>
          {owing.length > 0 && (
            <HelperText>
              Simplified, that is{' '}
              {owing.map((edge) => `${money(edge.amount)} to ${nameOf(edge.to)}`).join(' and ')}.
              Who gets the money is just the shortest route; it pays for the shares below.
            </HelperText>
          )}
        </View>

        <Text style={styles.title}>Unpaid shares, oldest first</Text>
        {open.length === 0 ? (
          <HelperText>Nothing left unpaid.</HelperText>
        ) : (
          open.map((item) => {
            const expense = expenseOf(item.expenseId);
            const part = item.covered < item.share - 0.004;
            return (
              <View key={item.expenseId} style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {formatDay(item.spentOn)}
                    {payersOf(expense) ? ` · paid by ${payersOf(expense)}` : ''}
                    {part ? ` · ${money(item.share - item.covered)} of ${their} share paid` : ''}
                  </Text>
                </View>
                <Text style={styles.rowAmount}>{money(item.covered)}</Text>
              </View>
            );
          })
        )}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: Spacing.three, paddingBottom: Spacing.four },
  card: {
    gap: Spacing.two,
    backgroundColor: BrandColors.inputField,
    borderRadius: 15,
    padding: Spacing.three,
  },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
  sumLabel: {
    flex: 1,
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13,
    color: BrandColors.primary,
  },
  sumValue: { fontFamily: 'PlusJakartaSans-Medium', fontSize: 13, color: BrandColors.primary },
  sumTotal: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BrandColors.border,
    paddingTop: Spacing.two,
  },
  totalLabel: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: BrandColors.primary },
  totalValue: { fontFamily: 'PlusJakartaSans-ExtraBold', fontSize: 14, color: BrandColors.primary },
  title: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: BrandColors.primary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BrandColors.border,
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: BrandColors.primary },
  rowMeta: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 12, color: BrandColors.secondary },
  rowAmount: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: BrandColors.primary },
});
