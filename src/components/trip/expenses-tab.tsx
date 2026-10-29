import { HelperText, SectionTitle } from '@/components/ui/card';
import EmptyState from '@/components/ui/empty-state';
import ExpenseCards from '@/components/trip/expense-cards';
import { BrandColors, Spacing } from '@/constants/theme';
import { Expense } from '@/types/expenses';
import { TripMember } from '@/types/trips';
import { Receipt } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

/** How many expenses the trip page itself lists before "View all". */
export const RECENT_EXPENSE_LIMIT = 3;

interface ExpensesTabProps {
  expenses: Expense[];
  members: TripMember[];
  currency: string;
  currentUserId: string;
  onAdd: () => void;
  /** Opens the page listing every expense of the trip. */
  onViewAll: () => void;
  /** Opens the sheet holding one expense's full detail. */
  onOpenExpense: (expense: Expense) => void;
  /** Saves a reaction someone tapped on an expense card. */
  onReact?: (expenseId: string, reactions: Record<string, string[]>) => void;
}

export default function ExpensesTab({
  expenses,
  members,
  currency,
  currentUserId,
  onAdd,
  onViewAll,
  onOpenExpense,
  onReact,
}: ExpensesTabProps) {
  // Newest first, then only the first few. The rest live on their own page.
  const recent = expenses.slice(0, RECENT_EXPENSE_LIMIT);

  return (
    <View style={styles.wrap}>
      <SectionTitle
        right={
          // Plain blue text, not a button: adding an expense is the floating
          // button's job, so this is only a quiet way to see the rest.
          // Shown whenever there is at least one expense, so it does not
          // flicker in and out as the list grows past five.
          expenses.length > 0 ? (
            <Pressable onPress={onViewAll} hitSlop={8} accessibilityRole="link">
              <Text style={styles.viewAllLink}>View All</Text>
            </Pressable>
          ) : null
        }
      >
        Expenses
      </SectionTitle>

      {expenses.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No expenses yet"
          message="Add the first one, then anyone in the trip can see who paid and who owes what."
          actionLabel="Add expense"
          onAction={onAdd}
        />
      ) : (
        <>
          <ExpenseCards
            expenses={recent}
            members={members}
            currency={currency}
            currentUserId={currentUserId}
            canChange={() => true}
            onPress={onOpenExpense}
            onReact={onReact}
          />

          <HelperText>
            Anyone in this trip can edit or delete an expense, and every change is kept in its edit
            log.
          </HelperText>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.three,
  },
  viewAllLink: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    color: BrandColors.info,
  },
});
