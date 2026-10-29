import { BrandColors, Spacing } from '@/constants/theme';
import { fetchSettlements } from '@/services/Firebase/settlementService';
import { fetchUserTrips } from '@/services/Firebase/tripService';
import { formatDay, formatMoney } from '@/utils/money';
import { shortName } from '@/utils/format';
import { useRouter } from 'expo-router';
import { HandCoins } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface Row {
  key: string;
  tripId: string;
  tripName: string;
  title: string;
  day: string;
  stamp: string;
  amount: string;
}

/** How many payments the dashboard lists before you have to go look. */
const LIMIT = 3;

/**
 * The latest payments across every trip.
 *
 * Expenses already have their own short list on the dashboard, so this covers
 * the other half of the money story - what changed hands - and stays at three
 * rows so the dashboard does not turn into a second payments page.
 */
export default function RecentActivity({
  userId,
  refreshKey,
  onViewAll,
}: {
  userId: string;
  refreshKey: string;
  /** Opens the page holding every payment. */
  onViewAll?: () => void;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    (async () => {
      const trips = await fetchUserTrips(userId);
      const lists = await Promise.all(
        trips.map(async (trip) => {
          const settlements = await fetchSettlements(trip.id);
          const name = (id: string) => (trip.members?.[id]?.fullname ?? 'Someone').split(' ')[0];

          return settlements.map<Row>((settlement) => ({
            key: `${trip.id}-s-${settlement.id}`,
            tripId: trip.id,
            tripName: trip.name,
            title: `${name(settlement.from)} paid ${name(settlement.to)}`,
            day: settlement.settledOn,
            stamp: settlement.createdAt ?? settlement.settledOn,
            amount: formatMoney(settlement.amount, trip.currency),
          }));
        }),
      );

      const newestFirst = (a: Row, b: Row) => (a.stamp < b.stamp ? 1 : -1);
      if (active) setRows(lists.flat().sort(newestFirst).slice(0, LIMIT));
    })().catch((err) => console.error('Failed to load recent payments:', err));
    return () => {
      active = false;
    };
  }, [userId, refreshKey]);

  if (!rows) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>Recent payments</Text>
        {!!onViewAll && (
          <Pressable onPress={onViewAll} hitSlop={8} accessibilityRole="link">
            <Text style={styles.viewAll}>View All</Text>
          </Pressable>
        )}
      </View>
      {/* The heading and its link stay even with nothing to show, so the
          payments page is always reachable from the dashboard. */}
      {rows.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            Nothing paid out yet. Settle up from a trip and it shows here.
          </Text>
        </View>
      )}
      {rows.map((item) => (
        <Pressable
          key={item.key}
          style={styles.row}
          onPress={() => router.push(`/trips/${item.tripId}` as any)}
          accessibilityRole="button"
          accessibilityLabel={`${item.title}, ${item.amount}, in ${item.tripName}`}
        >
          <View style={styles.icon}>
            <HandCoins size={16} color={BrandColors.success} />
          </View>
          <View style={styles.info}>
            <Text style={styles.name} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {formatDay(item.day)} · {shortName(item.tripName)}
            </Text>
          </View>
          <Text style={styles.amount}>{item.amount}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 14, color: BrandColors.primary },
  viewAll: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 13, color: BrandColors.info },
  empty: {
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: Spacing.three,
  },
  emptyText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 17,
    color: BrandColors.secondary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: BrandColors.background,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 14,
    padding: Spacing.three,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BrandColors.successBg,
  },
  info: { flex: 1 },
  name: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 13, color: BrandColors.primary },
  meta: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 11, color: BrandColors.secondary },
  amount: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 13, color: BrandColors.success },
});
