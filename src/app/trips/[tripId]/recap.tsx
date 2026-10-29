import BackButton from '@/components/Button/back-button';
import ErrorState from '@/components/ui/error-state';
import ListSkeleton from '@/components/ui/list-skeleton';
import TripRecap from '@/components/trip/trip-recap';
import { BrandColors, MaxContentWidth, Spacing } from '@/constants/theme';
import { fetchExpenses } from '@/services/Firebase/expenseService';
import { fetchItinerary } from '@/services/Firebase/itineraryService';
import { fetchSettlements } from '@/services/Firebase/settlementService';
import { fetchTrip } from '@/services/Firebase/tripService';
import { Expense, ItineraryItem, Settlement } from '@/types/expenses';
import { Trip, TripMember } from '@/types/trips';
import { shortName } from '@/utils/format';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, RefreshControl, StyleSheet, Text, View } from 'react-native';

/**
 * The story of a finished trip, on a page of its own.
 *
 * Kept separate from the trip screen so it can be opened from a link and read
 * top to bottom, instead of sitting buried under the expense list.
 */
export default function TripRecapScreen() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [itinerary, setItinerary] = useState<ItineraryItem[]>([]);
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
      const [tripData, expenseData, settlementData, planData] = await Promise.all([
        fetchTrip(tripId),
        fetchExpenses(tripId),
        fetchSettlements(tripId),
        fetchItinerary(tripId),
      ]);
      if (tripData) setTrip(tripData);
      setExpenses(expenseData);
      setSettlements(settlementData);
      setItinerary(planData);
    } catch (err) {
      console.error('Failed to load the recap:', err);
      setError('Could not load this trip recap.');
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
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
  const currency = trip?.currency || 'PHP';

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <View style={styles.backWrapper}>
          <BackButton onPress={() => router.back()} />
        </View>
        <Text style={styles.headerTitle}>Trip recap</Text>
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
            <ListSkeleton rows={4} rowHeight={90} />
          ) : error ? (
            <ErrorState message={error} onRetry={load} />
          ) : trip ? (
            <TripRecap
              trip={trip}
              members={members}
              expenses={expenses}
              settlements={settlements}
              itinerary={itinerary}
              currency={currency}
            />
          ) : null}
        </View>
      </ScrollView>
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
    paddingBottom: 60,
  },
  container: {
    paddingTop: Spacing.four,
    paddingHorizontal: 25,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
});
