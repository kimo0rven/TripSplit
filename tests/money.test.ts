import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeBalances, simplifyDebts } from '../src/utils/balance.ts';
import { convertAll } from '../src/utils/convert.ts';
import { nextOccurrence } from '../src/utils/recurrence.ts';
import { filterTrips, sortTrips, tripStatus } from '../src/utils/tripList.ts';
import { spendingHabits, addDebts, biggestExpense, monthChange, monthlyTrend, rangeStart, tripComparison, topBalances } from '../src/utils/stats.ts';
import { splitEqual } from '../src/utils/split.ts';

test('splitEqual always adds back to the total', () => {
  const parts = splitEqual(1000, ['a', 'b', 'c']);
  assert.equal(Object.values(parts).reduce((s, n) => s + n, 0), 1000);
});

test('balances net to zero and debts settle them', () => {
  const expenses: any[] = [{ amount: 90, paidBy: { a: 90 }, shares: { a: 30, b: 30, c: 30 } }];
  const balances = computeBalances(['a', 'b', 'c'], expenses);
  assert.equal(balances.reduce((s, b) => s + b.net, 0), 0);
  const edges = simplifyDebts(balances);
  assert.deepEqual(edges.map((e) => [e.from, e.to, e.amount]).sort(), [['b', 'a', 30], ['c', 'a', 30]]);
});

test('confirmed settlements clear debt, pending ones do not', () => {
  const expenses: any[] = [{ amount: 50, paidBy: { a: 50 }, shares: { a: 25, b: 25 } }];
  const pending: any[] = [{ from: 'b', to: 'a', amount: 25, status: 'pending' }];
  const done: any[] = [{ from: 'b', to: 'a', amount: 25, status: 'confirmed' }];
  assert.equal(computeBalances(['a', 'b'], expenses, pending)[1].net, -25);
  assert.equal(computeBalances(['a', 'b'], expenses, done)[1].net, 0);
});

test('convertAll converts or reports a missing rate', () => {
  assert.equal(convertAll([{ currency: 'USD', amount: 2 }, { currency: 'PHP', amount: 10 }], 'PHP', { USD: 0.5 }), 14);
  assert.equal(convertAll([{ currency: 'EUR', amount: 1 }], 'PHP', {}), null);
});

test('monthly recurrence clamps to the month end and recovers', () => {
  assert.equal(nextOccurrence('2025-01-31', 'monthly', 31), '2025-02-28');
  assert.equal(nextOccurrence('2025-02-28', 'monthly', 31), '2025-03-31');
  assert.equal(nextOccurrence('2025-12-31', 'weekly'), '2026-01-07');
});

const entry = (tripId: string, spentOn: string, amount: number, share: number, currency = 'PHP') => ({
  tripId, tripName: tripId, currency, title: 'x', spentOn, amount, share,
});
const now = new Date(2026, 9, 22);

test('range start and monthly trend cover the right months', () => {
  assert.equal(rangeStart('1m', now), '2026-10-01');
  assert.equal(rangeStart('3m', now), '2026-08-01');
  assert.equal(rangeStart('all', now), '');
  const points = monthlyTrend([entry('a', '2026-10-05', 100, 40), entry('a', '2026-09-30', 50, 20), entry('a', '2026-10-06', 9, 9, 'USD')], 'PHP', now, 3);
  assert.deepEqual(points.map((p) => [p.key, p.total]), [['2026-08', 0], ['2026-09', 20], ['2026-10', 40]]);
  assert.equal(monthChange(points), 1);
  assert.equal(monthChange(monthlyTrend([], 'PHP', now)), null);
});

test('biggest expense and trip comparison', () => {
  const list = [entry('a', '2026-10-01', 500, 100), entry('b', '2026-10-02', 900, 300), entry('b', '2026-10-03', 10, 10)];
  assert.equal(biggestExpense(list, 'PHP')?.amount, 900);
  assert.deepEqual(tripComparison(list).map((t) => [t.tripId, t.share]), [['b', 310], ['a', 100]]);
});

test('debts add up per person across trips', () => {
  const all = {};
  addDebts(all, 'me', 'PHP', { x: 'Xi', y: 'Yo' }, [{ from: 'x', to: 'me', amount: 50 }, { from: 'me', to: 'y', amount: 20 }, { from: 'x', to: 'y', amount: 99 }]);
  addDebts(all, 'me', 'PHP', { x: 'Xi' }, [{ from: 'me', to: 'x', amount: 20 }]);
  assert.deepEqual(topBalances(all, true).map((r) => [r.name, r.amount]), [['Xi', 30]]);
  assert.deepEqual(topBalances(all, false).map((r) => [r.name, r.amount]), [['Yo', -20]]);
});

test('spending habits', () => {
  const h = spendingHabits([entry('a', '2026-10-21', 100, 60), entry('a', '2026-10-21', 10, 10), entry('a', '2026-10-14', 50, 30)], 'PHP');
  assert.equal(h?.count, 3);
  assert.equal(h?.averagePerExpense, 100 / 3);
  assert.equal(h?.averagePerDay, 50);
  assert.equal(h?.busiestWeekday, 'Wednesday');
  assert.deepEqual(h?.priciestDay, { date: '2026-10-21', total: 70 });
  assert.equal(spendingHabits([], 'PHP'), null);
});

test('trip status comes from the dates', () => {
  assert.equal(tripStatus({}, '2026-10-22'), null);
  assert.equal(tripStatus({ startDate: '2026-11-01' }, '2026-10-22'), 'upcoming');
  assert.equal(tripStatus({ startDate: '2026-10-22' }, '2026-10-22'), 'ongoing');
  assert.equal(tripStatus({ startDate: '2026-10-22' }, '2026-10-23'), 'past');
  assert.equal(tripStatus({ startDate: '2026-10-20', endDate: '2026-10-25' }, '2026-10-22'), 'ongoing');
  assert.equal(tripStatus({ startDate: '2026-10-20', endDate: '2026-10-25' }, '2026-10-26'), 'past');
});

test('trip list filter and sort', () => {
  const now = Date.UTC(2026, 9, 22);
  const day = 86400000;
  const trips = [
    { id: 'a', name: 'Bali', createdAt: '2026-01-01', totalSpent: 5, startDate: '2026-01-05', endDate: '2026-01-09' },
    { id: 'b', name: 'Cebu', createdAt: '2026-10-20', totalSpent: 50, startDate: '2026-10-21', endDate: '2026-10-24' },
    { id: 'c', name: 'Aklan', createdAt: '2026-03-01', totalSpent: 1 },
    { id: 'd', name: 'Davao', createdAt: '2026-10-01', totalSpent: 2, startDate: '2026-12-01' },
  ];
  const summaries = {
    a: { lastActivity: now - 60 * day, hasExpenses: true, settled: true },
    b: { lastActivity: now - day, hasExpenses: true, settled: false },
    c: { lastActivity: now - 30 * day, hasExpenses: true, settled: false },
  };
  const base = { query: '', archived: { c: true }, summaries, today: '2026-10-22' };
  const ids = (f: any, extra = {}) => filterTrips(trips, { ...base, filter: f, ...extra }).map((t) => t.id);
  assert.deepEqual(ids('all'), ['a', 'b', 'd']);
  assert.deepEqual(ids('upcoming'), ['d']);
  assert.deepEqual(ids('ongoing'), ['b']);
  assert.deepEqual(ids('past'), ['a']);
  assert.deepEqual(ids('settled'), ['a']);
  assert.deepEqual(ids('archived'), ['c']);
  assert.deepEqual(ids('all', { query: ' CEB' }), ['b']);
  assert.deepEqual(sortTrips(trips, 'name', summaries).map((t) => t.id), ['c', 'a', 'b', 'd']);
  assert.deepEqual(sortTrips(trips, 'spent', summaries).map((t) => t.id), ['b', 'a', 'd', 'c']);
  assert.deepEqual(sortTrips(trips, 'date', summaries).map((t) => t.id), ['a', 'b', 'd', 'c']);
  assert.deepEqual(sortTrips(trips, 'recent', summaries).map((t) => t.id), ['b', 'd', 'c', 'a']);
});
