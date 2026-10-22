import Avatar from '@/components/ui/avatar';
import BackButton from '@/components/Button/back-button';
import PaymentsList from '@/components/trip/payments-list';
import SettleSheet from '@/components/trip/settle-sheet';
import EmptyState from '@/components/ui/empty-state';
import ErrorState from '@/components/ui/error-state';
import ListSkeleton from '@/components/ui/list-skeleton';
import { BrandColors, MaxContentWidth, Spacing } from '@/constants/theme';
import { fetchExpenses } from '@/services/Firebase/expenseService';
import { fetchSettlements, respondToSettlement } from '@/services/Firebase/settlementService';
import { fetchTrip } from '@/services/Firebase/tripService';
import { useAuth } from '@/services/Firebase/useAuth';
import { Trip, TripMember } from '@/types/trips';
import { computeTripTotals, simplifyDebts } from '@/utils/balance';
import { formatMoney } from '@/utils/money';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowUpDown, Scale, Wallet } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const SORTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'highest', label: 'Highest' },
  { value: 'lowest', label: 'Lowest' },
] as const;

type Payment = Awaited<ReturnType<typeof fetchSettlements>>[number];

/** Every payment recorded on one trip; the Balances tab shows only the newest few. */
export default function AllPaymentsScreen() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { currentUser } = useAuth();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Awaited<ReturnType<typeof fetchExpenses>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Payment | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sort, setSort] = useState<(typeof SORTS)[number]['value']>('newest');
  const [payerId, setPayerId] = useState<string | null>(null);
  const loadedOnce = useRef(false);

  const load = useCallback(async () => {
    if (!tripId) {
      setError('This trip could not be found.');
      setLoading(false);
      loadedOnce.current = true;
      return;
    }

    try {
      setError('');
      const [tripData, paymentData, expenseData] = await Promise.all([
        fetchTrip(tripId),
        fetchSettlements(tripId),
        fetchExpenses(tripId),
      ]);
      setExpenses(expenseData);
      if (tripData) setTrip(tripData);
      setPayments(paymentData);
    } catch (err) {
      console.error('Failed to load payments:', err);
      setError('Could not load these payments.');
    } finally {
      loadedOnce.current = true;
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    if (!loadedOnce.current) setLoading(true);
    load();
  }, [load]);

  const members: TripMember[] = useMemo(() => Object.values(trip?.members ?? {}), [trip]);
  const edges = useMemo(() => {
    const ids = members.map((member) => member.id);
    const { balances } = computeTripTotals(ids, expenses, payments);
    return simplifyDebts(balances.filter((balance) => ids.includes(balance.memberId)));
  }, [members, expenses, payments]);
  const currentUserId = currentUser?.uid ?? '';
  const currency = trip?.currency || 'PHP';
  const visible = useMemo(() => {
    const list = payerId ? payments.filter((payment) => payment.from === payerId) : [...payments];
    const when = (payment: Payment) => `${payment.settledOn}|${payment.createdAt}`;
    return list.sort((a, b) => {
      if (sort === 'highest') return b.amount - a.amount;
      if (sort === 'lowest') return a.amount - b.amount;
      return sort === 'oldest' ? when(a).localeCompare(when(b)) : when(b).localeCompare(when(a));
    });
  }, [payments, payerId, sort]);
  const payers = members.filter((member) => payments.some((payment) => payment.from === member.id));
  const counted = visible.filter(
    (payment) => payment.status !== 'pending' && payment.status !== 'declined',
  );
  const total = counted.reduce((sum, payment) => sum + (payment.amount || 0), 0);

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <View style={styles.backWrapper}>
          <BackButton onPress={() => router.back()} />
        </View>
        <Text style={styles.headerTitle}>All payments</Text>
        {!!trip && (
          <Text style={styles.headerSub} numberOfLines={1}>
            {trip.name} · {visible.length} {visible.length === 1 ? 'payment' : 'payments'} ·{' '}
            {formatMoney(total, currency)}
          </Text>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          {loading ? (
            <ListSkeleton rows={5} rowHeight={72} />
          ) : error ? (
            <ErrorState message={error} onRetry={load} />
          ) : payments.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No payments yet"
              message="Payments recorded on the Balances tab show up here."
            />
          ) : (
            <>
              <View style={styles.controls}>
                {payers.length > 1 && (
                  <ScrollView
                    style={styles.chips}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipRow}
                  >
                    {payers.map((member) => {
                      const on = member.id === payerId;
                      return (
                        <Pressable
                          key={member.id}
                          style={[styles.chip, on && styles.chipOn]}
                          onPress={() => setPayerId(on ? null : member.id)}
                          accessibilityRole="button"
                          accessibilityState={{ selected: on }}
                          accessibilityLabel={`Payments by ${member.fullname}`}
                        >
                          <Avatar name={member.fullname} size={34} photoURL={member.photoURL} />
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                )}
                <Pressable
                  style={styles.sortButton}
                  hitSlop={8}
                  onPress={() => {
                    const at = SORTS.findIndex((option) => option.value === sort);
                    setSort(SORTS[(at + 1) % SORTS.length].value);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Change sort order"
                >
                  <ArrowUpDown size={14} color={BrandColors.secondary} />
                  <Text style={styles.sortText}>{SORTS.find((o) => o.value === sort)?.label}</Text>
                </Pressable>
              </View>
              <PaymentsList
                settlements={visible}
                members={members}
                currency={currency}
                currentUserId={currentUserId}
                onEditSettlement={(payment) => {
                  setEditing(payment);
                  setSheetOpen(true);
                }}
                onRespond={async (payment, accept) => {
                  try {
                    const result = await respondToSettlement(
                      tripId as string,
                      payment.id,
                      currentUserId,
                      accept,
                    );
                    setPayments((previous) =>
                      previous.map((item) =>
                        item.id === payment.id ? { ...item, ...result } : item,
                      ),
                    );
                  } catch (err) {
                    console.error('Could not answer the payment:', err);
                  }
                }}
              />
            </>
          )}
        </View>
      </ScrollView>

      {!!trip && !loading && !error && (
        <Pressable
          style={styles.fab}
          onPress={() => {
            setEditing(null);
            setSheetOpen(true);
          }}
          accessibilityRole="button"
          accessibilityLabel="Settle up"
        >
          <Scale size={22} color={BrandColors.primary} />
        </Pressable>
      )}

      {!!trip && (
        <SettleSheet
          visible={sheetOpen}
          onClose={() => setSheetOpen(false)}
          tripId={tripId as string}
          currency={currency}
          members={members}
          edges={edges}
          currentUserId={currentUserId}
          settlement={editing}
          onSaved={(saved) =>
            setPayments((previous) =>
              previous.some((item) => item.id === saved.id)
                ? previous.map((item) => (item.id === saved.id ? saved : item))
                : [saved, ...previous],
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: BrandColors.background,
  },
  header: {
    paddingTop: 40,
    paddingHorizontal: 25,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
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
  headerSub: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: BrandColors.secondary,
  },
  scrollContent: {
    paddingBottom: 140,
  },
  container: {
    paddingTop: Spacing.four,
    paddingHorizontal: 25,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  chips: {
    flex: 1,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginLeft: 'auto',
  },
  sortText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: BrandColors.secondary,
  },
  chipRow: {
    gap: Spacing.two,
  },
  chip: {
    padding: 3,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'transparent',
    opacity: 0.55,
  },
  chipOn: {
    borderColor: BrandColors.primary,
    opacity: 1,
  },
  fab: {
    position: 'absolute',
    right: 22,
    bottom: 30,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: BrandColors.base50,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  footNote: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    lineHeight: 16,
    color: BrandColors.secondary,
    textAlign: 'center',
  },
});
