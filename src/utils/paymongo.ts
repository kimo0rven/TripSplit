/**
 * Helpers that carry a session id back into the app after the checkout page.
 *
 * The checkout page finishes by sending the payer to a `tripsplit://` link. The
 * app reads that link, picks the `session_id` out of it, and asks the server
 * whether the payment actually went through. The result is never read from the
 * link itself: a user could otherwise type `result=paid` into a browser.
 *
 * Kept free of imports so it can be tested with `node --test`.
 */

/** The app's own scheme, from app.json. */
const SCHEME = 'tripsplit';

/** Where the checkout page sends the payer back. The app never has to guess. */
export const returnUrlFor = (): string => `${SCHEME}://paymongo-return`;

/**
 * Pulls the session id out of a `tripsplit://` link, or out of a plain query
 * string. Returns null when there is nothing to read, so callers can tell
 * "no payment came back" from "a payment came back broken".
 */
export const sessionIdFromUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;

  const text = String(url).trim();
  if (!text) return null;

  // Both `?session_id=abc` and `&session_id=abc` are fine, as is a bare id.
  // The id is a signed token, so it uses base64url characters and a `.` before
  // its signature - matching only letters and numbers would cut it in half and
  // hand the server a token it cannot verify.
  const match = /[?&]session_id=([A-Za-z0-9._~-]+)/.exec(text);
  if (match) return decodeURIComponent(match[1]);

  // A link that carries only the id after the scheme, e.g. tripsplit://paymongo-return/abc123.
  const pathMatch = /paymongo-return\/([A-Za-z0-9._~-]+)/.exec(text);
  if (pathMatch) return decodeURIComponent(pathMatch[1]);

  return null;
};

/**
 * Which way the payer came back: PayMongo's success page or its cancel link.
 * Only a hint for how long to wait - whether money arrived is always asked of
 * the server.
 */
export const returnResultFromUrl = (
  url: string | null | undefined,
): 'paid' | 'cancelled' | null => {
  const match = /[?&]result=([a-z]+)/i.exec(String(url || ''));
  const value = match ? match[1].toLowerCase() : '';
  return value === 'paid' || value === 'cancelled' ? value : null;
};

/**
 * What to tell the payer about a finished checkout, in plain words. The app
 * records the payment itself once the server confirms it, so this only explains
 * what happened while the user waited.
 */
export const paymentOutcomeMessage = (
  status: string | null | undefined,
  amountText: string,
): { tone: 'success' | 'error' | 'muted'; message: string } => {
  switch (status) {
    case 'paid':
      return {
        tone: 'success',
        message: `Payment of ${amountText} received. It is being recorded.`,
      };
    case 'failed':
      return {
        tone: 'error',
        message: 'That payment did not go through, so nothing was recorded.',
      };
    case 'cancelled':
      return { tone: 'muted', message: 'Payment cancelled. Nothing was recorded.' };
    case 'open':
      return { tone: 'muted', message: 'That payment is still waiting for the payer to finish.' };
    default:
      return { tone: 'muted', message: 'Checking the payment with the server…' };
  }
};

/** PayMongo's method codes, in the words people use. */
const METHOD_NAMES: Record<string, string> = {
  card: 'Card',
  gcash: 'GCash',
  paymaya: 'Maya',
  grab_pay: 'GrabPay',
  shopee_pay: 'ShopeePay',
  brankas_bdo: 'Online banking',
  brankas_landbank: 'Online banking',
  brankas_metrobank: 'Online banking',
  qrph: 'QR Ph',
  billease: 'BillEase',
  dob: 'Online banking',
  brankas: 'Online banking',
};

/** One PayMongo method code as a person would say it. */
export const payMongoMethodName = (code: string): string =>
  METHOD_NAMES[code] || code.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** The methods on offer as a short line, e.g. "Card or GCash". */
export const payMongoMethodsLine = (codes: string[] | null | undefined): string => {
  const names = Array.from(new Set((codes || []).map(payMongoMethodName))).filter(Boolean);
  if (names.length === 0) return 'Card or e-wallet';
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
};

/** How a card or e-wallet payment is written into the payment's note. */
export const payMongoMethodLabel = (last4?: string | null, method?: string | null): string => {
  if (last4) return `PayMongo card ending ${last4}`;
  if (method && method !== 'card') return `PayMongo ${payMongoMethodName(method)}`;
  return 'PayMongo';
};

/** The friendliest line for a failure that came back from the server. */
export const payMongoProblem = (error: unknown): string => {
  const message =
    typeof error === 'string'
      ? error
      : error && typeof error === 'object' && 'message' in error
        ? String((error as { message?: unknown }).message)
        : '';

  if (!message) return 'Could not reach the payment service.';
  if (/network request failed|failed to fetch|timed out|aborted/i.test(message)) {
    return 'Could not reach the payment service. Check your connection and try again.';
  }
  // The gateway says this when the function behind it is not the one the link
  // was built for. It means the deployed function is out of date, not that the
  // person did anything wrong.
  if (/requested path is invalid/i.test(message)) {
    return 'The payment function on the server is out of date. Run npm run pay:deploy, then try again.';
  }
  return message;
};

/** What a PayMongo payment leaves behind on the payment record. */
export interface PayMongoReceipt {
  /** PayMongo's method code, e.g. gcash, card, qrph. */
  method?: string;
  brand?: string;
  last4?: string;
  /** PayMongo's payment id (`pay_...`). */
  paymentId?: string;
  /** PayMongo's checkout id (`cs_...`). */
  checkoutId?: string;
  /** TripSplit's own short reference for the checkout. */
  reference?: string;
  /** When PayMongo took the money, as an ISO date. */
  paidAt?: string;
  /** PayMongo's fee, in pesos. */
  fee?: number;
  /** For a trip not in pesos: what PayMongo actually charged, and the rate used. */
  chargedAmount?: number;
  chargedCurrency?: string;
  rate?: number;
}

/**
 * The receipt with every empty field left out. The database refuses a record
 * holding `undefined`, so nothing empty may reach it.
 */
export const cleanReceipt = (receipt: PayMongoReceipt): PayMongoReceipt => {
  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(receipt)) {
    if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
    else if (typeof value === 'string' && value.trim()) out[key] = value.trim().slice(0, 80);
  }
  return out as PayMongoReceipt;
};

/** "PayMongo · GCash", or "PayMongo · Visa •••• 4242" for a card. */
export const payMongoPaidWith = (receipt: PayMongoReceipt | null | undefined): string => {
  if (!receipt) return 'PayMongo';
  if (receipt.last4) {
    const brand = receipt.brand
      ? receipt.brand.charAt(0).toUpperCase() + receipt.brand.slice(1)
      : 'Card';
    return `PayMongo · ${brand} •••• ${receipt.last4}`;
  }
  return receipt.method ? `PayMongo · ${payMongoMethodName(receipt.method)}` : 'PayMongo';
};

/**
 * The transaction lines shown on a PayMongo payment, in reading order. The
 * time it was paid is left to the screen, which formats times its own way.
 */
export const payMongoReceiptRows = (
  receipt: PayMongoReceipt | null | undefined,
): { label: string; value: string }[] => {
  if (!receipt) return [];
  const rows: { label: string; value: string }[] = [
    { label: 'Paid through', value: payMongoPaidWith(receipt) },
  ];
  if (receipt.paymentId) rows.push({ label: 'PayMongo payment', value: receipt.paymentId });
  if (receipt.checkoutId) rows.push({ label: 'Checkout', value: receipt.checkoutId });
  if (receipt.reference) rows.push({ label: 'Reference', value: receipt.reference });
  if (typeof receipt.chargedAmount === 'number' && receipt.chargedAmount > 0) {
    rows.push({
      label: 'Charged',
      value: `₱${receipt.chargedAmount.toFixed(2)}${
        typeof receipt.rate === 'number' && receipt.rate > 0
          ? ` at ₱${receipt.rate.toFixed(2)} each`
          : ''
      }`,
    });
  }
  if (typeof receipt.fee === 'number' && receipt.fee > 0) {
    rows.push({ label: 'PayMongo fee', value: `₱${receipt.fee.toFixed(2)}` });
  }
  return rows;
};

/**
 * A PayMongo checkout that was started but not confirmed yet, kept on the
 * device so "Check payment" still works after the sheet or the app is closed.
 */
export interface PendingCheckout {
  sessionId: string;
  tripId: string;
  from: string;
  to: string;
  /** In the trip's currency. */
  amount: number;
  /** When the checkout was opened, in milliseconds. */
  startedAt: number;
}

/** PayMongo checkouts expire within a day; older leftovers are dropped. */
export const PENDING_MAX_AGE_MS = 2 * 24 * 60 * 60 * 1000;

/**
 * Reads the saved unfinished checkouts, one per trip, dropping anything
 * malformed or too old to matter. Never throws: bad storage means none saved.
 */
export const readPendingCheckouts = (
  raw: string | null | undefined,
  now: number,
): Record<string, PendingCheckout> => {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, Partial<PendingCheckout>>;
    const out: Record<string, PendingCheckout> = {};
    for (const [tripId, entry] of Object.entries(parsed || {})) {
      if (
        entry &&
        typeof entry.sessionId === 'string' &&
        typeof entry.from === 'string' &&
        typeof entry.to === 'string' &&
        typeof entry.amount === 'number' &&
        typeof entry.startedAt === 'number' &&
        now - entry.startedAt < PENDING_MAX_AGE_MS
      ) {
        out[tripId] = { ...(entry as PendingCheckout), tripId };
      }
    }
    return out;
  } catch {
    return {};
  }
};
