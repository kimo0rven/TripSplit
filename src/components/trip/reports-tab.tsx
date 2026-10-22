import Avatar from '@/components/ui/avatar';
import { Card, HelperText, ProgressBar, SectionTitle } from '@/components/ui/card';
import { BrandColors, Spacing } from '@/constants/theme';
import { categoryLook } from '@/constants/expense-categories';
import { Expense, Settlement } from '@/types/expenses';
import { TripMember } from '@/types/trips';
import { categoryLabel } from '@/utils/balance';
import ExportButtons from '@/components/trip/export-buttons';
import { formatLongDay, formatMoney } from '@/utils/money';
import { Users } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface ReportsTabProps {
  expenses: Expense[];
  members: TripMember[];
  currency: string;
  totalSpent: number;
  settledTotal: number;
  tripName: string;
  settlements: Settlement[];
}

type Range = 'trip' | 'today' | 'week';

const RANGES: Array<{ value: Range; label: string }> = [
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
}: ReportsTabProps) {
  const [range, setRange] = useState<Range>('trip');

  const filtered = useMemo(() => {
    if (range === 'trip') return expenses;
    const from = range === 'today' ? dayKeyBefore(0) : dayKeyBefore(6);
    return expenses.filter((expense) => expense.spentOn >= from);
  }, [expenses, range]);

  const spent = filtered.reduce((sum, expense) => sum + expense.amount, 0);
  const memberCount = Math.max(members.length, 1);
  const perPerson = spent / memberCount;

  const byCategory = useMemo(() => {
    const totals: Record<string, number> = {};
    filtered.forEach((expense) => {
      const key = expense.category || 'other';
      totals[key] = (totals[key] ?? 0) + expense.amount;
    });
    return Object.entries(totals)
      .map(([value, total]) => ({ value, label: categoryLabel(value), total }))
      .sort((a, b) => b.total - a.total);
  }, [filtered]);

  const topCategory = byCategory[0];

  // Most recent days first, with the running total per day.
  const byDay = useMemo(() => {
    const totals: Record<string, number> = {};
    filtered.forEach((expense) => {
      totals[expense.spentOn] = (totals[expense.spentOn] ?? 0) + expense.amount;
    });
    return Object.entries(totals)
      .map(([day, total]) => ({ day, total }))
      .sort((a, b) => (a.day < b.day ? 1 : -1))
      .slice(0, 7);
  }, [filtered]);

  const maxDay = byDay.reduce((max, entry) => Math.max(max, entry.total), 0);

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

      <SectionTitle>By category</SectionTitle>

      {byCategory.length === 0 ? (
        <HelperText>No expenses in this range yet.</HelperText>
      ) : (
        <View style={styles.list}>
          {byCategory.map((entry) => {
            const look = categoryLook(entry.value);
            const CategoryIcon = look.icon;
            return (
              <View key={entry.value} style={styles.categoryRow}>
                <View style={styles.categoryTop}>
                  <View style={styles.categoryLabelRow}>
                    <View style={[styles.categoryIcon, { backgroundColor: look.bg }]}>
                      <CategoryIcon size={12} color={look.tint} />
                    </View>
                    <Text style={styles.categoryName}>{entry.label}</Text>
                  </View>
                  <Text style={styles.categoryAmount}>
                    {formatMoney(entry.total, currency)}
                    <Text style={styles.categoryPercent}>
                      {'  '}
                      {spent > 0 ? Math.round((entry.total / spent) * 100) : 0}%
                    </Text>
                  </Text>
                </View>
                <ProgressBar ratio={spent > 0 ? entry.total / spent : 0} height={6} />
              </View>
            );
          })}
        </View>
      )}

      <SectionTitle>Daily spend</SectionTitle>

      {byDay.length === 0 ? (
        <HelperText>Nothing recorded for these days.</HelperText>
      ) : (
        <View style={styles.list}>
          {byDay.map((entry) => (
            <View key={entry.day} style={styles.categoryRow}>
              <View style={styles.categoryTop}>
                <Text style={styles.categoryName}>{formatLongDay(entry.day)}</Text>
                <Text style={styles.categoryAmount}>{formatMoney(entry.total, currency)}</Text>
              </View>
              <ProgressBar
                ratio={maxDay > 0 ? entry.total / maxDay : 0}
                height={6}
                color={BrandColors.info}
              />
            </View>
          ))}
        </View>
      )}

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

      <Card style={styles.highlights}>
        <View style={styles.highlightRow}>
          <Users size={14} color={BrandColors.secondary} />
          <Text style={styles.highlightText}>
            {topCategory
              ? `Biggest category: ${topCategory.label} at ${formatMoney(topCategory.total, currency)}.`
              : 'Add expenses to see highlights.'}
          </Text>
        </View>
        <View style={styles.highlightRow}>
          <Users size={14} color={BrandColors.secondary} />
          <Text style={styles.highlightText}>
            {paidBackPercent}% of the trip's spending has already been settled up.
            {totalSpent > spent ? ` Whole trip total: ${formatMoney(totalSpent, currency)}.` : ''}
          </Text>
        </View>
      </Card>

      <HelperText>
        Reports use the trip's own currency ({currency}) and count every recorded payment.
      </HelperText>
      <SectionTitle>Export</SectionTitle>
      <ExportButtons data={{ tripName, currency, members, expenses, settlements }} />
    </View>
  );
}

const styles = StyleSheet.create({
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
    color: BrandColors.primary,
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
  highlights: {
    backgroundColor: BrandColors.infoBg,
    borderColor: BrandColors.infoBg,
    gap: Spacing.two,
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  highlightText: {
    flex: 1,
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: BrandColors.primary,
    lineHeight: 17,
  },
});
