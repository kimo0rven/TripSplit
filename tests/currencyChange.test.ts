import assert from 'node:assert/strict';
import { test } from 'node:test';

import { convertAmount, convertExpense } from '../src/utils/currencyChange.ts';

const sum = (record: Record<string, number>) =>
  Math.round(Object.values(record).reduce((a, b) => a + b, 0) * 100);

test('every part of a converted expense still adds up to its total', () => {
  const expense = {
    amount: 1000,
    paidBy: { kim: 700, ana: 300 },
    shares: { kim: 333.34, ana: 333.33, ben: 333.33 },
  };
  const usd = convertExpense(expense, 0.0172, 'USD');
  assert.equal(usd.amount, 17.2);
  assert.equal(sum(usd.paidBy), 1720);
  assert.equal(sum(usd.shares), 1720);
});

test('items and a custom split follow the new amounts', () => {
  const expense = {
    amount: 300,
    paidBy: { kim: 300 },
    shares: { kim: 100, ana: 200 },
    items: [
      { id: 'a', name: 'Adobo', amount: 100, sharedBy: ['kim'] },
      { id: 'b', name: 'Lechon', amount: 200, sharedBy: ['ana'] },
    ],
    splitDetail: { mode: 'custom', input: { kim: 100, ana: 200 } },
  };
  const usd = convertExpense(expense, 0.02, 'USD');
  assert.deepEqual(
    usd.items?.map((item) => item.amount),
    [2, 4],
  );
  assert.deepEqual(usd.splitDetail?.input, { kim: 2, ana: 4 });
});

test('an expense first paid in the new currency goes back to exactly what was paid', () => {
  const expense = {
    amount: 2810,
    paidBy: { kim: 1686, ana: 1124 },
    shares: { kim: 1405, ana: 1405 },
    original: { currency: 'USD', amount: 50, rate: 56.2, paidBy: { kim: 30, ana: 20 } },
  };
  const usd = convertExpense(expense, 0.0178, 'USD');
  assert.equal(usd.amount, 50);
  assert.deepEqual(usd.paidBy, { kim: 30, ana: 20 });
  assert.equal(sum(usd.shares), 5000);
  assert.equal(usd.original, null);
});

test('an expense paid in a third currency keeps what was paid, with the rate updated', () => {
  const expense = {
    amount: 580.65,
    paidBy: { kim: 580.65 },
    shares: { kim: 580.65 },
    original: { currency: 'JPY', amount: 1500, rate: 0.3871 },
  };
  const usd = convertExpense(expense, 0.0172, 'USD');
  assert.equal(usd.original?.amount, 1500);
  assert.equal(usd.original?.rate, 0.006658);
});

test('single amounts convert to the cent', () => {
  assert.equal(convertAmount(15000, 0.0172), 258);
  assert.equal(convertAmount(99.99, 56.2), 5619.44);
});
