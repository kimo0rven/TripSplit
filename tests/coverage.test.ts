import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { coverageFor, previewCoverage } from '../src/utils/coverage.ts';

// Kim paid for dinner and the van; Ben paid for the hotel. Ana paid nothing.
const expenses = [
  {
    id: 'dinner',
    title: 'Dinner',
    spentOn: '2026-11-01',
    paidBy: { kim: 300 },
    shares: { kim: 100, ana: 100, ben: 100 },
  },
  {
    id: 'hotel',
    title: 'Hotel',
    spentOn: '2026-11-02',
    paidBy: { ben: 900 },
    shares: { kim: 300, ana: 300, ben: 300 },
  },
  {
    id: 'van',
    title: 'Van',
    spentOn: '2026-11-03',
    paidBy: { kim: 600 },
    shares: { kim: 200, ana: 200, ben: 200 },
  },
];

const titles = (list: { title: string; covered: number }[]) =>
  list.map((item) => `${item.title} ${item.covered}`);

describe('which expenses a payment pays for', () => {
  test("with nothing paid yet, all of Ana's shares are open, oldest first", () => {
    const { open } = coverageFor('ana', expenses, []);
    assert.deepEqual(titles(open), ['Dinner 100', 'Hotel 300', 'Van 200']);
  });

  test('a payment pays the oldest shares first, splitting the last one it reaches', () => {
    const preview = previewCoverage(coverageFor('ana', expenses, []).open, 250);
    assert.deepEqual(titles(preview), ['Dinner 100', 'Hotel 150']);
    assert.equal(preview[1].share, 300);
  });

  test('a recorded payment keeps what it paid for, and the rest stays open', () => {
    const settlements = [
      { id: 'p1', from: 'ana', to: 'kim', amount: 250, createdAt: '2026-11-04' },
    ];
    const { byPayment, open } = coverageFor('ana', expenses, settlements);
    assert.deepEqual(titles(byPayment.p1), ['Dinner 100', 'Hotel 150']);
    assert.deepEqual(titles(open), ['Hotel 150', 'Van 200']);
  });

  test("paying for others' bills pays off your own shares first", () => {
    // Ben paid the 900 hotel, 600 more than his 300 share: it covers his
    // 100 dinner and 200 van shares, so Ben owes nothing on any expense.
    const { open } = coverageFor('ben', expenses, []);
    assert.deepEqual(open, []);
  });

  test('a declined payment pays for nothing', () => {
    const settlements = [{ id: 'p1', from: 'ana', to: 'kim', amount: 600, status: 'declined' }];
    const { byPayment, open } = coverageFor('ana', expenses, settlements);
    assert.equal(byPayment.p1, undefined);
    assert.equal(open.length, 3);
  });

  test('payments are used in the order they were made', () => {
    const settlements = [
      { id: 'later', from: 'ana', to: 'kim', amount: 200, createdAt: '2026-11-06' },
      { id: 'first', from: 'ana', to: 'ben', amount: 300, createdAt: '2026-11-05' },
    ];
    const { byPayment } = coverageFor('ana', expenses, settlements);
    assert.deepEqual(titles(byPayment.first), ['Dinner 100', 'Hotel 200']);
    assert.deepEqual(titles(byPayment.later), ['Hotel 100', 'Van 100']);
  });
});
