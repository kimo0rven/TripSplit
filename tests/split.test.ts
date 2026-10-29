import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  computeBalances,
  computeTripTotals,
  debtBetween,
  simplifyDebts,
} from '../src/utils/balance.ts';
import {
  balanceValues,
  computeShares,
  percentTotal,
  splitByWeights,
  splitEqual,
  validateSplit,
} from '../src/utils/split.ts';

const sum = (record: Record<string, number>) => Object.values(record).reduce((s, n) => s + n, 0);

/* ------------------------------------------------------------------ *
 * splitEqual
 * ------------------------------------------------------------------ */

test('splitEqual hands every leftover cent out, never losing one', () => {
  // 1000 cents over 3 = 333 + 333 + 334
  const parts = splitEqual(1000, ['a', 'b', 'c']);
  assert.equal(sum(parts), 1000);
  assert.deepEqual(parts, { a: 334, b: 333, c: 333 });

  // One cent over 3 must not vanish.
  const tiny = splitEqual(1, ['a', 'b', 'c']);
  assert.equal(sum(tiny), 1);
  assert.equal(Object.values(tiny).filter((n) => n === 1).length, 1);
});

test('splitEqual holds up across many totals and member counts', () => {
  for (let total = 0; total <= 500; total += 7) {
    for (let count = 1; count <= 9; count += 1) {
      const ids = Array.from({ length: count }, (_, i) => `m${i}`);
      const parts = splitEqual(total, ids);
      assert.equal(sum(parts), total, `total ${total} over ${count}`);
      // Every share is within one cent of every other.
      const values = Object.values(parts);
      assert.ok(Math.max(...values) - Math.min(...values) <= 1, `uneven at ${total}/${count}`);
    }
  }
});

test('splitEqual returns nothing for an empty group or a zero total', () => {
  assert.deepEqual(splitEqual(1000, []), {});
  assert.deepEqual(splitEqual(0, ['a', 'b']), {});
  assert.deepEqual(splitEqual(-50, ['a']), {});
});

/* ------------------------------------------------------------------ *
 * splitByWeights
 * ------------------------------------------------------------------ */

test('splitByWeights keeps the total while honouring the weights', () => {
  // 33.33 / 33.33 / 33.34 percent of 1000 cents.
  const parts = splitByWeights(1000, { a: 33.33, b: 33.33, c: 33.34 });
  assert.equal(sum(parts), 1000);
  assert.deepEqual(parts, { a: 333, b: 333, c: 334 });
});

test('splitByWeights ignores zero and junk weights', () => {
  const parts = splitByWeights(900, { a: 1, b: 0, c: Number.NaN, d: 2 });
  assert.equal(sum(parts), 900);
  assert.equal(parts.b, undefined);
  assert.equal(parts.c, undefined);
  assert.deepEqual(parts, { a: 300, d: 600 });
});

test('splitByWeights survives a weight set that rounds awkwardly', () => {
  // Three equal thirds of 100 cents: floor gives 33 each, one cent left over.
  const parts = splitByWeights(100, { a: 1, b: 1, c: 1 });
  assert.equal(sum(parts), 100);
  assert.equal(Object.values(parts).filter((n) => n === 34).length, 1);
});

test('splitByWeights returns nothing when nobody can take a share', () => {
  assert.deepEqual(splitByWeights(1000, {}), {});
  assert.deepEqual(splitByWeights(1000, { a: 0, b: -1 }), {});
  assert.deepEqual(splitByWeights(0, { a: 1 }), {});
});

/* ------------------------------------------------------------------ *
 * computeShares
 * ------------------------------------------------------------------ */

test('computeShares equal mode matches splitEqual', () => {
  const shares = computeShares('equal', 999, ['a', 'b', 'c']);
  assert.equal(sum(shares), 999);
  assert.deepEqual(shares, splitEqual(999, ['a', 'b', 'c']));
});

test('computeShares percentage mode treats 0 percent as not taking part', () => {
  const shares = computeShares('percentage', 1000, ['a', 'b', 'c'], { a: 50, b: 50, c: 0 });
  assert.equal(sum(shares), 1000);
  assert.equal(shares.c, undefined);
  assert.deepEqual(shares, { a: 500, b: 500 });
});

test('computeShares custom mode converts currency to cents and skips blanks', () => {
  const shares = computeShares('custom', 1000, ['a', 'b', 'c'], { a: 2.5, b: 7.5, c: 0 });
  assert.deepEqual(shares, { a: 250, b: 750 });
  assert.equal(sum(shares), 1000);
});

/* ------------------------------------------------------------------ *
 * validateSplit
 * ------------------------------------------------------------------ */

test('validateSplit rejects percentages that do not total 100', () => {
  assert.equal(validateSplit('percentage', 1000, ['a', 'b'], { a: 60, b: 30 }).ok, false);
  assert.equal(validateSplit('percentage', 1000, ['a', 'b'], { a: 60, b: 40 }).ok, true);
  // 33.33 x 3 is close enough to 100 to be allowed through.
  assert.equal(
    validateSplit('percentage', 1000, ['a', 'b', 'c'], { a: 33.33, b: 33.33, c: 33.33 }).ok,
    true,
  );
});

test('validateSplit rejects custom amounts that miss the total', () => {
  assert.equal(validateSplit('custom', 1000, ['a', 'b'], { a: 2, b: 5 }).ok, false);
  assert.equal(validateSplit('custom', 1000, ['a', 'b'], { a: 4, b: 6 }).ok, true);
});

test('validateSplit guards the basics', () => {
  assert.equal(validateSplit('equal', 0, ['a']).ok, false);
  assert.equal(validateSplit('equal', -5, ['a']).ok, false);
  assert.equal(validateSplit('equal', 100, []).ok, false);
  assert.equal(validateSplit('equal', 100, ['a']).ok, true);
  assert.equal(validateSplit('percentage', 100, ['a'], {}).ok, false);
});

/* ------------------------------------------------------------------ *
 * helpers
 * ------------------------------------------------------------------ */

test('percentTotal adds the typed percentages', () => {
  assert.equal(percentTotal(['a', 'b'], { a: 25, b: 75 }), 100);
  assert.equal(percentTotal(['a', 'b'], { a: 33.33, b: 33.33 }), 66.66);
  assert.equal(percentTotal(['a'], {}), 0);
});

test('balanceValues fills in what the edited member still owes', () => {
  const percent = balanceValues('percentage', 1000, ['a', 'b', 'c'], { a: 0, b: 30, c: 10 }, 'a');
  assert.equal(percent.a, 60);

  // With nobody else taking a share, the anchor takes all of it.
  const alone = balanceValues('percentage', 1000, ['a', 'b'], { a: 0, b: 0 }, 'a');
  assert.equal(alone.a, 100);

  const custom = balanceValues('custom', 1000, ['a', 'b'], { a: 0, b: 3 }, 'a');
  assert.equal(custom.a, 7);

  // Never dips below zero even if the others overshoot.
  const over = balanceValues('custom', 1000, ['a', 'b'], { a: 0, b: 99 }, 'a');
  assert.equal(over.a, 0);
});

/* ------------------------------------------------------------------ *
 * computeBalances
 * ------------------------------------------------------------------ */

test('balances net to zero even with several payers on one expense', () => {
  const expenses: any[] = [{ amount: 100, paidBy: { a: 60, b: 40 }, shares: { a: 50, b: 50 } }];
  const balances = computeBalances(['a', 'b'], expenses);
  assert.equal(Math.round(balances.reduce((s, x) => s + x.net, 0) * 100), 0);

  const byId = Object.fromEntries(balances.map((x) => [x.memberId, x]));
  assert.equal(byId.a.net, 10); // paid 60, owes 50
  assert.equal(byId.b.net, -10); // paid 40, owes 50
});

test('balances stay exact across many cent-level expenses', () => {
  const expenses: any[] = Array.from({ length: 100 }, () => ({
    amount: 10.01,
    paidBy: { a: 10.01 },
    shares: { a: 3.34, b: 3.34, c: 3.33 },
  }));
  const balances = computeBalances(['a', 'b', 'c'], expenses);
  assert.equal(Math.round(balances.reduce((s, x) => s + x.net, 0) * 100), 0);
});

test('a rejected settlement is ignored, a confirmed one clears debt', () => {
  const expenses: any[] = [{ amount: 100, paidBy: { a: 100 }, shares: { a: 50, b: 50 } }];
  const rejected: any[] = [{ from: 'b', to: 'a', amount: 50, status: 'rejected' }];
  const balances = computeBalances(['a', 'b'], expenses, rejected);
  const byId = Object.fromEntries(balances.map((x) => [x.memberId, x]));
  assert.equal(byId.b.net, -50);
});

test('trip totals add spent and settled separately', () => {
  const expenses: any[] = [
    { amount: 100, paidBy: { a: 100 }, shares: { a: 50, b: 50 } },
    { amount: 50, paidBy: { b: 50 }, shares: { a: 25, b: 25 } },
  ];
  const settlements: any[] = [{ from: 'b', to: 'a', amount: 20, status: 'confirmed' }];
  const totals = computeTripTotals(['a', 'b'], expenses, settlements);
  assert.equal(totals.spent, 150);
  assert.equal(totals.settled, 20);
  assert.equal(Math.round(totals.balances.reduce((s, x) => s + x.net, 0) * 100), 0);
});

/* ------------------------------------------------------------------ *
 * simplifyDebts
 * ------------------------------------------------------------------ */

test('simplifyDebts never needs more than members minus one payments', () => {
  const expenses: any[] = [
    { amount: 60, paidBy: { a: 60 }, shares: { a: 10, b: 10, c: 10, d: 10, e: 10, f: 10 } },
  ];
  const balances = computeBalances(['a', 'b', 'c', 'd', 'e', 'f'], expenses);
  const edges = simplifyDebts(balances);
  assert.ok(edges.length <= 5, `got ${edges.length} edges for 6 members`);
  assert.equal(sum(Object.fromEntries(edges.map((e, i) => [i, Math.round(e.amount * 100)]))), 5000);
});

test('simplifyDebts clears the full debt with no leftovers', () => {
  const expenses: any[] = [{ amount: 90, paidBy: { a: 90 }, shares: { a: 30, b: 30, c: 30 } }];
  const edges = simplifyDebts(computeBalances(['a', 'b', 'c'], expenses));
  const paidOut: Record<string, number> = {};
  edges.forEach((e) => {
    paidOut[e.from] = (paidOut[e.from] ?? 0) + e.amount;
    paidOut[e.to] = (paidOut[e.to] ?? 0) - e.amount;
  });
  // After settling, nobody is left owed or owing.
  assert.deepEqual(paidOut, { a: -60, b: 30, c: 30 });
});

test('simplifyDebts returns nothing when everyone is square', () => {
  const expenses: any[] = [{ amount: 100, paidBy: { a: 50, b: 50 }, shares: { a: 50, b: 50 } }];
  assert.deepEqual(simplifyDebts(computeBalances(['a', 'b'], expenses)), []);
});

test('debtBetween reads the direction of a debt', () => {
  const edges = [{ from: 'b', to: 'a', amount: 25 }];
  assert.equal(debtBetween(edges, 'b', 'a'), 25);
  assert.equal(debtBetween(edges, 'a', 'b'), -25);
  assert.equal(debtBetween(edges, 'a', 'c'), 0);
});
