import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shortName, TRIP_NAME_LIMIT } from '../src/utils/format.ts';

test('a name that fits comes back as it was, with no ellipsis', () => {
  assert.equal(shortName('Boracay'), 'Boracay');
  assert.equal(shortName('x'.repeat(TRIP_NAME_LIMIT)), 'x'.repeat(TRIP_NAME_LIMIT));
});

test('a long name is cut and ends with a single ellipsis', () => {
  const out = shortName('x'.repeat(60));
  assert.equal(out.endsWith('…'), true);
  assert.equal(out.length, TRIP_NAME_LIMIT);
  assert.equal(out.includes('...'), false);
});

test('the cut lands on a whole word when one is close', () => {
  assert.equal(shortName('Cebu with the family and friends'), 'Cebu with the family…');
});

test('a name with no spaces nearby is still cut to fit', () => {
  const out = shortName('Supercalifragilisticexpialidocious');
  assert.equal(out.endsWith('…'), true);
  assert.equal(out.length <= TRIP_NAME_LIMIT, true);
});

test('nothing in, nothing out', () => {
  assert.equal(shortName(''), '');
  assert.equal(shortName(null), '');
  assert.equal(shortName(undefined), '');
});
