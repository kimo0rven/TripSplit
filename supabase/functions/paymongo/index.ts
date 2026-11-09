/**
 * TripSplit PayMongo edge function.
 *
 * The PayMongo secret key must never ship inside the phone app: anyone holding
 * it can create charges and read your payments. So the app talks to this
 * function instead, and this function holds the key.
 *
 * It also records finished payments in the trip itself, using a Firebase
 * service account. Doing that here rather than on the phone means:
 *   - a payment is recorded even if the app is closed straight after paying,
 *     because PayMongo's webhook reaches this function on its own;
 *   - a "confirmed" PayMongo payment can only ever come from PayMongo, never
 *     from a phone claiming one.
 *
 * Secrets (supabase secrets set ...):
 *   PAYMONGO_SECRET_KEY        sk_test_... or sk_live_...            required
 *   PAYMONGO_WEBHOOK_SECRET    whsk_... from the PayMongo webhook     for the webhook
 *   FIREBASE_SERVICE_ACCOUNT   the service account JSON, as one line  for recording
 *   FIREBASE_DATABASE_URL      https://...firebasedatabase.app        for recording
 *   FIREBASE_API_KEY           the app's public Firebase API key      for recording
 *   PAYMONGO_ONLY_METHODS      optional fixed list, e.g. qrph,gcash
 *
 * `npm run pay:setup -- path/to/service-account.json` sets all of these.
 *
 * Routes (all under /functions/v1/paymongo):
 *   GET  /config              is it ready, and which methods are offered
 *   POST /checkout            start a payment, get a checkout link
 *   GET  /session/<token>     what happened; records the payment once paid
 *   POST /webhook             PayMongo tells us a checkout was paid
 */

const env = (name: string) => (Deno.env.get(name) || '').trim();

const SECRET_KEY = env('PAYMONGO_SECRET_KEY');
const SIGNING_SECRET = env('PAYMONGO_SIGNING_SECRET') || SECRET_KEY;
const WEBHOOK_SECRET = env('PAYMONGO_WEBHOOK_SECRET');
const DATABASE_URL = env('FIREBASE_DATABASE_URL').replace(/\/$/, '');
const FIREBASE_API_KEY = env('FIREBASE_API_KEY');

/** The service account, read once. A broken value simply turns recording off. */
const SERVICE_ACCOUNT = (() => {
  try {
    const parsed = JSON.parse(env('FIREBASE_SERVICE_ACCOUNT') || 'null');
    return parsed?.client_email && parsed?.private_key
      ? { email: String(parsed.client_email), key: String(parsed.private_key) }
      : null;
  } catch {
    return null;
  }
})();

/** True when this function can write payments into the trip itself. */
const RECORDS = Boolean(SERVICE_ACCOUNT && DATABASE_URL && FIREBASE_API_KEY);

/** PayMongo will not open a checkout below ₱20.00. */
const MINIMUM_CENTAVOS = 2000;

/**
 * Every method a PayMongo checkout can offer, in the order they are listed.
 */
const KNOWN_METHODS = [
  'qrph',
  'gcash',
  'paymaya',
  'grab_pay',
  'shopee_pay',
  'card',
  'billease',
  'dob',
  'brankas_bdo',
  'brankas_landbank',
  'brankas_metrobank',
];

/** Always offered: PayMongo's capabilities list can be partial in test mode. */
const DEFAULT_METHODS = ['qrph', 'gcash', 'paymaya', 'grab_pay', 'card'];

/** Methods every account has, the last resort when PayMongo refuses the rest. */
const SAFE_METHODS = ['card', 'gcash'];

/** An optional fixed list. The older PAYMONGO_METHODS setting is ignored on purpose. */
const ONLY_METHODS = env('PAYMONGO_ONLY_METHODS')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const API = (env('PAYMONGO_API_BASE') || 'https://api.paymongo.com').replace(/\/$/, '');
const RATES_API = (env('RATES_API_BASE') || 'https://open.er-api.com/v6/latest').replace(/\/$/, '');
const GOOGLE_TOKEN_URL = env('GOOGLE_TOKEN_URL') || 'https://oauth2.googleapis.com/token';
const IDENTITY_URL =
  env('IDENTITY_URL') || 'https://identitytoolkit.googleapis.com/v1/accounts:lookup';

/** The web page PayMongo sends the payer back to, which hands control to the app. */
const RETURN_SITE = (env('PAYMONGO_RETURN_SITE') || 'https://tripsplit-14f93.web.app').replace(
  /\/$/,
  '',
);

const CORS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type, authorization, apikey, x-firebase-token',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-max-age': '86400',
};

/* ---------------------------------------------------------------- responses */

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS,
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });

/** A refusal with a status code, so the handler can answer it as is. */
class Refusal extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/* --------------------------------------------------------------- encodings */

const encoder = new TextEncoder();

const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const fromBase64Url = (value: string) =>
  Uint8Array.from(
    atob(value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4)),
    (character) => character.charCodeAt(0),
  );

const hmac = async (secret: string, payload: string) => {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(payload)));
};

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

/** Compares two strings without leaking where they first differ. */
const sameText = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

/* ------------------------------------------------------------------ tokens */

/** Everything the function needs to remember about one payment, without a store. */
interface Session {
  /** TripSplit's own reference; the recorded payment's id is built from it. */
  id: string;
  /** What PayMongo charges, in centavos. */
  amount: number;
  title: string;
  description: string;
  created: number;
  /** PayMongo's checkout id (`cs_...`). */
  providerId: string;
  /** Who pays whom on which trip, set only when the server records payments. */
  tripId?: string;
  from?: string;
  to?: string;
  /** The amount in the trip's own currency, and that currency. */
  tripAmount?: number;
  currency?: string;
  /** Pesos per one unit of the trip's currency, when it is not pesos. */
  rate?: number;
  kind?: 'full' | 'partial';
  settledOn?: string;
  note?: string;
}

const issueToken = async (session: Session) => {
  const payload = JSON.stringify(session);
  return `${toBase64Url(encoder.encode(payload))}.${toBase64Url(await hmac(SIGNING_SECRET, payload))}`;
};

const readToken = async (token: string): Promise<Session | null> => {
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;
  try {
    const payload = new TextDecoder().decode(fromBase64Url(body));
    if (!sameText(toBase64Url(await hmac(SIGNING_SECRET, payload)), signature)) return null;
    const session = JSON.parse(payload) as Session;
    return session.providerId ? session : null;
  } catch {
    return null;
  }
};

/* ------------------------------------------------------- Firebase (admin) */

let googleToken: { value: string; until: number } | null = null;

/** Reads a PEM private key into a signing key. */
const importPrivateKey = (pem: string) => {
  const body = pem
    .replace(/\\n/g, '\n')
    .replace(/-----[^-]+-----/g, '')
    .replace(/\s+/g, '');
  const bytes = Uint8Array.from(atob(body), (character) => character.charCodeAt(0));
  return crypto.subtle.importKey(
    'pkcs8',
    bytes,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
};

/** An OAuth token for the service account, reused until shortly before it expires. */
const adminToken = async (): Promise<string> => {
  if (!SERVICE_ACCOUNT) throw new Error('Payment recording is not set up.');
  if (googleToken && googleToken.until > Date.now() + 60_000) return googleToken.value;

  const now = Math.floor(Date.now() / 1000);
  const header = toBase64Url(encoder.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claims = toBase64Url(
    encoder.encode(
      JSON.stringify({
        iss: SERVICE_ACCOUNT.email,
        scope:
          'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email',
        aud: GOOGLE_TOKEN_URL,
        iat: now,
        exp: now + 3600,
      }),
    ),
  );
  const key = await importPrivateKey(SERVICE_ACCOUNT.key);
  const signature = toBase64Url(
    new Uint8Array(
      await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(`${header}.${claims}`)),
    ),
  );

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claims}.${signature}`,
    }).toString(),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.access_token) {
    throw new Error('Could not sign in to Firebase with the service account.');
  }
  googleToken = {
    value: String(payload.access_token),
    until: Date.now() + (Number(payload.expires_in) || 3600) * 1000,
  };
  return googleToken.value;
};

/** Reads or writes one database path as the service account (rules do not apply). */
const db = async (path: string, method: 'GET' | 'PUT' = 'GET', value?: unknown) => {
  const token = await adminToken();
  const response = await fetch(
    `${DATABASE_URL}/${path.replace(/^\/+/, '')}.json?access_token=${encodeURIComponent(token)}`,
    {
      method,
      headers: { 'content-type': 'application/json' },
      ...(method === 'PUT' ? { body: JSON.stringify(value) } : {}),
    },
  );
  if (!response.ok) throw new Error(`The database answered ${response.status}.`);
  return response.json().catch(() => null);
};

/** The signed-in Firebase user behind an ID token, or null. */
const userFromToken = async (idToken: string): Promise<string | null> => {
  if (!idToken) return null;
  const response = await fetch(`${IDENTITY_URL}?key=${encodeURIComponent(FIREBASE_API_KEY)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (!response.ok) return null;
  const payload = await response.json().catch(() => ({}));
  const uid = payload?.users?.[0]?.localId;
  return uid ? String(uid) : null;
};

/* ---------------------------------------------------------------- currency */

/**
 * Rates already fetched, by currency. The free rates only change once a day,
 * and asking more than about once an hour risks a 20-minute block, so one
 * answer is reused for an hour while the function stays warm.
 */
const rateCache = new Map<string, { rate: number; at: number }>();
const RATE_MAX_AGE_MS = 60 * 60 * 1000;

/** Pesos for one unit of `currency`, from the same rates the app shows. */
const pesoRate = async (currency: string): Promise<number> => {
  const code = currency.toUpperCase();
  if (code === 'PHP') return 1;

  const cached = rateCache.get(code);
  if (cached && Date.now() - cached.at < RATE_MAX_AGE_MS) return cached.rate;

  try {
    const response = await fetch(`${RATES_API}/${encodeURIComponent(code)}`);
    const payload = await response.json().catch(() => ({}));
    const rate = Number(payload?.rates?.PHP);
    if (response.ok && Number.isFinite(rate) && rate > 0) {
      rateCache.set(code, { rate, at: Date.now() });
      return rate;
    }
  } catch {
    // Falls through: an older rate, or a refusal.
  }
  // A rate from earlier today beats failing the payment while the service is busy.
  if (cached && Date.now() - cached.at < 24 * RATE_MAX_AGE_MS) return cached.rate;
  throw new Refusal(503, `Could not get today's ${code} to PHP rate. Try again in a moment.`);
};

/* ---------------------------------------------------------------- PayMongo */

const authorization = () => `Basic ${btoa(`${SECRET_KEY}:`)}`;

const errorDetail = (payload: any, status: number) =>
  payload?.errors?.[0]?.detail || payload?.errors?.[0]?.code || `PayMongo answered ${status}.`;

const returnLink = (id: string, amount: number, result: 'paid' | 'cancelled') =>
  `${RETURN_SITE}/pay-done?${new URLSearchParams({
    result,
    amount: String(amount / 100),
    ref: id,
  }).toString()}`;

/** Pulls method names out of PayMongo's capabilities answer, whatever its shape. */
const readMethodList = (payload: any): string[] => {
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.data?.attributes?.payment_methods)
        ? payload.data.attributes.payment_methods
        : [];
  return list
    .map((item: any) =>
      typeof item === 'string' ? item : item?.attributes?.type || item?.type || item?.id || '',
    )
    .map((value: unknown) => String(value).trim().toLowerCase())
    .filter(Boolean);
};

let accountMethods: Promise<string[] | null> | null = null;

/** The methods this PayMongo account reports as switched on, asked once per warm start. */
const fetchAccountMethods = (): Promise<string[] | null> => {
  if (!accountMethods) {
    accountMethods = (async () => {
      try {
        const response = await fetch(`${API}/v1/merchants/capabilities/payment_methods`, {
          method: 'GET',
          headers: { accept: 'application/json', authorization: authorization() },
        });
        if (!response.ok) return null;
        const enabled = new Set(readMethodList(await response.json().catch(() => null)));
        const offered = KNOWN_METHODS.filter((method) => enabled.has(method));
        return offered.length ? offered : null;
      } catch {
        return null;
      }
    })();
    accountMethods.then((result) => {
      if (!result) accountMethods = null;
    });
  }
  return accountMethods;
};

/**
 * What the checkout offers: a fixed list if set; otherwise the usual methods
 * plus anything else the account reports. A usual method the account really
 * lacks is dropped by the retry in `createCheckout`.
 */
const methodsToOffer = async (): Promise<string[]> => {
  if (ONLY_METHODS.length) return ONLY_METHODS;
  const reported = (await fetchAccountMethods()) ?? [];
  const wanted = new Set([...DEFAULT_METHODS, ...reported]);
  return KNOWN_METHODS.filter((method) => wanted.has(method));
};

/** The methods PayMongo last accepted, so later checkouts skip any retry. */
let acceptedMethods: string[] | null = null;

interface CheckoutInput {
  id: string;
  amount: number;
  title: string;
  description: string;
  /** Strings only: PayMongo hands these back on the webhook. */
  metadata: Record<string, string>;
}

const requestCheckout = async (input: CheckoutInput, methods: string[]) => {
  const response = await fetch(`${API}/v1/checkout_sessions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      authorization: authorization(),
    },
    body: JSON.stringify({
      data: {
        attributes: {
          line_items: [
            {
              name: input.title,
              description: input.description,
              amount: input.amount,
              currency: 'PHP',
              quantity: 1,
            },
          ],
          payment_method_types: methods,
          description: input.description,
          reference_number: `tripsplit-${input.id}`,
          success_url: returnLink(input.id, input.amount, 'paid'),
          cancel_url: returnLink(input.id, input.amount, 'cancelled'),
          show_line_items: true,
          show_description: true,
          send_email_receipt: false,
          metadata: input.metadata,
        },
      },
    }),
  });
  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, payload };
};

const isMethodProblem = (payload: any) =>
  (Array.isArray(payload?.errors) ? payload.errors : []).some((error: any) =>
    /payment_method|method/i.test(
      `${error?.source?.attribute || ''} ${error?.detail || ''} ${error?.code || ''}`,
    ),
  );

const namedMethods = (payload: any, methods: string[]) => {
  const text = (Array.isArray(payload?.errors) ? payload.errors : [])
    .map((error: any) => `${error?.detail || ''} ${error?.source?.attribute || ''}`)
    .join(' ')
    .toLowerCase();
  return methods.filter((method) => new RegExp(`\\b${method}\\b`).test(text));
};

/**
 * Creates the checkout, offering as many methods as the account allows. A
 * method PayMongo refuses is dropped and it is asked again, never dropping
 * card or GCash.
 */
const createCheckout = async (input: CheckoutInput) => {
  let methods = acceptedMethods ?? (await methodsToOffer());

  for (let attempt = 0; attempt < KNOWN_METHODS.length + 2; attempt += 1) {
    const { ok, status, payload } = await requestCheckout(input, methods);

    if (ok) {
      const checkoutUrl = payload?.data?.attributes?.checkout_url;
      const providerId = payload?.data?.id;
      if (!checkoutUrl || !providerId) throw new Error('PayMongo did not return a checkout link.');
      acceptedMethods = methods;
      return { checkoutUrl: String(checkoutUrl), providerId: String(providerId) };
    }

    if (!isMethodProblem(payload)) throw new Error(errorDetail(payload, status));

    const named = namedMethods(payload, methods);
    let next: string[];
    if (named.length && named.length < methods.length) {
      next = methods.filter((method) => !named.includes(method));
    } else {
      const extras = methods.filter((method) => !SAFE_METHODS.includes(method));
      const drop = extras[extras.length - 1];
      next = drop ? methods.filter((method) => method !== drop) : SAFE_METHODS;
    }
    if (!next.length) next = SAFE_METHODS;
    if (next.join() === methods.join()) throw new Error(errorDetail(payload, status));
    methods = next;
  }

  throw new Error('PayMongo would not open a checkout with any payment method.');
};

type Status = 'paid' | 'failed' | 'cancelled' | 'open';

interface ProviderResult {
  status: Status;
  /** What PayMongo took, in pesos. */
  amount: number;
  method?: string;
  last4?: string;
  brand?: string;
  paymentId?: string;
  checkoutId?: string;
  paidAt?: string;
  fee?: number;
}

/**
 * Reads what happened from a checkout session's attributes. Used for both the
 * app's own lookups and PayMongo's webhook, which carries the same session.
 *
 * A checkout's own status is only ever `active` or `expired`. The money shows
 * up in its `payments` list, and an amount short of what was asked is refused.
 */
const readCheckout = (attributes: any, expected: number, checkoutId?: string): ProviderResult => {
  const payments: any[] = Array.isArray(attributes?.payments) ? attributes.payments : [];
  const paid = payments.find((payment) =>
    ['paid', 'succeeded'].includes(String(payment?.attributes?.status || '')),
  );
  const intent = attributes?.payment_intent?.attributes || {};

  if (paid) {
    const details = paid?.attributes || {};
    const amount = Number(details.amount) || 0;
    const source = details.source || {};
    const method = source.type || attributes.payment_method_used;
    const paidAt = Number(details.paid_at) || 0;
    return {
      status: amount >= expected ? 'paid' : 'failed',
      amount: amount / 100,
      method: method ? String(method) : undefined,
      last4: source.last4 ? String(source.last4) : undefined,
      brand: source.brand ? String(source.brand) : undefined,
      paymentId: paid?.id ? String(paid.id) : undefined,
      checkoutId,
      paidAt: paidAt ? new Date(paidAt * 1000).toISOString() : undefined,
      fee: Number.isFinite(Number(details.fee)) ? Number(details.fee) / 100 : undefined,
    };
  }

  if (String(intent.status || '') === 'succeeded') {
    const amount = Number(intent.amount) || expected;
    const method = attributes?.payment_method_used;
    return {
      status: amount >= expected ? 'paid' : 'failed',
      amount: amount / 100,
      method: method ? String(method) : undefined,
      checkoutId,
    };
  }

  if (String(attributes?.status || '') === 'expired') {
    return { status: 'cancelled', amount: expected / 100, checkoutId };
  }

  return { status: 'open', amount: expected / 100, checkoutId };
};

const providerStatus = async (session: Session): Promise<ProviderResult> => {
  const response = await fetch(`${API}/v1/checkout_sessions/${session.providerId}`, {
    method: 'GET',
    headers: { accept: 'application/json', authorization: authorization() },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(errorDetail(payload, response.status));
  return readCheckout(payload?.data?.attributes || {}, session.amount, session.providerId);
};

/** Finished answers only; an unfinished one must be asked again next time. */
const statusCache = new Map<string, ProviderResult>();

const lookup = async (session: Session): Promise<ProviderResult> => {
  const cached = statusCache.get(session.providerId);
  if (cached) return cached;
  const result = await providerStatus(session);
  if (result.status !== 'open') statusCache.set(session.providerId, result);
  return result;
};

/* --------------------------------------------------------------- recording */

const settlementIdFor = (reference: string) => `pm${reference.replace(/[^A-Za-z0-9]/g, '')}`;

const pesos = (value: number) => `₱${value.toFixed(2)}`;

/** Leaves a notice in someone's inbox and pushes it, if they have not turned it off. */
const notifyReceived = async (
  to: string,
  from: string,
  tripId: string,
  title: string,
  body: string,
) => {
  try {
    const id = `pm${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    await db(`notifications/${to}/${id}`, 'PUT', {
      id,
      type: 'paymentUpdates',
      title,
      body,
      from,
      tripId,
      about: tripId,
      createdAt: new Date().toISOString(),
      read: false,
    });
    // The same checks as every other push: their settings now live under
    // userPrivate (turned-off kinds, muted trips, quiet hours, their token).
    await pushNotice(from, to, id);
  } catch (error) {
    console.warn('Could not notify the receiver:', error);
  }
};

/**
 * Writes a PayMongo payment into the trip, once. The id is built from the
 * payment's own reference, so the app's lookup and PayMongo's webhook arriving
 * together still leave a single record.
 */
const recordPayment = async (session: Session, result: ProviderResult) => {
  if (!RECORDS || !session.tripId || !session.from || !session.to) return null;

  const id = settlementIdFor(session.id);
  const path = `trips/${session.tripId}/settlements/${id}`;
  const existing = await db(path);
  if (existing && typeof existing === 'object') return { id, ...existing };

  const trip = await db(`trips/${session.tripId}/name`);
  if (trip === null) return null; // The trip was deleted meanwhile.

  const now = new Date().toISOString();
  const currency = session.currency || 'PHP';
  const tripAmount = session.tripAmount ?? result.amount;
  const receipt: Record<string, string | number> = {};
  const put = (key: string, value: unknown) => {
    if (typeof value === 'number' && Number.isFinite(value)) receipt[key] = value;
    else if (typeof value === 'string' && value) receipt[key] = value.slice(0, 80);
  };
  put('method', result.method);
  put('brand', result.brand);
  put('last4', result.last4);
  put('paymentId', result.paymentId);
  put('checkoutId', result.checkoutId || session.providerId);
  put('reference', session.id);
  put('paidAt', result.paidAt || now);
  put('fee', result.fee);
  if (currency !== 'PHP') {
    put('chargedAmount', result.amount);
    put('chargedCurrency', 'PHP');
    put('rate', session.rate);
  }

  const settlement: Record<string, unknown> = {
    id,
    from: session.from,
    to: session.to,
    amount: tripAmount,
    kind: session.kind === 'full' ? 'full' : 'partial',
    settledOn: session.settledOn || now.slice(0, 10),
    isCash: false,
    method: 'PayMongo',
    status: 'confirmed',
    confirmedBy: 'paymongo',
    confirmedAt: now,
    paymongoRef: result.paymentId || session.id,
    paymongo: receipt,
    createdBy: session.from,
    createdAt: now,
    ...(session.note ? { note: session.note } : {}),
  };

  await db(path, 'PUT', settlement);

  const payer = await db(`trips/${session.tripId}/members/${session.from}/fullname`).catch(
    () => null,
  );
  await notifyReceived(
    session.to,
    session.from,
    session.tripId,
    'Payment received',
    `${typeof payer === 'string' ? payer : 'Someone'} paid you ${
      currency === 'PHP' ? pesos(tripAmount) : `${tripAmount.toFixed(2)} ${currency}`
    } through PayMongo in ${typeof trip === 'string' ? trip : 'a trip'}.`,
  );

  return settlement;
};

/* ----------------------------------------------------------------- webhook */

/**
 * Checks PayMongo's `Paymongo-Signature` header: `t=<time>,te=<test>,li=<live>`,
 * each signature an HMAC-SHA256 of `<time>.<raw body>` with the webhook secret.
 */
const webhookIsGenuine = async (header: string, raw: string, live: boolean) => {
  if (!WEBHOOK_SECRET || !header) return false;
  const parts = Object.fromEntries(
    header.split(',').map((part) => {
      const [key, ...rest] = part.trim().split('=');
      return [key, rest.join('=')];
    }),
  );
  const expected = toHex(await hmac(WEBHOOK_SECRET, `${parts.t}.${raw}`));
  const given = String((live ? parts.li : parts.te) || '');
  // Stale signatures are refused, so a captured request cannot be replayed later.
  const age = Math.abs(Date.now() / 1000 - Number(parts.t));
  return Boolean(parts.t) && age < 60 * 60 * 24 && sameText(expected, given);
};

/** Rebuilds the payment's details from the metadata the checkout was created with. */
const sessionFromMetadata = (checkout: any): Session | null => {
  const meta = checkout?.attributes?.metadata || {};
  const reference = String(meta.tripsplit_ref || '');
  if (!reference || !meta.trip_id || !meta.from || !meta.to) return null;
  const centavos = Number(meta.charge_centavos);
  return {
    id: reference,
    amount: Number.isFinite(centavos) ? centavos : 0,
    title: '',
    description: '',
    created: 0,
    providerId: String(checkout?.id || ''),
    tripId: String(meta.trip_id),
    from: String(meta.from),
    to: String(meta.to),
    tripAmount: Number(meta.trip_amount) || undefined,
    currency: String(meta.currency || 'PHP'),
    rate: Number(meta.rate) || undefined,
    kind: meta.kind === 'full' ? 'full' : 'partial',
    settledOn: meta.settled_on ? String(meta.settled_on) : undefined,
    note: meta.note ? String(meta.note) : undefined,
  };
};

/* -------------------------------------------------------- app services */

/*
 * Two jobs the app can't do safely on the phone: sending push notifications
 * (which needs the other person's push token and settings, now private) and
 * handing out storage upload links (the storage bucket no longer lets the app
 * write directly). Both check who is asking with their Firebase sign-in.
 */

const SUPABASE_URL = env('SUPABASE_URL').replace(/\/$/, '');
const SUPABASE_SERVICE_KEY = env('SUPABASE_SERVICE_ROLE_KEY');
const STORAGE_BUCKET = env('STORAGE_BUCKET') || 'TripSplit';
/** About ten years, so a saved photo link effectively never expires. */
const READ_LINK_SECONDS = 60 * 60 * 24 * 365 * 10;

/** The signed-in person making the request, or a refusal. */
const caller = async (request: Request): Promise<string> => {
  if (!RECORDS) throw new Refusal(503, 'The server is missing its Firebase settings.');
  const uid = await userFromToken(request.headers.get('x-firebase-token') || '');
  if (!uid) throw new Refusal(401, 'Sign in again, then try that once more.');
  return uid;
};

/** UTC offset in minutes and quiet hours: no pushes from 10 PM to 7 AM their time. */
const isQuietFor = (tz: number) => {
  const hour = new Date(Date.now() + (Number(tz) || 0) * 60_000).getUTCHours();
  return hour >= 22 || hour < 7;
};

/**
 * Sends the push for a notice that is already in someone's inbox. The notice
 * itself was let in by the database rules, which check the sender shares a
 * trip or a friendship with them, so here it only has to be the caller's own.
 */
const pushNotice = async (from: string, to: string, noticeId: string) => {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(to) || !/^[A-Za-z0-9_-]{1,80}$/.test(noticeId)) {
    throw new Refusal(400, 'That notice could not be found.');
  }
  const notice = await db(`notifications/${to}/${noticeId}`);
  if (!notice || notice.from !== from) throw new Refusal(403, 'That notice is not yours to send.');
  if (to === from) return 'inbox';

  const settings = (await db(`userPrivate/${to}`)) || {};
  const prefs = settings.notificationPrefs || {};
  const delivery = settings.notificationSettings || {};
  if (prefs[notice.type] === false) return 'off';
  if (notice.tripId && delivery.mutedTrips?.[notice.tripId]) return 'off';
  if (delivery.push === false || !settings.pushToken) return 'inbox';
  if (delivery.quiet && isQuietFor(delivery.tz)) return 'inbox';

  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      to: settings.pushToken,
      title: String(notice.title || ''),
      body: String(notice.body || ''),
      sound: 'default',
      // Android: the channel the app creates, at high priority so it shows
      // straight away even when the phone is idle.
      channelId: 'default',
      priority: 'high',
      data: { tripId: notice.tripId || undefined },
    }),
  });
  const result = await response.json().catch(() => ({}));
  // The app was uninstalled or the token replaced: forget it so later notices
  // don't keep trying a phone that is gone.
  if (result?.data?.details?.error === 'DeviceNotRegistered') {
    await db(`userPrivate/${to}/pushToken`, 'PUT', null).catch(() => null);
  }
  if (!response.ok || result?.data?.status === 'error') {
    console.warn('Expo refused a push:', JSON.stringify(result?.data ?? result));
    return 'inbox';
  }
  return 'pushed';
};

/** Who may put a file at a path: their own folder, or a trip they are in. */
const mayWrite = async (uid: string, path: string) => {
  const parts = path.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) return false;
  if (parts[0] === uid) return true;
  if (['receipts', 'itinerary', 'notes'].includes(parts[0]) && parts[1]) {
    const trip = await db(`trips/${parts[1]}/createdBy`);
    // A trip being created uploads its plan photos just before it exists.
    if (trip === null) return true;
    return (await db(`trips/${parts[1]}/members/${uid}/id`)) !== null;
  }
  return false;
};

const storageApi = async (path: string, init: RequestInit) => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Refusal(503, 'The server is missing its storage settings.');
  }
  const response = await fetch(`${SUPABASE_URL}/storage/v1/${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      apikey: SUPABASE_SERVICE_KEY,
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Refusal(502, body?.message || 'Storage refused that.');
  return body;
};

const objectPath = (path: string) => path.split('/').map(encodeURIComponent).join('/');

/** Every file under a folder, walking into sub-folders. */
const listFolder = async (prefix: string, depth = 0): Promise<string[]> => {
  const files: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const entries = (await storageApi(`object/list/${STORAGE_BUCKET}`, {
      method: 'POST',
      body: JSON.stringify({ prefix, limit: 1000, offset }),
    })) as { name: string; id: string | null }[];
    for (const entry of entries || []) {
      const path = `${prefix}/${entry.name}`;
      if (!entry.id) {
        if (depth < 3) files.push(...(await listFolder(path, depth + 1)));
      } else {
        files.push(path);
      }
    }
    if (!entries || entries.length < 1000) break;
  }
  return files;
};

/* ----------------------------------------------------------------- handler */

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const url = new URL(request.url);
  // Split the path at the function name, so the same code works locally
  // (/paymongo/...) and in the cloud (/functions/v1/paymongo/...).
  const mark = url.pathname.lastIndexOf('/paymongo') + '/paymongo'.length;
  const route = url.pathname.slice(mark) || '/';
  const problem = SECRET_KEY ? null : 'The payment function has no PayMongo secret key yet.';

  try {
    if ((route === '/config' || route === '/') && request.method === 'GET') {
      return json(200, {
        ok: true,
        ready: !problem,
        methods: problem ? [] : (acceptedMethods ?? (await methodsToOffer())),
        account: problem ? [] : ((await fetchAccountMethods()) ?? []),
        minimum: MINIMUM_CENTAVOS / 100,
        records: RECORDS,
        webhook: Boolean(WEBHOOK_SECRET),
        problem,
      });
    }

    if (route === '/checkout' && request.method === 'POST') {
      if (problem) return json(503, { ok: false, error: problem });

      const body = await request.json().catch(() => ({}) as Record<string, unknown>);
      const tripAmount = Math.round(Number(body.amount) * 100) / 100;
      if (!Number.isFinite(tripAmount) || tripAmount <= 0) {
        return json(400, { ok: false, error: 'Enter an amount greater than zero.' });
      }

      const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
      let currency = String(body.currency || 'PHP').toUpperCase();
      let tripId: string | undefined;
      let from: string | undefined;
      let to: string | undefined;

      if (RECORDS) {
        // The payer is whoever is signed in, checked with Firebase, and both
        // people must be on the trip. The trip's currency is read from the
        // trip, not taken from the phone.
        const uid = await userFromToken(request.headers.get('x-firebase-token') || '');
        if (!uid) return json(401, { ok: false, error: 'Sign in again, then try paying.' });
        tripId = String(body.tripId || '');
        to = String(body.to || '');
        if (!tripId || !to || to === uid) {
          return json(400, { ok: false, error: 'Pick who you are paying.' });
        }
        const [payer, payee, tripCurrency] = await Promise.all([
          db(`trips/${tripId}/members/${uid}`),
          db(`trips/${tripId}/members/${to}`),
          db(`trips/${tripId}/currency`),
        ]);
        if (!payer || !payee) {
          return json(403, { ok: false, error: 'Both people must be on this trip.' });
        }
        from = uid;
        currency = String(tripCurrency || 'PHP').toUpperCase();
      }

      const rate = await pesoRate(currency);
      const amount = Math.round(tripAmount * rate * 100);
      if (amount < MINIMUM_CENTAVOS) {
        return json(400, {
          ok: false,
          error: `PayMongo payments start at ₱${(MINIMUM_CENTAVOS / 100).toFixed(2)}${
            currency === 'PHP' ? '' : `, which is more than this ${currency} amount`
          }.`,
        });
      }

      const session: Omit<Session, 'providerId'> = {
        id,
        amount,
        title: String(body.title || 'TripSplit payment').slice(0, 120),
        description: String(body.description || 'TripSplit settlement').slice(0, 200),
        created: Date.now(),
        ...(RECORDS
          ? {
              tripId,
              from,
              to,
              tripAmount,
              currency,
              ...(currency !== 'PHP' ? { rate } : {}),
              kind: body.kind === 'full' ? ('full' as const) : ('partial' as const),
              settledOn: String(body.settledOn || '').slice(0, 10) || undefined,
              note: String(body.note || '').slice(0, 200) || undefined,
            }
          : {}),
      };

      const metadata: Record<string, string> = {
        tripsplit_ref: id,
        charge_centavos: String(amount),
      };
      if (RECORDS) {
        Object.assign(metadata, {
          trip_id: tripId!,
          from: from!,
          to: to!,
          trip_amount: String(tripAmount),
          currency,
          kind: session.kind || 'partial',
          ...(currency !== 'PHP' ? { rate: String(rate) } : {}),
          ...(session.settledOn ? { settled_on: session.settledOn } : {}),
          ...(session.note ? { note: session.note } : {}),
        });
      }

      const checkout = await createCheckout({
        id,
        amount,
        title: session.title,
        description: session.description,
        metadata,
      });
      const token = await issueToken({ ...session, providerId: checkout.providerId });

      return json(200, {
        ok: true,
        sessionId: token,
        checkoutUrl: checkout.checkoutUrl,
        amount: amount / 100,
        tripAmount,
        currency,
        ...(currency !== 'PHP' ? { rate } : {}),
        records: Boolean(RECORDS),
      });
    }

    const sessionMatch = route.match(/^\/session\/(.+)$/);
    if (sessionMatch && request.method === 'GET') {
      if (problem) return json(503, { ok: false, error: problem });

      const session = await readToken(decodeURIComponent(sessionMatch[1]).trim());
      if (!session) return json(404, { ok: false, error: 'That payment link is not valid.' });

      const result = await lookup(session);
      const settlement = result.status === 'paid' ? await recordPayment(session, result) : null;
      return json(200, {
        ok: true,
        sessionId: session.id,
        ...result,
        recorded: Boolean(settlement),
        ...(settlement ? { settlement } : {}),
      });
    }

    if (route === '/webhook' && request.method === 'POST') {
      const raw = await request.text();
      let event: any = null;
      try {
        event = JSON.parse(raw);
      } catch {
        return json(400, { ok: false, error: 'Not JSON.' });
      }
      const live = Boolean(event?.data?.attributes?.livemode);
      if (!(await webhookIsGenuine(request.headers.get('paymongo-signature') || '', raw, live))) {
        return json(401, { ok: false, error: 'Signature does not match.' });
      }

      const type = String(event?.data?.attributes?.type || '');
      if (type !== 'checkout_session.payment.paid') return json(200, { ok: true, ignored: type });

      const checkout = event?.data?.attributes?.data;
      const session = sessionFromMetadata(checkout);
      if (!session) return json(200, { ok: true, ignored: 'not a TripSplit checkout' });

      const result = readCheckout(checkout?.attributes || {}, session.amount, session.providerId);
      if (result.status !== 'paid') return json(200, { ok: true, ignored: result.status });

      statusCache.set(session.providerId, result);
      const settlement = await recordPayment(session, result);
      return json(200, { ok: true, recorded: Boolean(settlement) });
    }

    if (route === '/push' && request.method === 'POST') {
      const uid = await caller(request);
      const body = await request.json().catch(() => ({}) as Record<string, unknown>);
      const status = await pushNotice(uid, String(body.to || ''), String(body.noticeId || ''));
      return json(200, { ok: true, status });
    }

    if (route === '/storage/upload' && request.method === 'POST') {
      const uid = await caller(request);
      const body = await request.json().catch(() => ({}) as Record<string, unknown>);
      const path = String(body.path || '');
      if (!(await mayWrite(uid, path))) {
        return json(403, { ok: false, error: 'You can’t add files there.' });
      }
      const signed = await storageApi(`object/upload/sign/${STORAGE_BUCKET}/${objectPath(path)}`, {
        method: 'POST',
        headers: { 'x-upsert': 'true' },
      });
      const token = new URL(String(signed.url || ''), 'https://x').searchParams.get('token');
      if (!token) return json(502, { ok: false, error: 'Storage gave no upload link.' });
      return json(200, { ok: true, path, token });
    }

    if (route === '/storage/link' && request.method === 'POST') {
      const uid = await caller(request);
      const body = await request.json().catch(() => ({}) as Record<string, unknown>);
      const path = String(body.path || '');
      if (!(await mayWrite(uid, path))) {
        return json(403, { ok: false, error: 'That file is not yours to share.' });
      }
      const signed = await storageApi(`object/sign/${STORAGE_BUCKET}/${objectPath(path)}`, {
        method: 'POST',
        body: JSON.stringify({ expiresIn: READ_LINK_SECONDS }),
      });
      return json(200, { ok: true, url: `${SUPABASE_URL}/storage/v1${signed.signedURL}` });
    }

    if (route === '/storage/delete-trip' && request.method === 'POST') {
      await caller(request);
      const body = await request.json().catch(() => ({}) as Record<string, unknown>);
      const tripId = String(body.tripId || '');
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(tripId)) return json(400, { ok: false, error: 'No trip.' });
      // Only a trip that is already gone can have its photos cleared.
      if ((await db(`trips/${tripId}/createdBy`)) !== null) {
        return json(409, { ok: false, error: 'That trip still exists.' });
      }
      let removed = 0;
      for (const folder of ['receipts', 'itinerary', 'notes']) {
        const files = await listFolder(`${folder}/${tripId}`);
        for (let i = 0; i < files.length; i += 100) {
          await storageApi(`object/${STORAGE_BUCKET}`, {
            method: 'DELETE',
            body: JSON.stringify({ prefixes: files.slice(i, i + 100) }),
          });
          removed += Math.min(100, files.length - i);
        }
      }
      return json(200, { ok: true, removed });
    }

    return json(404, { ok: false, error: 'Not found.' });
  } catch (error) {
    if (error instanceof Refusal) return json(error.status, { ok: false, error: error.message });
    return json(500, { ok: false, error: (error as Error)?.message || 'The payment failed.' });
  }
});
