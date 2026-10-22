import RecentExpenses from '@/components/recent-expenses';
import EmptyState from '@/components/ui/empty-state';
import { BrandColors, Spacing } from '@/constants/theme';
import { Expense } from '@/types/expenses';
import { TripMember } from '@/types/trips';
import { UsersRound, Wallet } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface RecentSectionProps {
  tripName?: string;
  hasTrip: boolean;
  expenses: Expense[];
  members: TripMember[];
  currency: string;
  onOpenExpense: (expense: Expense) => void;
  onViewAll: () => void;
  onAddExpense: () => void;
  onGoToTrips: () => void;
}

/** The latest expenses of the active trip, or an empty state that says what to do next. */
export default function RecentSection({
  tripName,
  hasTrip,
  expenses,
  members,
  currency,
  onOpenExpense,
  onViewAll,
  onAddExpense,
  onGoToTrips,
}: RecentSectionProps) {
  return (
    <View style={styles.recentExpensesContainer}>
      <View style={styles.recentExpensesHeader}>
        <Text style={styles.recentExpenseTitle}>
          {hasTrip ? `Recent on ${tripName}` : 'Recent expenses'}
        </Text>
        {hasTrip && expenses.length > 0 && (
          <Pressable onPress={onViewAll} hitSlop={8} accessibilityRole="link">
            <Text style={styles.recentExpenseViewAll}>View All</Text>
          </Pressable>
        )}
      </View>

      {hasTrip && expenses.length > 0 ? (
        <RecentExpenses
          limit={5}
          expenses={expenses}
          members={members}
          currency={currency}
          onExpensePress={onOpenExpense}
        />
      ) : (
        <EmptyState
          icon={hasTrip ? UsersRound : Wallet}
          title={hasTrip ? 'Nothing spent yet' : 'No trip yet'}
          message={
            hasTrip
              ? 'Add the first expense and everyone in the trip will see who paid and who owes what.'
              : 'Create a trip for your next getaway, then invite friends to split expenses with you.'
          }
          actionLabel={hasTrip ? 'Add expense' : 'Go to trips'}
          onAction={hasTrip ? onAddExpense : onGoToTrips}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  recentExpensesContainer: {
    flexDirection: 'column',
    gap: Spacing.two,
  },
  recentExpenseTitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    color: BrandColors.primary,
    flex: 1,
  },
  recentExpenseViewAll: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    color: BrandColors.info,
  },
  recentExpensesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
