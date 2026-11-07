import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  cleanRateText,
  convertedCents,
  rateBetween,
  rateText,
  readOriginal,
} from '../src/utils/foreignAmount.ts';

test('an amount paid abroad converts to the trip currency, to the cent', () => {
  // $50.00 at 56.2 = ₱2,810.00
  assert.equal(convertedCents(5000, 56.2), 281000);
  // ¥1,500 at 0.3871 = ₱580.65
  assert.equal(convertedCents(150000, 0.3871), 58065);
  assert.equal(convertedCents(5000, 0), 0);
});

test('the rate is read from the table, or 0 when missing', () => {
  assert.equal(rateBetween({ PHP: 56.2 }, 'PHP'), 56.2);
  assert.equal(rateBetween({ PHP: 56.2 }, 'EUR'), 0);
  assert.equal(rateBetween(null, 'PHP'), 0);
});

test('rates show sensible decimals, and typing keeps the point', () => {
  assert.equal(rateText(56.203456), '56.2035');
  assert.equal(rateText(0.00631234), '0.006312');
  assert.equal(rateText(1450.123), '1450.12');
  assert.equal(rateText(0), '');
  assert.equal(cleanRateText('56.'), '56.');
  assert.equal(cleanRateText('.5'), '0.5');
  assert.equal(cleanRateText('56,20'), '56.20');
});

test('a saved original is read back, and junk is ignored', () => {
  assert.deepEqual(readOriginal({ currency: 'USD', amount: 50, rate: 56.2 }), {
    currency: 'USD',
    amount: 50,
    rate: 56.2,
  });
  assert.equal(readOriginal({ currency: 'USD', amount: 0, rate: 56.2 }), null);
  assert.equal(readOriginal(null), null);
});

test('what each payer put in abroad is kept, and junk payers dropped', () => {
  assert.deepEqual(
    readOriginal({
      currency: 'USD',
      amount: 50,
      rate: 56.2,
      paidBy: { kim: 30, ana: 20, bad: 'x' },
    }),
    { currency: 'USD', amount: 50, rate: 56.2, paidBy: { kim: 30, ana: 20 } },
  );
});
