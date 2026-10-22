import { categoryLook } from '@/constants/expense-categories';
import { BrandColors, Spacing } from '@/constants/theme';
import { fetchExpenses } from '@/services/Firebase/expenseService';
import { fetchSettlements } from '@/services/Firebase/settlementService';
import { fetchUserTrips } from '@/services/Firebase/tripService';
import { formatDay, formatMoney } from '@/utils/money';
import { useRouter } from 'expo-router';
import { HandCoins } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface Item {
  key: string;
  tripId: string;
  tripName: string;
  title: string;
  day: string;
  stamp: string;
  amount: string;
  category?: string;
}

/** The latest expenses and payments across every trip. */
export default function RecentActivity({ userId, refreshKey }: { userId: string; refreshKey: string }) {
  const router = useRouter();
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    (async () => {
      const trips = await fetchUserTrips(userId);
      const lists = await Promise.all(
        trips.map(async (trip) => {
          const [expenses, settlements] = await Promise.all([
            fetchExpenses(trip.id),
            fetchSettlements(trip.id),
          ]);
          const name = (id: string) => (trip.members?.[id]?.fullname ?? 'Someone').split(' ')[0];
          const out: Item[] = [];
          expenses.forEach((expense) =>
            out.push({
              key: `${trip.id}-e-${expense.id}`,
              tripId: trip.id,
              tripName: trip.name,
              title: expense.title,
              day: expense.spentOn,
              stamp: expense.createdAt ?? expense.spentOn,
              amount: formatMoney(expense.amount, trip.currency),
              category: expense.category,
            }),
          );
          settlements.forEach((settlement) =>
            out.push({
              key: `${trip.id}-s-${settlement.id}`,
              tripId: trip.id,
              tripName: trip.name,
              title: `${name(settlement.from)} paid ${name(settlement.to)}`,
              day: settlement.settledOn,
              stamp: settlement.createdAt ?? settlement.settledOn,
              amount: formatMoney(settlement.amount, trip.currency),
            }),
          );
          return out;
        }),
      );
      const all = lists.flat().sort((a, b) => (a.stamp < b.stamp ? 1 : -1)).slice(0, 5);
      if (active) setItems(all);
    })().catch((err) => console.error('Failed to load recent activity:', err));
    return () => {
      active = false;
    };
  }, [userId, refreshKey]);

  if (!items || items.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Recent activity</Text>
      {items.map((item) => {
        const look = item.category ? categoryLook(item.category) : null;
        return (
          <Pressable
            key={item.key}
            style={styles.row}
            onPress={() => router.push(`/trips/${item.tripId}` as any)}
          >
            <View style={[styles.icon, { backgroundColor: look?.bg ?? BrandColors.successBg }]}>
              {look ? (
                <look.icon size={16} color={look.tint} />
              ) : (
                <HandCoins size={16} color={BrandColors.success} />
              )}
            </View>
            <View style={styles.info}>
              <Text style={styles.name} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.meta} numberOfLines={1}>
                {formatDay(item.day)} · {item.tripName}
              </Text>
            </View>
            <Text style={styles.amount}>{item.amount}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  title: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 16, color: BrandColors.primary },
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
  icon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  name: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 13, color: BrandColors.primary },
  meta: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 11, color: BrandColors.secondary },
  amount: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 13, color: BrandColors.primary },
});
