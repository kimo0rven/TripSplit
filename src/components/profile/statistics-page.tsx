import BackButton from '@/components/Button/back-button';
import ErrorState from '@/components/ui/error-state';
import ListSkeleton from '@/components/ui/list-skeleton';
import NavBar from '@/components/Navbar/Nav';
import { categoryLook } from '@/constants/expense-categories';
import { BrandColors, MaxContentWidth, Spacing } from '@/constants/theme';
import { fetchExpenses } from '@/services/Firebase/expenseService';
import { fetchSettlements } from '@/services/Firebase/settlementService';
import { fetchUserTrips } from '@/services/Firebase/tripService';
import { Expense } from '@/types/expenses';
import { categoryLabel, computeBalances, simplifyDebts } from '@/utils/balance';
import {
  PersonBalance,
  RANGE_LABEL,
  ShareEntry,
  StatsRange,
  addDebts,
  biggestExpense,
  mainCurrency,
  monthChange,
  monthlyTrend,
  rangeStart,
  spendingHabits,
  topBalances,
  tripComparison,
} from '@/utils/stats';
import { formatMoney } from '@/utils/money';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface CurrencyStats {
  currency: string;
  paid: number;
  share: number;
  net: number;
  /** Your share of spending in each category, biggest first. */
  categories: { category: string; amount: number; count: number }[];
}

interface RawTrip {
  id: string;
  name: string;
  currency: string;
  expenses: Expense[];
  /** Your balance on the trip right now, which does not depend on the date range. */
  net: number;
}

interface RawStats {
  trips: RawTrip[];
  friends: number;
  debts: Record<string, PersonBalance>;
}

interface ProfileStats {
  trips: number;
  friends: number;
  expensesAdded: number;
  topCategory: string | null;
  byCurrency: CurrencyStats[];
  entries: ShareEntry[];
}

interface StatisticsPageProps {
  userId: string;
}

async function loadRaw(userId: string): Promise<RawStats> {
  const trips = await fetchUserTrips(userId);
  const people = new Set<string>();
  const debts: Record<string, PersonBalance> = {};

  const raw = await Promise.all(
    trips.map(async (trip): Promise<RawTrip> => {
      const [expenses, settlements] = await Promise.all([
        fetchExpenses(trip.id),
        fetchSettlements(trip.id),
      ]);
      const memberIds = Object.keys(trip.members ?? {});
      memberIds.filter((id) => id !== userId).forEach((id) => people.add(id));

      const balances = computeBalances(memberIds, expenses, settlements);
      const names: Record<string, string> = {};
      Object.values(trip.members ?? {}).forEach((m) => (names[m.id] = m.fullname));
      addDebts(debts, userId, trip.currency, names, simplifyDebts(balances));

      return {
        id: trip.id,
        name: trip.name,
        currency: trip.currency,
        expenses,
        net: balances.find((b) => b.memberId === userId)?.net ?? 0,
      };
    }),
  );

  return { trips: raw, friends: people.size, debts };
}

/** Turns the loaded trips into the numbers shown, for one date range. */
function computeStats(raw: RawStats, userId: string, range: StatsRange): ProfileStats {
  const start = rangeStart(range, new Date());
  const categories: Record<string, number> = {};
  const money: Record<string, CurrencyStats> = {};
  const perCategory: Record<string, Record<string, { amount: number; count: number }>> = {};
  const entries: ShareEntry[] = [];
  let expensesAdded = 0;

  raw.trips.forEach((trip) => {
    const entry = (money[trip.currency] ??= {
      currency: trip.currency,
      paid: 0,
      share: 0,
      net: 0,
      categories: [],
    });
    entry.net += trip.net;

    trip.expenses.forEach((expense) => {
      if (start && expense.spentOn < start) return;
      const share = expense.shares?.[userId] ?? 0;
      entry.paid += expense.paidBy?.[userId] ?? 0;
      entry.share += share;
      if (share > 0) {
        const bucket = (perCategory[trip.currency] ??= {});
        const key = expense.category || 'other';
        const row = (bucket[key] ??= { amount: 0, count: 0 });
        row.amount += share;
        row.count += 1;
        entries.push({
          tripId: trip.id,
          tripName: trip.name,
          currency: trip.currency,
          title: expense.title,
          spentOn: expense.spentOn,
          amount: expense.amount,
          share,
        });
      }
      if (expense.createdBy !== userId) return;
      expensesAdded += 1;
      categories[expense.category] = (categories[expense.category] ?? 0) + 1;
    });
  });

  const top = Object.entries(categories).sort((a, b) => b[1] - a[1])[0];

  return {
    trips: raw.trips.length,
    friends: raw.friends,
    expensesAdded,
    topCategory: top ? top[0] : null,
    entries,
    byCurrency: Object.values(money)
      .filter((entry) => entry.share > 0 || entry.paid > 0 || Math.abs(entry.net) >= 0.01)
      .map((entry) => ({
        ...entry,
        categories: Object.entries(perCategory[entry.currency] ?? {})
          .map(([category, row]) => ({ category, ...row }))
          .sort((a, b) => b.amount - a.amount),
      })),
  };
}

/** A slide-up sheet with a summary of the signed-in user's trips and money. */
export default function StatisticsPage({ userId }: StatisticsPageProps) {
  const router = useRouter();
  const [raw, setRaw] = useState<RawStats | null>(null);
  const [range, setRange] = useState<StatsRange>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!userId) return;
    let active = true;
    setLoading(true);
    setError('');
    loadRaw(userId)
      .then((result) => active && setRaw(result))
      .catch((err) => {
        console.error('Failed to load statistics:', err);
        if (active) setError('Could not load your statistics. Please try again.');
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [userId]);

  const stats = useMemo(
    () => (raw ? computeStats(raw, userId, range) : null),
    [raw, userId, range],
  );
  const now = new Date();
  const current = stats ? mainCurrency(stats.entries) : '';
  const trend = stats ? monthlyTrend(stats.entries, current, now) : [];
  const change = monthChange(trend);
  const habits = stats ? spendingHabits(stats.entries, current) : null;
  const biggest = stats ? biggestExpense(stats.entries, current) : null;
  const tripRows = stats ? tripComparison(stats.entries).slice(0, 5) : [];
  const owedToMe = raw ? topBalances(raw.debts, true) : [];
  const iOwe = raw ? topBalances(raw.debts, false) : [];

  const top = stats?.topCategory ? categoryLook(stats.topCategory) : null;
  const TopIcon = top?.icon;

  return (
    <>
      <View style={styles.header}>
        <View style={styles.backWrapper}>
          <BackButton onPress={() => router.back()} />
        </View>
        <Text style={styles.headerTitle}>Statistics</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          {loading && !raw ? (
            <ListSkeleton rows={4} rowHeight={72} />
          ) : error ? (
            <ErrorState message={error} />
          ) : stats ? (
            <>
              <View style={styles.rangeRow}>
                {(Object.keys(RANGE_LABEL) as StatsRange[]).map((key) => (
                  <Pressable
                    key={key}
                    style={[styles.rangeChip, range === key && styles.rangeChipOn]}
                    onPress={() => setRange(key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: range === key }}
                  >
                    <Text style={[styles.rangeText, range === key && styles.rangeTextOn]}>
                      {RANGE_LABEL[key]}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.grid}>
                <Tile label="Trips" value={String(stats.trips)} />
                <Tile label="Travel buddies" value={String(stats.friends)} />
                <Tile label="Expenses added" value={String(stats.expensesAdded)} />
                <View style={styles.tile}>
                  <Text style={styles.tileLabel}>Top category</Text>
                  {top && TopIcon ? (
                    <View style={styles.topRow}>
                      <View style={[styles.topIcon, { backgroundColor: top.bg }]}>
                        <TopIcon size={16} color={top.tint} />
                      </View>
                      <Text style={styles.tileValueSmall}>{categoryLabel(stats.topCategory!)}</Text>
                    </View>
                  ) : (
                    <Text style={styles.tileValueSmall}>—</Text>
                  )}
                </View>
              </View>

              {stats.byCurrency.length === 0 ? (
                <Text style={styles.empty}>
                  {range === 'all'
                    ? 'Add an expense to see your spending here.'
                    : 'No spending in this period.'}
                </Text>
              ) : (
                stats.byCurrency.map((entry) => (
                  <View key={entry.currency} style={styles.moneyCard}>
                    <Text style={styles.currency}>{entry.currency}</Text>
                    <Row label="You paid" value={formatMoney(entry.paid, entry.currency)} />
                    <Row label="Your share" value={formatMoney(entry.share, entry.currency)} />
                    <Row
                      label={entry.net >= 0 ? 'Others owe you' : 'You owe'}
                      value={formatMoney(Math.abs(entry.net), entry.currency)}
                      color={entry.net >= 0 ? BrandColors.success : BrandColors.error}
                    />
                    {entry.categories.length > 0 && (
                      <View style={styles.catBlock}>
                        <Text style={styles.currency}>Your spending by category</Text>
                        {entry.categories.map((row) => {
                          const look = categoryLook(row.category);
                          const Icon = look.icon;
                          const max = entry.categories[0].amount || 1;
                          return (
                            <View key={row.category} style={styles.catRow}>
                              <View style={[styles.topIcon, { backgroundColor: look.bg }]}>
                                <Icon size={16} color={look.tint} />
                              </View>
                              <View style={styles.catInfo}>
                                <View style={styles.row}>
                                  <Text style={styles.rowLabel}>
                                    {categoryLabel(row.category)} · {row.count}
                                  </Text>
                                  <Text style={styles.rowValue}>
                                    {formatMoney(row.amount, entry.currency)}
                                  </Text>
                                </View>
                                <View style={styles.barTrack}>
                                  <View
                                    style={[
                                      styles.barFill,
                                      {
                                        width: `${Math.max(4, (row.amount / max) * 100)}%`,
                                        backgroundColor: look.tint,
                                      },
                                    ]}
                                  />
                                </View>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                ))
              )}

              {!!current && trend.some((p) => p.total > 0) && (
                <View style={styles.moneyCard}>
                  <View style={styles.row}>
                    <Text style={styles.currency}>Last 6 months · {current}</Text>
                    {change !== null && (
                      <Text
                        style={[
                          styles.rowValue,
                          { color: change > 0 ? BrandColors.error : BrandColors.success },
                        ]}
                      >
                        {change > 0 ? '▲' : '▼'} {Math.round(Math.abs(change) * 100)}% vs last month
                      </Text>
                    )}
                  </View>
                  <View style={styles.chart}>
                    {trend.map((point) => {
                      const max = Math.max(...trend.map((p) => p.total), 1);
                      return (
                        <View key={point.key} style={styles.chartCol}>
                          <View style={styles.chartBarArea}>
                            <View
                              style={[
                                styles.chartBar,
                                {
                                  height: Math.max(
                                    point.total > 0 ? 4 : 0,
                                    (point.total / max) * 72,
                                  ),
                                },
                              ]}
                            />
                          </View>
                          <Text style={styles.chartLabel}>{point.label}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}

              {!!habits && (
                <View style={styles.moneyCard}>
                  <Text style={styles.currency}>Spending habits · {current}</Text>
                  <Row
                    label="Average per expense"
                    value={formatMoney(habits.averagePerExpense, current)}
                  />
                  <Row
                    label="Average per active day"
                    value={formatMoney(habits.averagePerDay, current)}
                  />
                  <Row label="Busiest weekday" value={habits.busiestWeekday} />
                  <Row
                    label={'Priciest day (' + habits.priciestDay.date + ')'}
                    value={formatMoney(habits.priciestDay.total, current)}
                  />
                </View>
              )}

              {!!biggest && (
                <View style={styles.moneyCard}>
                  <Text style={styles.currency}>Biggest expense</Text>
                  <View style={styles.row}>
                    <Text style={styles.rowLabel} numberOfLines={1}>
                      {biggest.title}
                    </Text>
                    <Text style={styles.rowValue}>
                      {formatMoney(biggest.amount, biggest.currency)}
                    </Text>
                  </View>
                  <Text style={styles.sub}>
                    {biggest.tripName} · {biggest.spentOn} · your share{' '}
                    {formatMoney(biggest.share, biggest.currency)}
                  </Text>
                </View>
              )}

              {tripRows.length > 1 && (
                <View style={styles.moneyCard}>
                  <Text style={styles.currency}>Spending by trip</Text>
                  {tripRows.map((row) => {
                    const max = Math.max(
                      ...tripRows.filter((r) => r.currency === row.currency).map((r) => r.share),
                      1,
                    );
                    return (
                      <View key={row.tripId} style={styles.catInfo}>
                        <View style={styles.row}>
                          <Text style={styles.rowLabel} numberOfLines={1}>
                            {row.tripName}
                          </Text>
                          <Text style={styles.rowValue}>
                            {formatMoney(row.share, row.currency)}
                          </Text>
                        </View>
                        <View style={styles.barTrack}>
                          <View
                            style={[
                              styles.barFill,
                              {
                                width: `${Math.max(4, (row.share / max) * 100)}%`,
                                backgroundColor: BrandColors.base50,
                              },
                            ]}
                          />
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {(owedToMe.length > 0 || iOwe.length > 0) && (
                <View style={styles.moneyCard}>
                  {owedToMe.length > 0 && <Text style={styles.currency}>Owes you the most</Text>}
                  {owedToMe.map((row) => (
                    <Row
                      key={row.id + row.currency}
                      label={row.name}
                      value={formatMoney(row.amount, row.currency)}
                      color={BrandColors.success}
                    />
                  ))}
                  {iOwe.length > 0 && <Text style={styles.currency}>You owe the most</Text>}
                  {iOwe.map((row) => (
                    <Row
                      key={row.id + row.currency}
                      label={row.name}
                      value={formatMoney(Math.abs(row.amount), row.currency)}
                      color={BrandColors.error}
                    />
                  ))}
                </View>
              )}
            </>
          ) : null}
        </View>
      </ScrollView>

      <NavBar />
    </>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue}>{value}</Text>
    </View>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    backgroundColor: BrandColors.background,
    paddingBottom: 140,
  },
  container: {
    flex: 1,
    backgroundColor: BrandColors.background,
    paddingTop: Spacing.two,
    paddingHorizontal: 25,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  header: {
    paddingTop: 40,
    paddingHorizontal: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backWrapper: {
    position: 'absolute',
    left: 15,
    top: 34,
    zIndex: 1,
  },
  headerTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 20,
    color: BrandColors.primary,
  },
  rangeRow: { flexDirection: 'row', gap: Spacing.two },
  rangeChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BrandColors.border,
    backgroundColor: BrandColors.background,
  },
  rangeChipOn: { backgroundColor: BrandColors.base400, borderColor: BrandColors.base400 },
  rangeText: { fontFamily: 'PlusJakartaSans-Medium', fontSize: 12, color: BrandColors.secondary },
  rangeTextOn: { color: BrandColors.primary },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two },
  chartCol: { flex: 1, alignItems: 'center', gap: 4 },
  chartBarArea: { height: 72, justifyContent: 'flex-end', width: '100%', alignItems: 'center' },
  chartBar: { width: '70%', borderRadius: 4, backgroundColor: BrandColors.base50 },
  chartLabel: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 11, color: BrandColors.secondary },
  sub: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 12, color: BrandColors.secondary },
  catBlock: { gap: Spacing.two, marginTop: Spacing.two },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  catInfo: { flex: 1, gap: 4 },
  barTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: BrandColors.border,
    overflow: 'hidden',
  },
  barFill: { height: 6, borderRadius: 3 },
  center: { paddingVertical: Spacing.six, alignItems: 'center' },
  content: { gap: Spacing.three, paddingBottom: Spacing.four },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  tile: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: BrandColors.surfaceAlt,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 15,
    padding: Spacing.three,
    gap: 4,
  },
  tileLabel: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 12, color: BrandColors.secondary },
  tileValue: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 24, color: BrandColors.primary },
  tileValueSmall: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 16, color: BrandColors.primary },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  topIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moneyCard: {
    backgroundColor: BrandColors.surfaceAlt,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 15,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  currency: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 13, color: BrandColors.secondary },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 14, color: BrandColors.primary },
  rowValue: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: BrandColors.primary },
  empty: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    color: BrandColors.secondary,
    textAlign: 'center',
  },
  error: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    color: BrandColors.error,
    textAlign: 'center',
    paddingVertical: Spacing.four,
  },
});
