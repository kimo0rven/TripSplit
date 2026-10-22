import { Card, SectionTitle } from '@/components/ui/card';
import { BrandColors, Spacing } from '@/constants/theme';
import {
  EVERY_LABEL,
  fetchRecurring,
  stopRecurring,
} from '@/services/Firebase/recurringService';
import { RecurringExpense } from '@/types/expenses';
import { formatDay, formatMoney } from '@/utils/money';
import { Repeat } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface RecurringListProps {
  tripId: string;
  currency: string;
  currentUserId: string;
  isOwner: boolean;
  /** Changes when expenses change, so a freshly added schedule shows up. */
  reloadKey: number;
}

/** The expenses that repeat by themselves, with a way to stop each one. */
export default function RecurringList({
  tripId,
  currency,
  currentUserId,
  isOwner,
  reloadKey,
}: RecurringListProps) {
  const [items, setItems] = useState<RecurringExpense[]>([]);
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    try {
      const list = await fetchRecurring(tripId);
      setItems(list.filter((item) => item.active));
    } catch (error) {
      console.error('Failed to load recurring expenses:', error);
    }
  }, [tripId]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const stop = async (id: string) => {
    setBusyId(id);
    try {
      await stopRecurring(tripId, id);
      await load();
    } catch (error) {
      console.error('Failed to stop a recurring expense:', error);
    } finally {
      setBusyId('');
    }
  };

  if (items.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <SectionTitle>Repeating expenses</SectionTitle>
      {items.map((item) => (
        <Card key={item.id} style={styles.card}>
          <View style={styles.icon}>
            <Repeat size={18} color={BrandColors.primary} />
          </View>
          <View style={styles.info}>
            <Text style={styles.title} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.meta}>
              {formatMoney(item.amount, currency)} · {EVERY_LABEL[item.every]} · next{' '}
              {formatDay(item.nextDue)}
            </Text>
          </View>
          {(item.createdBy === currentUserId || isOwner) && (
            <Pressable
              onPress={() => stop(item.id)}
              disabled={busyId === item.id}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={'Stop repeating ' + item.title}
            >
              <Text style={styles.stop}>{busyId === item.id ? 'Stopping…' : 'Stop'}</Text>
            </Pressable>
          )}
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BrandColors.base50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1, gap: 2 },
  title: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: BrandColors.primary },
  meta: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 12, color: BrandColors.secondary },
  stop: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 13, color: BrandColors.error },
});
