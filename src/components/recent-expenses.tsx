import Avatar from '@/components/ui/avatar';
import { BrandColors, Spacing } from '@/constants/theme';
import { categoryLook } from '@/constants/expense-categories';
import { Expense } from '@/types/expenses';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDayTime, formatMoney } from '@/utils/money';

interface RecentExpensesProps {
  expenses: Expense[];
  /** Trip members, so a payer id can be drawn as their face and named for screen readers. */
  members: Array<{ id: string; fullname: string; photoURL?: string }>;
  currency: string;
  limit?: number;
  onExpensePress?: (expense: Expense) => void;
}

/**
 * The last few expenses of the active trip.
 *
 * Amounts come straight from the trip, so what shows here and what shows in the
 * trip's own Expenses tab can never disagree.
 */
export default function RecentExpenses({
  expenses,
  members,
  currency,
  limit,
  onExpensePress,
}: RecentExpensesProps) {
  const shown = limit ? expenses.slice(0, limit) : expenses;

  const nameOf = (id: string) => members.find((member) => member.id === id)?.fullname ?? 'Someone';

  /** The members who paid, in the order the expense lists them. */
  const payersOf = (paidBy: Record<string, number>) =>
    Object.keys(paidBy ?? {})
      .map((id) => members.find((member) => member.id === id))
      .filter((member): member is NonNullable<typeof member> => !!member);

  /** "Ana", or "Ana +2" when several people chipped in. */
  const payerLabel = (paidBy: Record<string, number>): string => {
    const payers = Object.keys(paidBy ?? {});
    if (payers.length === 0) return 'nobody';
    if (payers.length === 1) return nameOf(payers[0]);
    if (payers.length >= members.length) return 'everyone';
    return `${nameOf(payers[0]).split(' ')[0]} +${payers.length - 1}`;
  };

  return (
    <View style={styles.container}>
      {shown.map((item) => {
        const look = categoryLook(item.category);
        const CategoryIcon = look.icon;
        const payers = payersOf(item.paidBy);
        return (
          <Pressable
            key={item.id}
            onPress={() => onExpensePress?.(item)}
            style={({ pressed }) => [styles.expenseCard, { opacity: pressed ? 0.7 : 1 }]}
          >
            <View style={styles.topRow}>
              <View style={styles.leftSection}>
                <View style={[styles.iconContainer, { backgroundColor: look.bg }]}>
                  <CategoryIcon size={20} color={look.tint} />
                </View>
                <View style={styles.info}>
                  <Text style={styles.purchaseTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.subText} numberOfLines={1}>
                    {formatDayTime(item.spentOn, item.spentTime)}
                  </Text>
                </View>
              </View>

              <Text style={styles.amountText}>{formatMoney(item.amount, currency)}</Text>
            </View>

            <View style={styles.payerRow} accessibilityLabel={`Paid by ${payerLabel(item.paidBy)}`}>
              <Text style={styles.payerText}>Paid by</Text>
              {payers.length > 0 ? (
                <View style={styles.faces}>
                  {payers.slice(0, 3).map((member, index) => (
                    <View
                      key={member.id}
                      style={[styles.faceRing, index > 0 && styles.faceOverlap]}
                    >
                      <Avatar name={member.fullname} size={18} photoURL={member.photoURL} />
                    </View>
                  ))}
                  {payers.length > 3 && <Text style={styles.moreFaces}>+{payers.length - 3}</Text>}
                </View>
              ) : (
                <Text style={styles.payerText} numberOfLines={1}>
                  nobody
                </Text>
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    gap: 12,
  },
  expenseCard: {
    flexDirection: 'column',
    gap: Spacing.two,
    backgroundColor: BrandColors.background,
    borderWidth: 1,
    borderColor: BrandColors.base50,
    padding: 10,
    borderRadius: 15,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  leftSection: {
    gap: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    backgroundColor: BrandColors.base400,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    width: 40,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  purchaseTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    color: BrandColors.primary,
  },
  subText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 10,
    color: BrandColors.secondary,
  },
  amountText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    color: BrandColors.primary,
  },
  payerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderTopWidth: 1,
    borderTopColor: BrandColors.border,
    paddingTop: Spacing.two,
  },
  faces: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  faceRing: {
    borderWidth: 2,
    borderColor: BrandColors.background,
    borderRadius: 11,
  },
  faceOverlap: {
    marginLeft: -6,
  },
  moreFaces: {
    marginLeft: Spacing.one,
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 10,
    color: BrandColors.secondary,
  },
  payerText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    color: BrandColors.secondary,
  },
});
