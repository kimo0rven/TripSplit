/**
 * Talks to the TripSplit payment function, which holds the PayMongo secret key.
 *
 * The app never sees that key. It asks the function to start a payment, sends
 * the payer to PayMongo's checkout page, and then asks what happened. The
 * function decides the outcome; the app only records it.
 */

import { auth } from '@/config/firebase';
import type { Settlement } from '@/types/expenses';

const configuredUrl = (process.env.EXPO_PUBLIC_PAYMONGO_SERVER_URL || '').trim();

/**
 * Supabase functions accept the project's public key in the headers. A secret
 * key (`sb_secret_...`) is never sent from the app: the function is deployed
 * with --no-verify-jwt, so it does not need one.
 */
const publicKey = (() => {
  const key = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '').trim();
  return key.startsWith('sb_secret_') ? '' : key;
})();

/** The function address, or an empty string when payments are not set up. */
export const payMongoServerUrl = configuredUrl.replace(/\/$/, '');

/**
 * PayMongo is switched off unless .env says EXPO_PUBLIC_PAYMONGO_ENABLED=true.
 * Off, "Other" on the Settle up sheet records a payment made some other way
 * (GCash, bank transfer) with a photo as proof, and nothing reaches PayMongo.
 */
export const payMongoEnabled =
  (process.env.EXPO_PUBLIC_PAYMONGO_ENABLED || '').trim().toLowerCase() === 'true';

export const payMongoConfigured = (): boolean => payMongoEnabled && Boolean(payMongoServerUrl);

export interface PayMongoSetup {
  /** True when the function has its PayMongo key and can take payments. */
  ready: boolean;
  /** The methods the checkout page offers, e.g. ['card', 'gcash']. */
  methods: string[];
  /** The smallest amount PayMongo accepts, in pesos. */
  minimum: number;
  /** Why payments cannot work, in words a person can act on. */
  problem: string | null;
  /** True when the server records finished payments in the trip itself. */
  records: boolean;
}

export interface PayMongoCheckout {
  sessionId: string;
  checkoutUrl: string;
  /** What PayMongo charges, in pesos. */
  amount: number;
  /** Pesos per one unit of the trip's currency, when the trip is not in pesos. */
  rate?: number;
}

export interface PayMongoResult {
  status: 'paid' | 'failed' | 'cancelled' | 'open' | string;
  amount: number;
  /** PayMongo's name for how it was paid, e.g. `card` or `gcash`. */
  method?: string;
  /** Last four card digits, when it was a card. */
  last4?: string;
  /** The payment's short TripSplit reference, saved with the record. */
  reference?: string;
  brand?: string;
  paymentId?: string;
  checkoutId?: string;
  paidAt?: string;
  fee?: number;
  /** Set when the server has already written the payment into the trip. */
  settlement?: Settlement;
}

type RequestOptions = {
  method: string;
  body?: string;
  /** The signed-in user's Firebase ID token, so the server knows who is paying. */
  firebaseToken?: string;
};

/** Shared fetch with a timeout, so a sleeping server cannot freeze a screen. */
const call = async (path: string, init: RequestOptions, timeoutMs = 15_000) => {
  if (!payMongoServerUrl) {
    throw new Error('Payments are not set up in this build.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${payMongoServerUrl}${path}`, {
      method: init.method,
      body: init.body,
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        ...(publicKey ? { apikey: publicKey, authorization: `Bearer ${publicKey}` } : {}),
        ...(init.firebaseToken ? { 'x-firebase-token': init.firebaseToken } : {}),
      },
    });

    const payload = await response.json().catch(() => null);
    if (!payload || typeof payload.ok !== 'boolean') {
      // Not an answer from our function at all: the gateway answered instead.
      if (response.status === 404) {
        throw new Error(
          'The payment function is not deployed yet. Run npm run pay:deploy, then try again.',
        );
      }
      throw new Error(payload?.message || `The payment service answered ${response.status}.`);
    }
    if (!response.ok || payload.ok === false) {
      throw new Error(payload.error || `The payment service answered ${response.status}.`);
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
};

/** Asks the server whether it is ready to take payments. */
export const fetchPayMongoSetup = async (): Promise<PayMongoSetup> => {
  const payload = await call('/config', { method: 'GET' }, 8_000);
  if (typeof payload.ready !== 'boolean') {
    // An older copy of the function is still deployed on Supabase.
    return {
      ready: false,
      methods: [],
      minimum: 20,
      problem: 'The payment function on Supabase is out of date. Run npm run pay:deploy.',
      records: false,
    };
  }
  return {
    ready: payload.ready === true,
    methods: Array.isArray(payload.methods) ? payload.methods.map(String) : [],
    minimum: Number(payload.minimum) || 20,
    problem: typeof payload.problem === 'string' ? payload.problem : null,
    records: payload.records === true,
  };
};

/** Starts a payment and hands back PayMongo's checkout page. */
export const startPayMongoCheckout = async (input: {
  /** In the trip's currency; the server converts it to pesos. */
  amount: number;
  currency: string;
  title: string;
  description?: string;
  tripId: string;
  to: string;
  kind: 'full' | 'partial';
  settledOn: string;
  note?: string;
}): Promise<PayMongoCheckout> => {
  const firebaseToken = await auth.currentUser?.getIdToken().catch(() => undefined);
  const payload = await call('/checkout', {
    method: 'POST',
    firebaseToken,
    body: JSON.stringify(input),
  });

  const sessionId = String(payload.sessionId || '');
  const checkoutUrl = String(payload.checkoutUrl || '');
  if (!sessionId || !checkoutUrl) {
    throw new Error('The payment service did not return a checkout link.');
  }

  return {
    sessionId,
    checkoutUrl,
    amount: Number(payload.amount) || input.amount,
    ...(Number(payload.rate) > 0 ? { rate: Number(payload.rate) } : {}),
  };
};

/** Asks what actually happened. This is the only answer the app trusts. */
export const checkPayMongoSession = async (sessionId: string): Promise<PayMongoResult> => {
  const payload = await call(`/session/${encodeURIComponent(sessionId)}`, { method: 'GET' });
  return {
    status: String(payload.status || 'open'),
    amount: Number(payload.amount) || 0,
    method: payload.method ? String(payload.method) : undefined,
    last4: payload.last4 ? String(payload.last4) : undefined,
    reference: payload.sessionId ? String(payload.sessionId) : undefined,
    brand: payload.brand ? String(payload.brand) : undefined,
    paymentId: payload.paymentId ? String(payload.paymentId) : undefined,
    checkoutId: payload.checkoutId ? String(payload.checkoutId) : undefined,
    paidAt: payload.paidAt ? String(payload.paidAt) : undefined,
    fee: Number.isFinite(Number(payload.fee)) ? Number(payload.fee) : undefined,
    ...(payload.recorded && payload.settlement?.id
      ? { settlement: payload.settlement as Settlement }
      : {}),
  };
};

/**
 * Asks until the payment is no longer "open", or until the tries run out.
 *
 * A finished checkout takes a moment to register at PayMongo, so the first
 * answer after the browser closes is often still "open".
 */
export const confirmPayMongo = async (
  sessionId: string,
  { tries = 6, waitMs = 2_000 } = {},
): Promise<PayMongoResult> => {
  const pause = () => new Promise((resolve) => setTimeout(resolve, waitMs));

  let result = await checkPayMongoSession(sessionId);
  for (let attempt = 1; attempt < tries && result.status === 'open'; attempt += 1) {
    await pause();
    result = await checkPayMongoSession(sessionId);
  }
  return result;
};
