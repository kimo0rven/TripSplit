import BackButton from '@/components/Button/back-button';
import Avatar from '@/components/ui/avatar';
import DayDivider from '@/components/ui/day-divider';
import EmptyState from '@/components/ui/empty-state';
import ErrorState from '@/components/ui/error-state';
import FilterChips from '@/components/ui/filter-chips';
import ListSkeleton from '@/components/ui/list-skeleton';
import { BrandColors, MaxContentWidth, Spacing } from '@/constants/theme';
import { fetchExpenses } from '@/services/Firebase/expenseService';
import { fetchItinerary } from '@/services/Firebase/itineraryService';
import { fetchSettlements } from '@/services/Firebase/settlementService';
import { fetchTrip } from '@/services/Firebase/tripService';
import {
  fetchTrash,
  restoreFromTrash,
  TRASH_DAYS,
  TrashEntry,
} from '@/services/Firebase/trashService';
import { Expense, ItineraryItem, Settlement } from '@/types/expenses';
import { Trip } from '@/types/trips';
import { ActivityKind, buildActivity } from '@/utils/activity';
import { shortName } from '@/utils/format';
import { groupByDay } from '@/utils/listGrouping';
import { dayHeading, formatMoney } from '@/utils/money';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  CalendarDays,
  History,
  Receipt,
  RotateCcw,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

const FILTERS = [
  { value: 'expense', label: 'Expenses', icon: Receipt },
  { value: 'payment', label: 'Payments', icon: Wallet },
  { value: 'plan', label: 'Plans', icon: CalendarDays },
  { value: 'member', label: 'Members', icon: Users },
];

/** The local calendar day of a time, as YYYY-MM-DD, for grouping. */
const dayOf = (iso: string) => {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

/**
 * Everything that happened in a trip, newest first: expenses added and
 * edited, payments recorded and answered, plans, and who joined.
 */
export default function TripActivityScreen() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [plans, setPlans] = useState<ItineraryItem[]>([]);
  const [trash, setTrash] = useState<TrashEntry[]>([]);
  const [restoringId, setRestoringId] = useState('');
  const [restoreMessage, setRestoreMessage] = useState('');
  const [filter, setFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!tripId) {
      setError('This trip could not be found.');
      setLoading(false);
      return;
    }
    try {
      setError('');
      const [tripData, expenseData, settlementData, planData, trashData] = await Promise.all([
        fetchTrip(tripId),
        fetchExpenses(tripId),
        fetchSettlements(tripId),
        fetchItinerary(tripId),
        fetchTrash(tripId),
      ]);
      setTrash(trashData);
      if (tripData) setTrip(tripData);
      setExpenses(expenseData);
      setSettlements(settlementData);
      setPlans(planData);
    } catch (err) {
      console.error('Failed to load the activity:', err);
      setError('Could not load this trip’s activity.');
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const members = useMemo(() => Object.values(trip?.members ?? {}), [trip]);
  const currency = trip?.currency || 'PHP';
  const nameOf = useCallback(
    (id: string) => members.find((member) => member.id === id)?.fullname ?? 'Someone who left',
    [members],
  );

  const activity = useMemo(
    () =>
      trip
        ? buildActivity({
            trip,
            members,
            expenses,
            settlements,
            plans,
            trash,
            closed: trip.closedAt ? { at: trip.closedAt, by: trip.closedBy ?? '' } : undefined,
            nameOf: (id) => nameOf(id).split(' ')[0],
            money: (value) => formatMoney(value, currency),
          })
        : [],
    [trip, members, expenses, settlements, plans, trash, nameOf, currency],
  );

  const shown =
    filter && filter !== 'all'
      ? activity.filter(
          (entry) =>
            entry.kind === (filter as ActivityKind) ||
            (filter === 'member' && entry.kind === 'trip'),
        )
      : activity;

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <View style={styles.backWrapper}>
          <BackButton onPress={() => router.back()} />
        </View>
        <Text style={styles.headerTitle}>Activity</Text>
        {!!trip && (
          <Text style={styles.headerSub} numberOfLines={1}>
            {shortName(trip.name)}
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
            <ListSkeleton rows={6} rowHeight={64} />
          ) : error ? (
            <ErrorState message={error} onRetry={load} />
          ) : (
            <>
              {trash.length > 0 && (
                <View style={styles.trash}>
                  <View style={styles.trashHeader}>
                    <Trash2 size={15} color={BrandColors.primary} />
                    <Text style={styles.trashTitle}>Recently deleted</Text>
                  </View>
                  <Text style={styles.detail}>
                    Kept for {TRASH_DAYS} days. Restoring puts it back exactly as it was.
                  </Text>
                  {trash.map((entry) => {
                    // Anyone in the trip can bring something back, unless the
                    // trip is closed.
                    const canRestore = !trip?.closedAt;
                    return (
                      <View key={entry.id} style={styles.trashRow}>
                        <View style={styles.text}>
                          <Text style={styles.line} numberOfLines={1}>
                            {entry.kind === 'plan' ? 'Plan: ' : ''}
                            {entry.item.title}
                            {'amount' in entry.item && entry.item.amount
                              ? ` · ${formatMoney(entry.item.amount, currency)}`
                              : ''}
                          </Text>
                          <Text style={styles.time}>
                            Deleted by {nameOf(entry.deletedBy).split(' ')[0]} ·{' '}
                            {dayHeading(dayOf(entry.deletedAt))}
                          </Text>
                        </View>
                        {canRestore && (
                          <Pressable
                            style={({ pressed }) => [styles.restore, pressed && { opacity: 0.7 }]}
                            onPress={async () => {
                              if (restoringId || !tripId) return;
                              setRestoringId(entry.id);
                              setRestoreMessage('');
                              try {
                                await restoreFromTrash(tripId, entry);
                                setRestoreMessage(`${entry.item.title} is back.`);
                                await load();
                              } catch (err: any) {
                                console.error('Failed to restore:', err);
                                setRestoreMessage(err?.message || 'Could not restore that.');
                              } finally {
                                setRestoringId('');
                              }
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={`Restore ${entry.item.title}`}
                          >
                            <RotateCcw size={13} color={BrandColors.primary} />
                            <Text style={styles.restoreText}>
                              {restoringId === entry.id ? 'Restoring…' : 'Restore'}
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    );
                  })}
                  {!!restoreMessage && <Text style={styles.detail}>{restoreMessage}</Text>}
                </View>
              )}

              <FilterChips options={FILTERS} value={filter} onChange={setFilter} />
              {shown.length === 0 ? (
                <EmptyState
                  icon={History}
                  title="Nothing here yet"
                  message="Expenses, payments, plans and new members show up here as they happen."
                />
              ) : (
                groupByDay(shown, (entry) => dayOf(entry.at)).map((group) => (
                  <View key={group.day} style={styles.day}>
                    <DayDivider label={dayHeading(group.day)} count={group.items.length} />
                    {group.items.map((entry) => (
                      <View key={entry.id} style={styles.row}>
                        <Avatar
                          name={nameOf(entry.by)}
                          size={32}
                          photoURL={members.find((member) => member.id === entry.by)?.photoURL}
                        />
                        <View style={styles.text}>
                          <Text style={styles.line}>
                            <Text style={styles.who}>{nameOf(entry.by).split(' ')[0]}</Text>{' '}
                            {entry.text}
                          </Text>
                          {entry.details?.map((detail) => (
                            <Text key={detail} style={styles.detail} numberOfLines={2}>
                              {detail}
                            </Text>
                          ))}
                          <Text style={styles.time}>{timeOf(entry.at)}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ))
              )}
              <Text style={styles.footnote}>
                Deleted expenses and plans are listed for {TRASH_DAYS} days, while they can be
                restored.
              </Text>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: BrandColors.background },
  header: {
    paddingTop: 40,
    paddingHorizontal: 25,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  backWrapper: { position: 'absolute', left: 15, top: 34, zIndex: 1 },
  headerTitle: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 20, color: BrandColors.primary },
  headerSub: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 12, color: BrandColors.secondary },
  scrollContent: { paddingBottom: Spacing.six },
  container: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: 25,
    paddingTop: Spacing.four,
    gap: Spacing.three,
  },
  day: { gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  text: { flex: 1, gap: 2 },
  line: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 14, color: BrandColors.primary },
  who: { fontFamily: 'PlusJakartaSans-Bold' },
  detail: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 12, color: BrandColors.secondary },
  time: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 11, color: BrandColors.secondary },
  trash: {
    gap: Spacing.two,
    backgroundColor: BrandColors.inputField,
    borderRadius: 15,
    padding: Spacing.three,
  },
  trashHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  trashTitle: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: BrandColors.primary },
  trashRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  restore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    backgroundColor: BrandColors.base50,
    borderRadius: 10,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  restoreText: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 12, color: BrandColors.primary },
  footnote: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    color: BrandColors.secondary,
    textAlign: 'center',
    marginTop: Spacing.two,
  },
});
