import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchUserTrips } from '@/services/Firebase/tripService';
import { subscribeToDataRefresh } from '@/services/offline/offlineStore';
import { Trip } from '@/types/trips';
import { todayKey } from '@/utils/money';
import { tripIsOver } from '@/utils/tripList';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Which trip the dashboard is looking at.
 *
 * Two rules, in order:
 *   1. The trip the person last picked, remembered on the device.
 *   2. Otherwise the newest trip that is not finished yet.
 *
 * The remembered id is checked against the real list every time, so leaving or
 * deleting a trip quietly falls back to the newest one that is left.
 *
 * A trip whose dates have passed stops being the active one, because the
 * dashboard is about money you are still splitting. Nothing is archived or
 * deleted: a finished trip keeps its page, its expenses and its balances, it
 * just stops being the trip the dashboard opens by itself.
 */

const STORAGE_KEY = 'tripsplit:active-trip-id';

export interface ActiveTripState {
  trips: Trip[];
  activeTrip: Trip | null;
  /** True when the dashboard's trip ended on a past date. */
  activeTripIsOver: boolean;
  loading: boolean;
  error: string;
  selectTrip: (tripId: string) => void;
  reload: () => void;
}

export function useActiveTrip(userId?: string): ActiveTripState {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [activeId, setActiveId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Tracks whether a list has ever arrived, so coming back to a screen that
  // already has data does not blank it out and show a spinner again.
  const loadedOnce = useRef(false);

  const load = useCallback(async () => {
    if (!userId) {
      setTrips([]);
      setActiveId('');
      setLoading(false);
      loadedOnce.current = true;
      return;
    }

    try {
      setError('');
      const [list, storedId] = await Promise.all([
        fetchUserTrips(userId),
        // A missing or unreadable value is not worth failing the whole load.
        AsyncStorage.getItem(STORAGE_KEY).catch(() => null),
      ]);

      setTrips(list);

      // fetchUserTrips already sorts newest first, so the first trip that is
      // not finished is the default. A list of nothing but finished trips
      // still shows its newest, rather than leaving the dashboard empty.
      const today = todayKey();
      const openTrips = list.filter((trip) => !tripIsOver(trip, today));
      const fallback = openTrips[0] ?? list[0];
      const remembered = storedId && list.some((trip) => trip.id === storedId) ? storedId : '';
      setActiveId(remembered || fallback?.id || '');
    } catch (err) {
      console.error('Failed to load your trips:', err);
      setError('Could not load your trips. Try again in a moment.');
    } finally {
      loadedOnce.current = true;
      setLoading(false);
    }
  }, [userId]);

  // Reload on focus, so a trip created or left elsewhere shows up straight away.
  // The spinner is for the very first load only: after that the saved copy
  // answers at once, so blanking the screen would only be a flicker.
  useFocusEffect(
    useCallback(() => {
      if (!loadedOnce.current) setLoading(true);
      load();
    }, [load]),
  );

  // Data refreshed in the background reaches the screen without a spinner.
  useEffect(() => {
    if (!userId) return;
    return subscribeToDataRefresh((path) => {
      if (path === `userTrips/${userId}` || path.startsWith('trips/')) {
        load();
      }
    });
  }, [userId, load]);

  const selectTrip = useCallback((tripId: string) => {
    setActiveId(tripId);
    // Remembering it is a nicety: if storage is unavailable, the newest trip
    // is simply used next time.
    AsyncStorage.setItem(STORAGE_KEY, tripId).catch((err) =>
      console.warn('Could not remember the active trip:', err),
    );
  }, []);

  const activeTrip = useMemo(
    () => trips.find((trip) => trip.id === activeId) ?? trips[0] ?? null,
    [trips, activeId],
  );

  /** True when the trip on the dashboard has finished. */
  const activeTripIsOver = useMemo(
    () => (activeTrip ? tripIsOver(activeTrip, todayKey()) : false),
    [activeTrip],
  );

  return { trips, activeTrip, activeTripIsOver, loading, error, selectTrip, reload: load };
}
