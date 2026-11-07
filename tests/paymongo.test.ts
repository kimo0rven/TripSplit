import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  paymentOutcomeMessage,
  payMongoMethodLabel,
  cleanReceipt,
  payMongoMethodsLine,
  payMongoPaidWith,
  payMongoReceiptRows,
  readPendingCheckouts,
  payMongoProblem,
  returnResultFromUrl,
  returnUrlFor,
  sessionIdFromUrl,
} from '../src/utils/paymongo.ts';

describe('the way back from a checkout page', () => {
  test('the return link uses the app scheme', () => {
    assert.equal(returnUrlFor(), 'tripsplit://paymongo-return');
  });

  test('a session id is read from a return link', () => {
    assert.equal(
      sessionIdFromUrl('tripsplit://paymongo-return?session_id=abc123&result=paid'),
      'abc123',
    );
  });

  test('a session id is read when it is not the first parameter', () => {
    assert.equal(
      sessionIdFromUrl('tripsplit://paymongo-return?result=paid&session_id=f34e799f'),
      'f34e799f',
    );
  });

  test('a session id is read from the path form', () => {
    assert.equal(sessionIdFromUrl('tripsplit://paymongo-return/deadbeef01'), 'deadbeef01');
  });

  test('a link with no session id gives nothing back', () => {
    assert.equal(sessionIdFromUrl('tripsplit://paymongo-return?result=paid'), null);
    assert.equal(sessionIdFromUrl(''), null);
    assert.equal(sessionIdFromUrl(null), null);
    assert.equal(sessionIdFromUrl(undefined), null);
  });

  test('a hand-typed session id cannot smuggle punctuation in', () => {
    assert.equal(sessionIdFromUrl('tripsplit://paymongo-return?session_id=abc/../etc'), 'abc');
  });
});

describe('what the payer is told', () => {
  test('a paid checkout reads as success', () => {
    const result = paymentOutcomeMessage('paid', '₱250.00');
    assert.equal(result.tone, 'success');
    assert.match(result.message, /₱250\.00/);
  });

  test('a failed or cancelled checkout records nothing and says so', () => {
    assert.equal(paymentOutcomeMessage('failed', '₱1.00').tone, 'error');
    assert.equal(paymentOutcomeMessage('cancelled', '₱1.00').tone, 'muted');
    assert.match(paymentOutcomeMessage('cancelled', '₱1.00').message, /Nothing was recorded/);
  });

  test('a checkout nobody finished is not reported as paid', () => {
    const result = paymentOutcomeMessage('open', '₱10.00');
    assert.notEqual(result.tone, 'success');
    assert.match(result.message, /still waiting/);
  });

  test('an unknown status is never shown as success', () => {
    assert.notEqual(paymentOutcomeMessage(undefined, '₱1.00').tone, 'success');
    assert.notEqual(paymentOutcomeMessage('weird', '₱1.00').tone, 'success');
  });
});

describe('how a PayMongo payment is labelled', () => {
  test('a card payment names its last four digits', () => {
    assert.equal(payMongoMethodLabel('4242'), 'PayMongo card ending 4242');
  });

  test('without a card it is simply PayMongo', () => {
    assert.equal(payMongoMethodLabel(), 'PayMongo');
    assert.equal(payMongoMethodLabel(null), 'PayMongo');
  });
});

describe('what a broken payment service says', () => {
  test('a sleeping server is explained in plain words', () => {
    assert.match(payMongoProblem(new Error('Network request failed')), /Check your connection/);
    assert.match(payMongoProblem(new Error('Failed to fetch')), /Check your connection/);
  });

  test('anything else is passed through instead of hidden', () => {
    assert.equal(payMongoProblem(new Error('PayMongo said 402.')), 'PayMongo said 402.');
    assert.equal(
      payMongoProblem('The server has no PayMongo secret key.'),
      'The server has no PayMongo secret key.',
    );
  });

  test('an empty failure still says something useful', () => {
    assert.match(payMongoProblem(null), /Could not reach the payment service/);
  });
});

describe('a real signed session id survives the round trip', () => {
  // The id is a signed token: base64url body, a dot, then the signature.
  // Matching only letters and numbers cut it from 119 to 75 characters, which
  // made the server reject every payment that came back from the browser.
  const real =
    'eyJpZCI6IjQ4MzdkYjAwZGUyNDQ2ZTIiLCJhbW91bnQiOjI1MDUwLCJ0cmlwIjoiQmFndWlvIn0.DrZ7iM6mH9noj4xY9i0VCdAqEdabd0k5AO-W6sAzwyg';

  test('the whole token is recovered, not a truncated prefix', () => {
    const link = `tripsplit://paymongo-return?session_id=${encodeURIComponent(real)}&result=paid`;
    const got = sessionIdFromUrl(link);
    assert.equal(got, real);
    assert.equal(got?.length, real.length);
  });

  test('a token in the path is recovered whole too', () => {
    assert.equal(sessionIdFromUrl(`tripsplit://paymongo-return/${real}`), real);
  });

  test('a token without extra characters still works', () => {
    assert.equal(sessionIdFromUrl('tripsplit://paymongo-return?session_id=abc123'), 'abc123');
  });
});

describe('explaining a stale deploy', () => {
  test("the gateway's path complaint is turned into the fix, not repeated", () => {
    const message = payMongoProblem(new Error('requested path is invalid'));
    assert.match(message, /out of date/i);
    assert.match(message, /pay:deploy/);
    assert.equal(/requested path/i.test(message), false);
  });

  test('a real network failure still reads as a network failure', () => {
    assert.match(payMongoProblem(new Error('Network request failed')), /connection/i);
  });
});

describe('coming back from PayMongo', () => {
  test('the way back is read from the return link', () => {
    assert.equal(returnResultFromUrl('tripsplit://paymongo-return?result=paid'), 'paid');
    assert.equal(returnResultFromUrl('tripsplit://paymongo-return?result=cancelled'), 'cancelled');
  });

  test('anything else is no answer at all', () => {
    assert.equal(returnResultFromUrl('tripsplit://paymongo-return'), null);
    assert.equal(returnResultFromUrl('tripsplit://paymongo-return?result=hacked'), null);
    assert.equal(returnResultFromUrl(null), null);
  });
});

describe('naming PayMongo methods', () => {
  test('the methods on offer read as a sentence', () => {
    assert.equal(payMongoMethodsLine(['card', 'gcash']), 'Card or GCash');
    assert.equal(payMongoMethodsLine(['card', 'gcash', 'paymaya']), 'Card, GCash or Maya');
    assert.equal(payMongoMethodsLine([]), 'Card or e-wallet');
  });

  test('an e-wallet payment names the wallet', () => {
    assert.equal(payMongoMethodLabel(null, 'gcash'), 'PayMongo GCash');
    assert.equal(payMongoMethodLabel('4242', 'card'), 'PayMongo card ending 4242');
  });
});

describe('the PayMongo receipt on a payment', () => {
  test('empty fields never reach the database', () => {
    assert.deepEqual(
      cleanReceipt({
        method: 'gcash',
        last4: undefined,
        brand: '',
        fee: undefined,
        paymentId: 'pay_1',
      }),
      { method: 'gcash', paymentId: 'pay_1' },
    );
  });

  test('a wallet payment names the wallet, a card names brand and digits', () => {
    assert.equal(payMongoPaidWith({ method: 'gcash' }), 'PayMongo · GCash');
    assert.equal(payMongoPaidWith({ method: 'qrph' }), 'PayMongo · QR Ph');
    assert.equal(
      payMongoPaidWith({ method: 'card', brand: 'visa', last4: '4242' }),
      'PayMongo · Visa •••• 4242',
    );
    assert.equal(payMongoPaidWith(null), 'PayMongo');
  });

  test('the receipt lists the PayMongo ids and the fee', () => {
    const rows = payMongoReceiptRows({
      method: 'gcash',
      paymentId: 'pay_abc',
      checkoutId: 'cs_def',
      fee: 5.5,
    });
    assert.deepEqual(
      rows.map((row) => row.label),
      ['Paid through', 'PayMongo payment', 'Checkout', 'PayMongo fee'],
    );
    assert.equal(rows[3].value, '₱5.50');
  });
});

describe('unfinished checkouts kept on the device', () => {
  const now = 1_800_000_000_000;
  const entry = { sessionId: 'tok', from: 'kim', to: 'ana', amount: 450, startedAt: now - 60_000 };

  test('a saved checkout comes back for its trip', () => {
    const saved = readPendingCheckouts(JSON.stringify({ t1: entry }), now);
    assert.equal(saved.t1.sessionId, 'tok');
    assert.equal(saved.t1.tripId, 't1');
  });

  test('old, broken or missing storage gives nothing back', () => {
    const old = { ...entry, startedAt: now - 3 * 24 * 60 * 60 * 1000 };
    assert.deepEqual(readPendingCheckouts(JSON.stringify({ t1: old }), now), {});
    assert.deepEqual(readPendingCheckouts(JSON.stringify({ t1: { sessionId: 'x' } }), now), {});
    assert.deepEqual(readPendingCheckouts('not json', now), {});
    assert.deepEqual(readPendingCheckouts(null, now), {});
  });

  test('a converted payment shows what PayMongo charged', () => {
    const rows = payMongoReceiptRows({ method: 'gcash', chargedAmount: 580, rate: 58 });
    assert.equal(rows.find((row) => row.label === 'Charged')?.value, '₱580.00 at ₱58.00 each');
  });
});
