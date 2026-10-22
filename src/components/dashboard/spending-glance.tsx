import { Card, ProgressBar } from '@/components/ui/card';
import { categoryLook } from '@/constants/expense-categories';
import { BrandColors, Spacing } from '@/constants/theme';
import { Expense } from '@/types/expenses';
import { categoryLabel } from '@/utils/balance';
import { formatMoney } from '@/utils/money';
import { StyleSheet, Text, View } from 'react-native';

interface SpendingGlanceProps {
  expenses: Expense[];
  userId: string;
  currency: string;
  /** The trip's budget, when one is set. */
  budget?: number | null;
  tripSpent: number;
}

/** This month's share by category, plus budget use for the trip. */
export default function SpendingGlance({
  expenses,
  userId,
  currency,
  budget,
  tripSpent,
}: SpendingGlanceProps) {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const byCategory: Record<string, number> = {};
  let total = 0;
  expenses.forEach((expense) => {
    if (!expense.spentOn?.startsWith(month)) return;
    const share = expense.shares?.[userId] ?? 0;
    if (share <= 0) return;
    byCategory[expense.category] = (byCategory[expense.category] ?? 0) + share;
    total += share;
  });

  const top = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const hasBudget = !!budget && budget > 0;
  if (total === 0 && !hasBudget) return null;

  return (
    <Card style={styles.card}>
      {total > 0 && (
        <>
          <View style={styles.head}>
            <Text style={styles.title}>Your spending this month</Text>
            <Text style={styles.total}>{formatMoney(total, currency)}</Text>
          </View>
          {top.map(([category, amount]) => {
            const look = categoryLook(category);
            return (
              <View key={category} style={styles.row}>
                <look.icon size={14} color={look.tint} />
                <Text style={styles.name}>{categoryLabel(category)}</Text>
                <View style={styles.bar}>
                  <ProgressBar ratio={amount / total} color={look.tint} height={6} />
                </View>
                <Text style={styles.amount}>{formatMoney(amount, currency)}</Text>
              </View>
            );
          })}
        </>
      )}
      {hasBudget && (
        <View style={styles.budget}>
          <View style={styles.head}>
            <Text style={styles.title}>Trip budget</Text>
            <Text style={styles.total}>
              {formatMoney(tripSpent, currency)} / {formatMoney(budget!, currency)}
            </Text>
          </View>
          <ProgressBar
            ratio={tripSpent / budget!}
            color={tripSpent > budget! ? BrandColors.error : BrandColors.success}
          />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.two },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: BrandColors.primary },
  total: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 13, color: BrandColors.primary },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  name: { width: 72, fontFamily: 'PlusJakartaSans-Regular', fontSize: 12, color: BrandColors.primary },
  bar: { flex: 1 },
  amount: { fontFamily: 'PlusJakartaSans-Medium', fontSize: 12, color: BrandColors.secondary },
  budget: { gap: Spacing.two },
});
