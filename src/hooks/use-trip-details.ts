import { fetchExpenses } from '@/services/Firebase/expenseService';
import { fetchSettlements } from '@/services/Firebase/settlementService';
import { fetchTrip } from '@/services/Firebase/tripService';
import { subscribeToDataRefresh } from '@/services/offline/offlineStore';
import { Expense, Settlement } from '@/types/expenses';
import { Trip } from '@/types/trips';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

/**
 * The three things a trip screen needs: the trip itself (for its members and
 * currency), its expenses and its settlements.
 *
 * The dashboard and the trip screen ask for the same data, so it lives here
 * instead of being copied into both.
 */
export interface TripDetails {
  trip: Trip | null;
  expenses: Expense[];
  settlements: Settlement[];
  loading: boolean;
  error: string;
  reload: () => void;
  setExpenses: Dispatch<SetStateAction<Expense[]>>;
  setSettlements: Dispatch<SetStateAction<Settlement[]>>;
}

export function useTripDetails(tripId: string): TripDetails {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // See useActiveTrip: the spinner belongs to the first load only.
  const loadedOnce = useRef(false);

  // Switching to a different trip is a real new load: what is on screen belongs
  // to the trip we just left, so it must not be shown as if it were this one.
  const lastTripId = useRef(tripId);
  if (lastTripId.current !== tripId) {
    lastTripId.current = tripId;
    loadedOnce.current = false;
  }

  const load = useCallback(async () => {
    if (!tripId) {
      setTrip(null);
      setExpenses([]);
      setSettlements([]);
      setLoading(false);
      loadedOnce.current = true;
      return;
    }

    try {
      setError('');
      const [tripData, expenseData, settlementData] = await Promise.all([
        fetchTrip(tripId),
        fetchExpenses(tripId),
        fetchSettlements(tripId),
      ]);

      setTrip(tripData ?? null);
      setExpenses(expenseData);
      setSettlements(settlementData);

      if (!tripData) {
        setError('This trip could not be found.');
      }
    } catch (err) {
      console.error('Failed to load trip details:', err);
      setError('Could not load this trip.');
    } finally {
      loadedOnce.current = true;
      setLoading(false);
    }
  }, [tripId]);

  useFocusEffect(
    useCallback(() => {
      if (!loadedOnce.current) setLoading(true);
      load();
    }, [load]),
  );

  // A change made in the background lands here on its own, with no spinner.
  useEffect(() => {
    if (!tripId) return;
    return subscribeToDataRefresh((path) => {
      if (path === `trips/${tripId}` || path.startsWith(`trips/${tripId}/`)) {
        load();
      }
    });
  }, [tripId, load]);

  return { trip, expenses, settlements, loading, error, reload: load, setExpenses, setSettlements };
}
