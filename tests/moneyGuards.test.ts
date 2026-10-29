import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateSplit } from '../src/utils/split.ts';

/**
 * The split has to add up to the bill in whole cents.
 *
 * Every balance in the app is paid minus owed, and those must cancel out to
 * exactly zero. Allowing a cent of slack let a split total a cent more than the
 * bill, which leaves one member shown as owing money that nobody is owed - and
 * nothing later in the app can repair it, because no record is wrong on its own.
 */

test('a custom split one cent under the bill is rejected', () => {
  const ids = ['m0', 'm1'];
  const result = validateSplit('custom', 10000, ids, { m0: 50, m1: 49.99 });
  assert.equal(result.ok, false);
});

test('a custom split one cent over the bill is rejected', () => {
  const ids = ['m0', 'm1'];
  const result = validateSplit('custom', 10000, ids, { m0: 50, m1: 50.01 });
  assert.equal(result.ok, false);
});

test('a custom split that matches the bill exactly is accepted', () => {
  const ids = ['m0', 'm1'];
  const result = validateSplit('custom', 10000, ids, { m0: 50, m1: 50 });
  assert.equal(result.ok, true);
});

test('an odd centavo still divides exactly: 99.99 across three', () => {
  const ids = ['m0', 'm1', 'm2'];
  const result = validateSplit('custom', 9999, ids, {
    m0: 33.33,
    m1: 33.33,
    m2: 33.33,
  });
  assert.equal(result.ok, true);
});

test('percentages that miss 100 by a whole percent are rejected', () => {
  const ids = ['m0', 'm1'];
  const result = validateSplit('percentage', 10000, ids, { m0: 50, m1: 40 });
  assert.equal(result.ok, false);
});

test('percentages of 33.33 twice and 33.34 once are accepted', () => {
  const ids = ['m0', 'm1', 'm2'];
  const result = validateSplit('percentage', 10000, ids, { m0: 33.33, m1: 33.33, m2: 33.34 });
  assert.equal(result.ok, true);
});

test('a one-cent bill split onto one person stays one cent', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  const values = { a: 0.01, b: 0, c: 0, d: 0, e: 0, f: 0, g: 0 };
  const result = validateSplit('custom', 1, ids, values);
  assert.equal(result.ok, true);
});
