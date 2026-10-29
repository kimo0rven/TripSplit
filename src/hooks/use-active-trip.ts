import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchUserTrips } from '@/services/Firebase/tripService';
import { subscribeToDataRefresh } from '@/services/offline/offlineStore';
import { Trip } from '@/types/trips';
import { todayKey } from '@/utils/money';
import { resolveActiveTripId } from '@/utils/tripList';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Which trip the dashboard is looking at.
 *
 * Two rules, in order:
 *   1. The trip the person last picked, remembered on the device.
 *   2. Otherwise the newest trip that is not finished yet.
 *
 * Whichever rule decides, the answer is written back to the device. Remembering
 * an automatic pick matters: without it the dashboard would re-pick the newest
 * trip on every load, so creating a trip would silently steal the dashboard
 * from the trip already being used.
 *
 * The remembered id is checked against the real list every time, so leaving or
 * deleting a trip quietly falls back to the newest one that is left.
 *
 * A trip whose dates have passed is never the active one, because the dashboard
 * is about money you are still splitting. Nothing is archived or deleted: a
 * finished trip keeps its page, its expenses and its balances, it just stops
 * being the trip the dashboard opens by itself. When every trip has finished,
 * there is no active trip at all and the card says so.
 *
 * Taking the trip off the dashboard is also allowed, with `clearTrip`. That is
 * a real answer and it is remembered: without it the dashboard would simply
 * re-pick the newest open trip on the next load, so a trip months away would
 * claim the dashboard again right after being dismissed. Picking a trip brings
 * one back.
 */

const STORAGE_KEY = 'tripsplit:active-trip-id';
/** Set when the person emptied the dashboard on purpose. */
const CLEARED_KEY = 'tripsplit:active-trip-cleared';

export interface ActiveTripState {
  trips: Trip[];
  activeTrip: Trip | null;
  loading: boolean;
  error: string;
  selectTrip: (tripId: string) => void;
  /** Takes the trip off the dashboard, leaving the dashboard empty. */
  clearTrip: () => void;
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
      const [list, storedId, clearedRaw] = await Promise.all([
        fetchUserTrips(userId),
        // A missing or unreadable value is not worth failing the whole load.
        AsyncStorage.getItem(STORAGE_KEY).catch(() => null),
        AsyncStorage.getItem(CLEARED_KEY).catch(() => null),
      ]);

      setTrips(list);

      // fetchUserTrips already sorts newest first, so the default is the newest
      // trip that is still open. A finished trip is never picked: the dashboard
      // is about money you are still splitting, so a list of nothing but
      // finished trips leaves no active trip and the card shows "No Trip".
      // A deliberate removal outranks both, so the dashboard stays empty until
      // a trip is picked again.
      const wasCleared = clearedRaw === '1';
      const chosen = resolveActiveTripId(list, storedId ?? '', todayKey(), wasCleared);
      setActiveId(chosen);

      /*
        Remembering the automatic pick is what keeps the dashboard where it is.
        Without it, every load re-picks the newest open trip, so simply creating
        a trip would quietly take the dashboard over from the one being used.
        Only writes when it actually changed, so a normal load writes nothing.
      */
      if (chosen && chosen !== storedId) {
        AsyncStorage.setItem(STORAGE_KEY, chosen).catch((err) =>
          console.warn('Could not remember the active trip:', err),
        );
      }
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
    // Picking a trip answers the question a removal asked, so the flag goes:
    // without this the next load would drop the trip straight off again.
    AsyncStorage.setItem(CLEARED_KEY, '0').catch(() => {});
    // Remembering it is a nicety: if storage is unavailable, the newest trip
    // is simply used next time.
    AsyncStorage.setItem(STORAGE_KEY, tripId).catch((err) =>
      console.warn('Could not remember the active trip:', err),
    );
  }, []);

  /**
   * Takes the trip off the dashboard.
   *
   * Nothing about the trip changes: it keeps its page, its expenses and its
   * balances, and it stays in the Trips list. Only the dashboard stops opening
   * it, which is what a trip still months away needs.
   */
  const clearTrip = useCallback(() => {
    setActiveId('');
    AsyncStorage.multiSet([
      [CLEARED_KEY, '1'],
      [STORAGE_KEY, ''],
    ]).catch((err) => console.warn('Could not clear the dashboard trip:', err));
  }, []);

  /* Falling back to `trips[0]` here would quietly hand the dashboard a finished
     trip whenever no open one was chosen, so a missing id means no trip. */
  const activeTrip = useMemo(
    () => (activeId ? (trips.find((trip) => trip.id === activeId) ?? null) : null),
    [trips, activeId],
  );

  return { trips, activeTrip, loading, error, selectTrip, clearTrip, reload: load };
}
