import Avatar from '@/components/ui/avatar';
import { Card, HelperText, ProgressBar, SectionTitle } from '@/components/ui/card';
import { BrandColors, Spacing } from '@/constants/theme';
import { Expense, Settlement } from '@/types/expenses';
import { TripMember } from '@/types/trips';
import { categoryLabel, computeBalances } from '@/utils/balance';
import ExportButtons from '@/components/trip/export-buttons';
import TripReviewCard from '@/components/trip/trip-review-card';
import BalanceBars from '@/components/charts/balance-bars';
import BudgetChart from '@/components/charts/budget-chart';
import CategoryDonut from '@/components/charts/category-donut';
import { chartStyles } from '@/components/charts/chart-kit';
import DailyBarsChart from '@/components/charts/daily-bars-chart';
import SettleChart from '@/components/charts/settle-chart';
import TimeGridChart from '@/components/charts/time-grid-chart';
import {
  budgetLine,
  categorySlices,
  chartDays,
  dailyBars,
  settleProgress,
  timeGrid,
  topCategories,
} from '@/utils/charts';
import { formatMoney, todayKey } from '@/utils/money';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { themedStyles } from '@/constants/themed-styles';

interface ReportsTabProps {
  expenses: Expense[];
  members: TripMember[];
  currency: string;
  totalSpent: number;
  settledTotal: number;
  tripName: string;
  settlements: Settlement[];
  /** The trip's dates, so every day gets a bar even with nothing spent. */
  startDate?: string;
  endDate?: string;
  /** The trip's budget, 0 when none was set. */
  budget?: number;
  currentUserId?: string;
}

type Range = 'trip' | 'today' | 'week';

const RANGES: { value: Range; label: string }[] = [
  { value: 'trip', label: 'Whole trip' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Last 7 days' },
];

const dayKeyBefore = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

export default function ReportsTab({
  expenses,
  members,
  currency,
  totalSpent,
  settledTotal,
  tripName,
  settlements,
  startDate,
  endDate,
  budget = 0,
  currentUserId = '',
}: ReportsTabProps) {
  const today = todayKey();
  // The whole trip's charts: one shared set of days and category colours.
  const days = useMemo(
    () => chartDays({ startDate, endDate }, expenses),
    [startDate, endDate, expenses],
  );
  const top = useMemo(() => topCategories(expenses), [expenses]);
  const bars = useMemo(() => dailyBars(expenses, days, top), [expenses, days, top]);
  const line = useMemo(() => budgetLine(expenses, days, today), [expenses, days, today]);
  const grid = useMemo(() => timeGrid(expenses, days), [expenses, days]);
  const progress = useMemo(
    () => settleProgress(expenses, settlements, days, today),
    [expenses, settlements, days, today],
  );
  const nets = useMemo(() => {
    const balances = computeBalances(
      members.map((member) => member.id),
      expenses,
      settlements,
    );
    return members.map((member) => ({
      member,
      net: balances.find((balance) => balance.memberId === member.id)?.net ?? 0,
    }));
  }, [members, expenses, settlements]);

  const [range, setRange] = useState<Range>('trip');

  const filtered = useMemo(() => {
    if (range === 'trip') return expenses;
    const from = range === 'today' ? dayKeyBefore(0) : dayKeyBefore(6);
    return expenses.filter((expense) => expense.spentOn >= from);
  }, [expenses, range]);

  const spent = filtered.reduce((sum, expense) => sum + expense.amount, 0);
  const memberCount = Math.max(members.length, 1);
  const perPerson = spent / memberCount;

  const rankedMembers = useMemo(() => {
    const paid: Record<string, number> = {};
    const owed: Record<string, number> = {};
    const count: Record<string, number> = {};
    let sharedBills = 0;
    filtered.forEach((expense) => {
      const payers = Object.entries(expense.paidBy ?? {});
      if (payers.length > 1) sharedBills += 1;
      payers.forEach(([id, amount]) => {
        paid[id] = (paid[id] ?? 0) + amount;
        count[id] = (count[id] ?? 0) + 1;
      });
      Object.entries(expense.shares ?? {}).forEach(([id, amount]) => {
        owed[id] = (owed[id] ?? 0) + amount;
      });
    });
    const total = Object.values(paid).reduce((sum, value) => sum + value, 0);
    return {
      sharedBills,
      rows: members
        .map((member) => ({
          member,
          amount: paid[member.id] ?? 0,
          owed: owed[member.id] ?? 0,
          count: count[member.id] ?? 0,
          percent: total > 0 ? Math.round(((paid[member.id] ?? 0) / total) * 100) : 0,
        }))
        .sort((a, b) => b.amount - a.amount),
    };
  }, [filtered, members]);

  const maxPaid = rankedMembers.rows.reduce((max, entry) => Math.max(max, entry.amount), 0);

  const paidBackPercent =
    totalSpent > 0 ? Math.round(Math.min(1, settledTotal / totalSpent) * 100) : 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.rangeRow}>
        {RANGES.map((entry) => {
          const isOn = entry.value === range;
          return (
            <Pressable
              key={entry.value}
              style={[styles.rangeChip, isOn && styles.rangeChipOn]}
              onPress={() => setRange(entry.value)}
            >
              <Text style={[styles.rangeText, isOn && styles.rangeTextOn]}>{entry.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.statGrid}>
        <Card style={styles.statCard}>
          <Text style={styles.statLabel}>Spent in range</Text>
          <Text style={styles.statValue}>{formatMoney(spent, currency)}</Text>
          <Text style={styles.statMeta}>{filtered.length} expenses</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statLabel}>Average per person</Text>
          <Text style={styles.statValue}>{formatMoney(perPerson, currency)}</Text>
          <Text style={styles.statMeta}>{members.length} members</Text>
        </Card>
      </View>

      <SectionTitle>Each day</SectionTitle>
      <View style={chartStyles.card}>
        <Text style={chartStyles.sub}>Every day of the trip, split by what the money went on.</Text>
        <DailyBarsChart
          bars={bars}
          top={top}
          currency={currency}
          labelOf={categoryLabel}
          today={today}
        />
      </View>

      <SectionTitle>Spending against the budget</SectionTitle>
      <View style={chartStyles.card}>
        <BudgetChart line={line} days={days} budget={budget} currency={currency} />
      </View>

      <SectionTitle>By category</SectionTitle>
      <View style={chartStyles.card}>
        <CategoryDonut
          slices={categorySlices(filtered, top)}
          top={top}
          total={spent}
          currency={currency}
          labelOf={categoryLabel}
        />
      </View>

      <SectionTitle>Who is ahead</SectionTitle>
      <View style={chartStyles.card}>
        <Text style={chartStyles.sub}>Where everyone stands right now, for the whole trip.</Text>
        <BalanceBars nets={nets} currency={currency} currentUserId={currentUserId} />
      </View>

      <SectionTitle>Who has paid what</SectionTitle>

      {rankedMembers.sharedBills > 0 && (
        <HelperText>
          {rankedMembers.sharedBills} {rankedMembers.sharedBills === 1 ? 'bill was' : 'bills were'}{' '}
          paid by more than one person.
        </HelperText>
      )}

      <View style={styles.list}>
        {rankedMembers.rows.map((entry) => (
          <View key={entry.member.id} style={styles.memberRow}>
            <Avatar name={entry.member.fullname} size={30} photoURL={entry.member.photoURL} />
            <View style={styles.memberBar}>
              <Text style={styles.categoryName} numberOfLines={1}>
                {entry.member.fullname}
              </Text>
              <ProgressBar
                ratio={maxPaid > 0 ? entry.amount / maxPaid : 0}
                height={6}
                color={BrandColors.base50}
              />
            </View>
            <View style={styles.paidRight}>
              <Text style={styles.categoryAmount}>{formatMoney(entry.amount, currency)}</Text>
              <Text style={styles.paidMeta}>
                {entry.percent}% · {entry.count} {entry.count === 1 ? 'bill' : 'bills'}
              </Text>
              <Text style={styles.paidMeta}>Share {formatMoney(entry.owed, currency)}</Text>
            </View>
          </View>
        ))}
      </View>

      <SectionTitle>When the money goes</SectionTitle>
      <View style={chartStyles.card}>
        <TimeGridChart grid={grid} days={days} currency={currency} />
      </View>

      <SectionTitle>Settling up</SectionTitle>
      <View style={chartStyles.card}>
        <Text style={chartStyles.sub}>
          What is still owed between people, and what has been paid back, day by day.
        </Text>
        <SettleChart points={progress} currency={currency} />
      </View>

      {/* The trip summed up, in the same card the Fun tab used to show. */}
      <TripReviewCard
        members={members}
        expenses={filtered}
        currency={currency}
        extraFacts={[
          { label: 'Settled up so far', value: `${paidBackPercent}%` },
          ...(totalSpent > spent
            ? [{ label: 'Whole trip total', value: formatMoney(totalSpent, currency) }]
            : []),
        ]}
      />

      <HelperText>
        Reports use the trip's own currency ({currency}) and count every recorded payment.
      </HelperText>
      <SectionTitle>Export</SectionTitle>
      <ExportButtons data={{ tripName, currency, members, expenses, settlements }} />
    </View>
  );
}

const styles = themedStyles(() => ({
  wrap: {
    gap: Spacing.three,
  },
  rangeRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  rangeChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  rangeChipOn: {
    backgroundColor: BrandColors.base50,
    borderColor: BrandColors.base50,
  },
  rangeText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: BrandColors.secondary,
  },
  rangeTextOn: {
    color: BrandColors.onBrand,
    fontFamily: 'PlusJakartaSans-Bold',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 20,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
  },
  editText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 11,
    color: BrandColors.primary,
  },
  statGrid: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  statCard: {
    flex: 1,
    gap: 2,
  },
  statLabel: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 11,
    color: BrandColors.secondary,
  },
  statValue: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 17,
    color: BrandColors.primary,
  },
  statMeta: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 10,
    color: BrandColors.secondary,
  },
  list: {
    gap: Spacing.two,
  },
  categoryRow: {
    gap: 4,
  },
  categoryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryName: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: BrandColors.primary,
  },
  categoryLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryIcon: {
    width: 22,
    height: 22,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryAmount: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 12,
    color: BrandColors.primary,
  },
  categoryPercent: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    color: BrandColors.secondary,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  paidRight: { alignItems: 'flex-end', gap: 1 },
  paidMeta: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 10, color: BrandColors.secondary },
  memberBar: {
    flex: 1,
    gap: 3,
  },
}));
