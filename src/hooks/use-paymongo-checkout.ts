import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRates } from '@/services/currency/rates';
import { createSettlement } from '@/services/Firebase/settlementService';
import {
  confirmPayMongo,
  fetchPayMongoSetup,
  payMongoConfigured,
  startPayMongoCheckout,
  type PayMongoResult,
  type PayMongoSetup,
} from '@/services/Firebase/paymongoService';
import type { Settlement } from '@/types/expenses';
import { todayKey } from '@/utils/money';
import {
  payMongoMethodsLine,
  payMongoProblem,
  readPendingCheckouts,
  returnResultFromUrl,
  returnUrlFor,
  type PendingCheckout,
} from '@/utils/paymongo';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';

/** Unfinished checkouts, one per trip, so they survive closing the app. */
const PENDING_KEY = 'tripsplit:paymongo-pending';

const loadAllPending = async () =>
  readPendingCheckouts(await AsyncStorage.getItem(PENDING_KEY).catch(() => null), Date.now());

const savePending = async (tripId: string, entry: PendingCheckout | null) => {
  const all = await loadAllPending();
  if (entry) all[tripId] = entry;
  else delete all[tripId];
  await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(all)).catch(() => undefined);
};

export interface PayInput {
  from: string;
  to: string;
  /** In the trip's currency. */
  amount: number;
  kind: 'full' | 'partial';
  note: string;
  /** Shown on PayMongo's page, e.g. "Kim pays Ana". */
  title: string;
  description: string;
}

/** How a pay or check attempt ended, for the sheet to act on. */
export type PayOutcome =
  | { kind: 'saved'; settlement: Settlement }
  | { kind: 'waiting'; message: string }
  | { kind: 'stopped'; message: string };

type Stage = 'checkout' | 'confirming' | null;

/**
 * Everything about paying through PayMongo from the Settle up sheet.
 *
 * When the server is set up to record payments (it says so in its setup), the
 * payment is written into the trip by the server - the app only reads it back.
 * Otherwise the app records it itself, as a payment the receiver confirms.
 */
export function usePayMongoCheckout({
  visible,
  tripId,
  currency,
  currentUserId,
}: {
  visible: boolean;
  tripId: string;
  currency: string;
  currentUserId: string;
}) {
  const [setup, setSetup] = useState<PayMongoSetup | null>(null);
  const [setupError, setSetupError] = useState('');
  const [setupTry, setSetupTry] = useState(0);
  const [stage, setStage] = useState<Stage>(null);
  const [pending, setPendingState] = useState<PendingCheckout | null>(null);

  // Pesos per unit of the trip's currency, for the "about ₱X" preview only.
  // The server fetches its own rate when it charges, so this cannot be gamed.
  const rates = useRates(currency, currency !== 'PHP');
  const pesoRate = currency === 'PHP' ? 1 : Number(rates?.PHP) || null;

  // Asked once per open (and again on Retry), so the form never waits on it.
  useEffect(() => {
    if (!visible || !payMongoConfigured()) return;
    let alive = true;
    fetchPayMongoSetup()
      .then((value) => {
        if (!alive) return;
        setSetup(value);
        setSetupError('');
      })
      .catch((err) => {
        if (!alive) return;
        setSetup(null);
        setSetupError(payMongoProblem(err));
      });
    return () => {
      alive = false;
    };
  }, [visible, setupTry]);

  // An unfinished checkout from before comes back when the sheet opens.
  useEffect(() => {
    if (!visible || !tripId || !payMongoConfigured()) return;
    let alive = true;
    loadAllPending().then((all) => {
      if (alive) setPendingState(all[tripId] ?? null);
    });
    return () => {
      alive = false;
    };
  }, [visible, tripId]);

  const setPending = useCallback(
    (entry: PendingCheckout | null) => {
      setPendingState(entry);
      void savePending(tripId, entry);
    },
    [tripId],
  );

  const retrySetup = () => {
    setSetupError('');
    setSetupTry((value) => value + 1);
  };

  /** Why PayMongo cannot be used right now, or '' when it can. */
  const blocked = !payMongoConfigured()
    ? 'Not set up in this build: add EXPO_PUBLIC_PAYMONGO_SERVER_URL to .env.'
    : setupError
      ? setupError
      : !setup
        ? 'Connecting to PayMongo…'
        : !setup.ready
          ? setup.problem || 'The payment function is not ready yet.'
          : '';

  /** Turns PayMongo's answer into a saved payment, or says why there is none. */
  const finish = async (
    entry: PendingCheckout,
    result: PayMongoResult,
    note: string,
    kind: 'full' | 'partial',
    how: 'paid' | 'cancelled' | 'closed' | 'again',
  ): Promise<PayOutcome> => {
    const status = result.status === 'open' && how === 'cancelled' ? 'cancelled' : result.status;

    if (status === 'open') {
      setPending(entry);
      return {
        kind: 'waiting',
        message:
          'PayMongo has not confirmed this payment yet. If you finished paying, tap Check payment.',
      };
    }
    if (status !== 'paid') {
      setPending(null);
      return {
        kind: 'stopped',
        message:
          status === 'cancelled'
            ? 'Payment cancelled, so nothing was recorded.'
            : 'That payment did not go through, so nothing was recorded.',
      };
    }

    // The server already wrote it into the trip: nothing left to do but show it.
    if (result.settlement) {
      setPending(null);
      return { kind: 'saved', settlement: result.settlement };
    }

    // The server does not record payments, so the app does, with the receipt.
    const settlement = await createSettlement(tripId, {
      from: entry.from,
      to: entry.to,
      amount: entry.amount,
      kind,
      settledOn: todayKey(),
      isCash: false,
      method: 'PayMongo',
      proofUrls: [],
      note: note.trim(),
      createdBy: currentUserId,
      paymongoRef: result.paymentId || result.reference || entry.sessionId.slice(-24),
      paymongo: {
        method: result.method,
        brand: result.brand,
        last4: result.last4,
        paymentId: result.paymentId,
        checkoutId: result.checkoutId,
        reference: result.reference,
        paidAt: result.paidAt || new Date().toISOString(),
        fee: result.fee,
        ...(currency !== 'PHP' ? { chargedAmount: result.amount, chargedCurrency: 'PHP' } : {}),
      },
    });
    setPending(null);
    return { kind: 'saved', settlement };
  };

  /** Opens PayMongo's checkout, then confirms and records the payment. */
  const pay = async (input: PayInput): Promise<PayOutcome> => {
    setStage('checkout');
    try {
      const checkout = await startPayMongoCheckout({
        amount: input.amount,
        currency,
        title: input.title,
        description: input.description,
        tripId,
        to: input.to,
        kind: input.kind,
        settledOn: todayKey(),
        note: input.note.trim() || undefined,
      });

      const entry: PendingCheckout = {
        sessionId: checkout.sessionId,
        tripId,
        from: input.from,
        to: input.to,
        amount: input.amount,
        startedAt: Date.now(),
      };
      // Saved before the browser opens, so a payment made just before the app
      // is closed can still be checked - and the webhook records it anyway.
      setPending(entry);

      // Ephemeral keeps iOS from asking "wants to use paymongo.com to sign in".
      const opened = await WebBrowser.openAuthSessionAsync(checkout.checkoutUrl, returnUrlFor(), {
        preferEphemeralSession: true,
        showInRecents: true,
      });
      const came = opened.type === 'success' ? returnResultFromUrl(opened.url) : null;
      const how = came === 'paid' ? 'paid' : came === 'cancelled' ? 'cancelled' : 'closed';

      setStage('confirming');
      const result = await confirmPayMongo(checkout.sessionId, {
        tries: how === 'paid' ? 8 : how === 'cancelled' ? 1 : 3,
      });
      return await finish(entry, result, input.note, input.kind, how);
    } catch (err) {
      console.error('PayMongo checkout failed:', err);
      return { kind: 'stopped', message: payMongoProblem(err) };
    } finally {
      setStage(null);
    }
  };

  /** Asks PayMongo again about the unfinished checkout. */
  const check = async (note = '', kind: 'full' | 'partial' = 'partial'): Promise<PayOutcome> => {
    if (!pending) return { kind: 'stopped', message: 'There is no payment to check.' };
    setStage('confirming');
    try {
      const result = await confirmPayMongo(pending.sessionId, { tries: 3 });
      return await finish(pending, result, note, kind, 'again');
    } catch (err) {
      console.error('PayMongo check failed:', err);
      return { kind: 'waiting', message: payMongoProblem(err) };
    } finally {
      setStage(null);
    }
  };

  return {
    setup,
    setupError,
    retrySetup,
    blocked,
    ready: !blocked,
    loading: blocked === 'Connecting to PayMongo…',
    methodsLine: payMongoMethodsLine(setup?.methods),
    minimum: setup?.minimum ?? 20,
    pesoRate,
    stage,
    busy: stage !== null,
    pending,
    clearPending: () => setPending(null),
    pay,
    check,
  };
}

export type PayMongoCheckoutState = ReturnType<typeof usePayMongoCheckout>;
