import DayDivider from '@/components/ui/day-divider';
import MemberFaces from '@/components/ui/member-faces';
import { Card } from '@/components/ui/card';
import ReactionStrip from '@/components/trip/reaction-strip';
import { categoryLook } from '@/constants/expense-categories';
import { BrandColors, Spacing } from '@/constants/theme';
import { Expense } from '@/types/expenses';
import { TripMember } from '@/types/trips';
import { groupByDay } from '@/utils/listGrouping';
import { memberLookup } from '@/utils/memberLookup';
import { dayHeading, formatDayTime, formatMoney } from '@/utils/money';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface ExpenseCardsProps {
  expenses: Expense[];
  members: TripMember[];
  currency: string;
  currentUserId: string;
  /**
   * Whether this person may change or delete an entry.
   *
   * The default keeps the old rule - only whoever entered an expense can touch
   * it - but every trip screen passes `canChange` below, so anyone in the trip
   * can fix an expense somebody else recorded, whether they paid it or not.
   */
  canChange?: (expense: Expense) => boolean;
  /** Opens the sheet holding the whole expense, where Edit and Delete live. */
  onPress?: (expense: Expense) => void;
  /**
   * Splits the list into day sections.
   *
   * Used on the pages holding a whole trip's history, where a break per day is
   * what makes a long list readable. The trip's own short list stays flat.
   */
  grouped?: boolean;
  /**
   * Called when someone taps a reaction, with the whole new map for that
   * expense. Omit it and the reactions draw without being tappable.
   */
  onReact?: (expenseId: string, reactions: Record<string, string[]>) => void;
}

/**
 * The expense cards themselves, shared by the trip's Expenses tab and the
 * "All expenses" page.
 *
 * One component so an expense can never look different in the two places. The
 * caller decides how many to pass in, and whether they are broken up by day.
 */
export default function ExpenseCards({
  expenses,
  members,
  currency,
  currentUserId,
  canChange,
  onPress,
  grouped = false,
  onReact,
}: ExpenseCardsProps) {
  const lookup = useMemo(() => memberLookup(members), [members]);
  const nameOf = lookup.nameOf;

  const days = useMemo(
    () => (grouped ? groupByDay(expenses, (expense) => expense.spentOn) : []),
    [grouped, expenses],
  );

  /** One card. Shared by both layouts, so the two can never drift apart. */
  const renderCard = (expense: Expense) => {
    const payers = Object.keys(expense.paidBy ?? {});
    const payerLabel =
      payers.length === 0
        ? 'nobody'
        : payers.length === 1
          ? nameOf(payers[0])
          : `${payerLabelOf(payers, nameOf, members.length)}`;
    // The payer's face says who it was faster than a name does, so the footer
    // draws faces. People who left the trip have no member record left to draw,
    // which is why the name stays as the screen-reader text.
    const payerFaces = payers
      .map((id) => lookup.get(id))
      .filter((member): member is TripMember => !!member);
    const look = categoryLook(expense.category);
    const CategoryIcon = look.icon;

    return (
      <Card key={expense.id} style={styles.expenseCard}>
        {/* The row that opens the details is its own Pressable, and the Delete
            link is a sibling rather than a child, so a tap on one can never
            fire the other (nested buttons do that on web). */}
        <Pressable
          onPress={() => onPress?.(expense)}
          style={({ pressed }) => [styles.expenseTop, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`${expense.title}, ${formatMoney(expense.amount, currency)}`}
        >
          {/* Always the category's picture; receipts are opened from the details. */}
          <View style={[styles.thumbPlaceholder, { backgroundColor: look.bg }]}>
            <CategoryIcon size={18} color={look.tint} />
          </View>

          <View style={styles.expenseInfo}>
            <Text style={styles.expenseTitle} numberOfLines={1}>
              {expense.title}
            </Text>
            <Text style={styles.expenseMeta} numberOfLines={1}>
              {formatDayTime(expense.spentOn, expense.spentTime)}
            </Text>
          </View>

          <Text style={styles.expenseAmount}>{formatMoney(expense.amount, currency)}</Text>
        </Pressable>

        <View style={styles.expenseFooter}>
          <Pressable
            onPress={() => onPress?.(expense)}
            style={styles.footerLines}
            accessibilityRole="button"
            accessibilityLabel={`Paid by ${payerLabel}`}
          >
            <View style={styles.payerRow}>
              <Text style={styles.footerText}>Paid by</Text>
              {payerFaces.length > 0 ? (
                <MemberFaces members={payerFaces} size={18} max={3} />
              ) : (
                <Text style={styles.footerText} numberOfLines={1}>
                  nobody
                </Text>
              )}
            </View>
          </Pressable>
        </View>

        {/* Reactions sit under the footer, so a tap can never land on the
            rows that open or delete the expense. */}
        <ReactionStrip
          reactions={expense.reactions}
          members={members}
          currentUserId={currentUserId}
          onChange={onReact ? (next) => onReact(expense.id, next) : undefined}
          compact
        />
      </Card>
    );
  };

  if (!grouped) return <View style={styles.list}>{expenses.map(renderCard)}</View>;

  return (
    <View style={styles.groupedList}>
      {days.map((group) => {
        // Each day's own total, so a section says what that day cost before
        // anyone reads a single card.
        const dayTotal = group.items.reduce((sum, expense) => sum + (expense.amount || 0), 0);

        return (
          <View key={group.day} style={styles.day}>
            <DayDivider
              label={dayHeading(group.day)}
              count={group.items.length}
              total={formatMoney(dayTotal, currency)}
            />
            <View style={styles.list}>{group.items.map(renderCard)}</View>
          </View>
        );
      })}
    </View>
  );
}

/** "Ana + 2 more" so long payer lists stay readable. */
function payerLabelOf(
  payers: string[],
  nameOf: (id: string) => string,
  totalMembers: number,
): string {
  if (payers.length >= totalMembers) return 'everyone';
  const first = nameOf(payers[0]).split(' ')[0];
  const others = payers.length - 1;
  return others > 0 ? `${first} +${others}` : first;
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.two,
  },
  groupedList: {
    gap: Spacing.three,
  },
  day: {
    gap: Spacing.two,
  },
  expenseCard: {
    gap: Spacing.two,
  },
  expenseTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  pressed: {
    opacity: 0.6,
  },
  thumb: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: BrandColors.inputField,
  },
  thumbPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: BrandColors.inputField,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  expenseInfo: {
    flex: 1,
    gap: 2,
  },
  expenseTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    color: BrandColors.primary,
  },
  expenseMeta: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    color: BrandColors.secondary,
  },
  expenseAmount: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 15,
    color: BrandColors.primary,
  },
  expenseFooter: {
    borderTopWidth: 1,
    borderTopColor: BrandColors.border,
    paddingTop: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  footerLines: {
    flex: 1,
  },
  payerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  footerText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    color: BrandColors.secondary,
  },
});
