import assert from 'node:assert/strict';
import { createHmac, generateKeyPairSync } from 'node:crypto';
import { before, describe, test } from 'node:test';

/*
 * Runs the PayMongo edge function against stand-ins for PayMongo, Firebase,
 * Google sign-in and the exchange-rate service, so the payment flow can be
 * checked end to end without any real account or money.
 */

const DB_URL = 'https://db.example.test';
const WEBHOOK_SECRET = 'whsk_example';
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const SERVICE_ACCOUNT = JSON.stringify({
  client_email: 'payments@example.iam.gserviceaccount.com',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
});

/** The fake database, by path. */
const store: Record<string, unknown> = {};
const getPath = (path: string): unknown =>
  path.split('/').reduce<any>((node, key) => (node == null ? undefined : node[key]), store) ?? null;
const putPath = (path: string, value: unknown) => {
  const keys = path.split('/');
  let node: any = store;
  keys.slice(0, -1).forEach((key) => (node = node[key] ??= {}));
  node[keys[keys.length - 1]] = value;
};

/** What the fake PayMongo says about the checkout. */
let checkoutPaid = false;
let lastCheckoutBody: any = null;

const paidCheckout = (centavos: number, metadata: Record<string, string>) => ({
  id: 'cs_test1',
  attributes: {
    status: 'active',
    metadata,
    payment_method_used: 'gcash',
    payments: [
      {
        id: 'pay_abc',
        attributes: {
          status: 'paid',
          amount: centavos,
          fee: 250,
          paid_at: 1_800_000_000,
          source: { type: 'gcash' },
        },
      },
    ],
  },
});

const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

let handler: (request: Request) => Promise<Response>;

before(async () => {
  (globalThis as any).Deno = {
    env: {
      get: (name: string) =>
        ({
          PAYMONGO_SECRET_KEY: 'sk_test_example',
          PAYMONGO_WEBHOOK_SECRET: WEBHOOK_SECRET,
          FIREBASE_SERVICE_ACCOUNT: SERVICE_ACCOUNT,
          FIREBASE_DATABASE_URL: DB_URL,
          FIREBASE_API_KEY: 'public-key',
        })[name],
    },
    serve: (fn: typeof handler) => {
      handler = fn;
    },
  };

  globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input);
    if (url.startsWith('https://oauth2.googleapis.com/token')) {
      return respond({ access_token: 'admin-token', expires_in: 3600 });
    }
    if (url.startsWith('https://identitytoolkit.googleapis.com')) {
      const { idToken } = JSON.parse(String(init.body));
      return idToken === 'good-token' ? respond({ users: [{ localId: 'kim' }] }) : respond({}, 400);
    }
    if (url.startsWith('https://open.er-api.com/v6/latest/USD')) {
      return respond({ result: 'success', rates: { PHP: 58 } });
    }
    if (url.startsWith('https://exp.host')) return respond({ data: { status: 'ok' } });
    if (url.startsWith(DB_URL)) {
      const path = url.slice(DB_URL.length + 1).split('.json')[0];
      if ((init.method || 'GET') === 'PUT') {
        putPath(path, JSON.parse(String(init.body)));
        return respond(JSON.parse(String(init.body)));
      }
      return respond(getPath(path));
    }
    if (url.includes('/v1/merchants/capabilities')) return respond(['qrph']);
    if (url.endsWith('/v1/checkout_sessions') && init.method === 'POST') {
      lastCheckoutBody = JSON.parse(String(init.body));
      return respond({
        data: { id: 'cs_test1', attributes: { checkout_url: 'https://pm.test/c' } },
      });
    }
    if (url.includes('/v1/checkout_sessions/cs_test1')) {
      const attributes = lastCheckoutBody.data.attributes;
      return respond({
        data: checkoutPaid
          ? paidCheckout(attributes.line_items[0].amount, attributes.metadata)
          : { id: 'cs_test1', attributes: { status: 'active', payments: [] } },
      });
    }
    return respond({ errors: [{ detail: `unexpected ${url}` }] }, 500);
  }) as typeof fetch;

  putPath('trips/t1', {
    name: 'Baguio',
    currency: 'USD',
    members: { kim: { fullname: 'Kim Reyes' }, ana: { fullname: 'Ana Cruz' } },
  });
  putPath('users/ana', { pushToken: 'ExponentPushToken[x]' });

  await import('../supabase/functions/paymongo/index.ts');
});

const call = (path: string, init: RequestInit = {}) =>
  handler(new Request(`https://fn.test/functions/v1/paymongo${path}`, init)).then(async (r) => ({
    status: r.status,
    body: (await r.json()) as any,
  }));

const startCheckout = (token = 'good-token') =>
  call('/checkout', {
    method: 'POST',
    headers: { 'x-firebase-token': token },
    body: JSON.stringify({
      amount: 10,
      tripId: 't1',
      to: 'ana',
      kind: 'full',
      settledOn: '2026-11-05',
    }),
  });

describe('the PayMongo function', () => {
  test('says it records payments and offers the usual methods even if PayMongo names only QR Ph', async () => {
    const { body } = await call('/config');
    assert.equal(body.records, true);
    assert.equal(body.webhook, true);
    assert.deepEqual(body.methods, ['qrph', 'gcash', 'paymaya', 'grab_pay', 'card']);
  });

  test('refuses a checkout from someone who is not signed in', async () => {
    const { status } = await startCheckout('bad-token');
    assert.equal(status, 401);
  });

  test('charges the peso value of a dollar trip, at the server rate', async () => {
    const { status, body } = await startCheckout();
    assert.equal(status, 200);
    assert.equal(body.currency, 'USD');
    assert.equal(body.amount, 580);
    assert.equal(lastCheckoutBody.data.attributes.line_items[0].amount, 58000);
    assert.equal(lastCheckoutBody.data.attributes.metadata.from, 'kim');
  });

  test('records nothing while the checkout is unpaid', async () => {
    const { body: started } = await startCheckout();
    const { body } = await call(`/session/${encodeURIComponent(started.sessionId)}`);
    assert.equal(body.status, 'open');
    assert.equal(body.recorded, false);
  });

  test('records a paid checkout once, in the trip currency, and tells the receiver', async () => {
    const { body: started } = await startCheckout();
    checkoutPaid = true;
    const first = await call(`/session/${encodeURIComponent(started.sessionId)}`);
    const again = await call(`/session/${encodeURIComponent(started.sessionId)}`);

    assert.equal(first.body.recorded, true);
    const settlements = getPath('trips/t1/settlements') as Record<string, any>;
    const saved = Object.values(settlements);
    assert.equal(saved.length, 1);
    assert.equal(again.body.settlement.id, first.body.settlement.id);

    const record = saved[0];
    assert.equal(record.amount, 10);
    assert.equal(record.status, 'confirmed');
    assert.equal(record.confirmedBy, 'paymongo');
    assert.equal(record.createdBy, 'kim');
    assert.equal(record.paymongo.chargedAmount, 580);
    assert.equal(record.paymongo.paymentId, 'pay_abc');
    assert.equal(record.paymongo.fee, 2.5);

    const notices = Object.values(getPath('notifications/ana') as Record<string, any>);
    assert.equal(notices.length, 1);
    assert.match(notices[0].body, /Kim Reyes paid you 10\.00 USD/);
  });

  test('a webhook without the right signature is turned away', async () => {
    const raw = JSON.stringify({ data: { attributes: { type: 'checkout_session.payment.paid' } } });
    const { status } = await call('/webhook', {
      method: 'POST',
      headers: { 'paymongo-signature': 't=1,te=forged' },
      body: raw,
    });
    assert.equal(status, 401);
  });

  test('a signed webhook records a payment the app never came back for', async () => {
    const metadata = {
      tripsplit_ref: 'webhookref000001',
      charge_centavos: '5800',
      trip_id: 't1',
      from: 'kim',
      to: 'ana',
      trip_amount: '1',
      currency: 'USD',
      rate: '58',
      kind: 'partial',
    };
    const raw = JSON.stringify({
      data: {
        attributes: {
          type: 'checkout_session.payment.paid',
          livemode: false,
          data: { ...paidCheckout(5800, metadata), id: 'cs_webhook' },
        },
      },
    });
    const t = Math.floor(Date.now() / 1000);
    const te = createHmac('sha256', WEBHOOK_SECRET).update(`${t}.${raw}`).digest('hex');
    const send = () =>
      call('/webhook', {
        method: 'POST',
        headers: { 'paymongo-signature': `t=${t},te=${te},li=` },
        body: raw,
      });

    const first = await send();
    const retry = await send();
    assert.equal(first.body.recorded, true);
    assert.equal(retry.body.recorded, true);

    const record = getPath('trips/t1/settlements/pmwebhookref000001') as any;
    assert.equal(record.amount, 1);
    assert.equal(record.status, 'confirmed');
    assert.equal(Object.keys(getPath('trips/t1/settlements') as object).length, 2);
  });
});
