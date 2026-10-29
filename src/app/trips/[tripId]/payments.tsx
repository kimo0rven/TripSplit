import BackButton from '@/components/Button/back-button';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { shortName } from '@/utils/format';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowUpDown, Scale, Wallet } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

const SORTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'highest', label: 'Highest' },
  { value: 'lowest', label: 'Lowest' },
] as const;

/** Whose payments to show. One row of pills instead of a chip row per person. */
type Who = 'all' | 'sent' | 'received';

const WHO: { value: Who; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'sent', label: 'You paid' },
  { value: 'received', label: 'You received' },
];

/**
 * The chosen filter is remembered per trip, so stepping into a payment and
 * coming back - or reopening the page later - does not quietly reset it to All
 * and make a filtered list look like the full one again.
 */
const WHO_KEY = (tripId: string) => `tripsplit:payments-who:${tripId}`;

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
  const [who, setWho] = useState<Who>('all');
  const loadedOnce = useRef(false);

  // Pull to refresh keeps the spinner local, so the healed list stays on screen.
  const [refreshing, setRefreshing] = useState(false);

  // Bring back the filter this trip was last looked at with. A missing or
  // unreadable value just means All, so storage trouble costs nothing.
  useEffect(() => {
    if (!tripId) return;
    let live = true;
    AsyncStorage.getItem(WHO_KEY(tripId))
      .then((saved) => {
        if (live && (saved === 'all' || saved === 'sent' || saved === 'received')) setWho(saved);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [tripId]);

  const chooseWho = useCallback(
    (next: Who) => {
      setWho(next);
      if (tripId) {
        AsyncStorage.setItem(WHO_KEY(tripId), next).catch(() => undefined);
      }
    },
    [tripId],
  );

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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
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
    const list = payments.filter((payment) => {
      if (who === 'sent') return payment.from === currentUserId;
      if (who === 'received') return payment.to === currentUserId;
      return true;
    });
    const stamp = (payment: Payment) => `${payment.settledOn}|${payment.createdAt ?? ''}`;

    // The newest day always comes first, whatever the sort: the list is drawn in
    // day sections, so a plain amount sort would scatter one day's payments into
    // several sections. Within a day, the chosen sort decides.
    return list.sort((a, b) => {
      const dayA = a.settledOn || '';
      const dayB = b.settledOn || '';
      if (dayA !== dayB) {
        // Undated payments go last rather than above today's.
        if (!dayA) return 1;
        if (!dayB) return -1;
        return dayA < dayB ? 1 : -1;
      }
      if (sort === 'highest') return b.amount - a.amount;
      if (sort === 'lowest') return a.amount - b.amount;
      return sort === 'oldest'
        ? stamp(a).localeCompare(stamp(b))
        : stamp(b).localeCompare(stamp(a));
    });
  }, [payments, who, sort, currentUserId]);
  const filtering = who !== 'all';
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
            {shortName(trip.name)} · {visible.length}{' '}
            {visible.length === 1 ? 'payment' : 'payments'} · {formatMoney(total, currency)}
          </Text>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
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

              <View style={styles.filters}>
                {WHO.map((option) => (
                  <Pressable
                    key={option.value}
                    onPress={() => chooseWho(option.value)}
                    style={[styles.pill, who === option.value && styles.pillOn]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: who === option.value }}
                  >
                    <Text style={[styles.pillText, who === option.value && styles.pillTextOn]}>
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {visible.length === 0 ? (
                <EmptyState
                  icon={Wallet}
                  title="Nothing matches"
                  message="No payment fits this filter. Try showing all payments instead."
                  actionLabel="Clear filters"
                  onAction={() => chooseWho('all')}
                />
              ) : (
                <PaymentsList
                  grouped
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
              )}

              {filtering && (
                <Text style={styles.footNote}>
                  {visible.length} of {payments.length} payments shown.
                </Text>
              )}
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
  filters: {
    flexDirection: 'row',
    gap: Spacing.one,
    backgroundColor: BrandColors.surfaceAlt,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 20,
    padding: 3,
  },
  pill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 18,
  },
  pillOn: {
    backgroundColor: BrandColors.base50,
  },
  pillText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: BrandColors.secondary,
  },
  pillTextOn: {
    fontFamily: 'PlusJakartaSans-Bold',
    color: BrandColors.primary,
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
