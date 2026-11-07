import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { daysOf, isInRange, pickDay, placeInRange, rangeLength } from '../src/utils/dateRange.ts';

describe('picking trip dates on one calendar', () => {
  const empty = { start: '', end: '' };

  test('the first tap is the start, the second the end, which finishes it', () => {
    const first = pickDay(empty, '2026-11-10', 'start');
    assert.deepEqual(first, { range: { start: '2026-11-10', end: '' }, done: false });
    assert.deepEqual(pickDay(first.range, '2026-11-14', 'end'), {
      range: { start: '2026-11-10', end: '2026-11-14' },
      done: true,
    });
  });

  test('an end before the start swaps the two', () => {
    assert.deepEqual(pickDay({ start: '2026-11-10', end: '' }, '2026-11-07', 'end').range, {
      start: '2026-11-07',
      end: '2026-11-10',
    });
  });

  test('tapping the start as the end keeps a one-day trip', () => {
    assert.deepEqual(pickDay({ start: '2026-11-10', end: '' }, '2026-11-10', 'end'), {
      range: { start: '2026-11-10', end: '' },
      done: true,
    });
  });

  test('picking the start again starts over, and the next tap is the new end', () => {
    const full = { start: '2026-11-10', end: '2026-11-14' };
    const restarted = pickDay(full, '2026-12-01', 'start');
    assert.deepEqual(restarted.range, { start: '2026-12-01', end: '' });
    assert.deepEqual(pickDay(restarted.range, '2026-12-05', 'end').range, {
      start: '2026-12-01',
      end: '2026-12-05',
    });
  });

  test('picking an end with no start yet sets the start instead', () => {
    assert.deepEqual(pickDay(empty, '2026-11-10', 'end').range, { start: '2026-11-10', end: '' });
  });
});

describe('drawing the range', () => {
  const range = { start: '2026-11-10', end: '2026-11-14' };

  test('ends, the days between, and the rest', () => {
    assert.equal(placeInRange(range, '2026-11-10'), 'start');
    assert.equal(placeInRange(range, '2026-11-12'), 'inside');
    assert.equal(placeInRange(range, '2026-11-14'), 'end');
    assert.equal(placeInRange(range, '2026-11-15'), 'outside');
    assert.equal(placeInRange({ start: '2026-11-10', end: '' }, '2026-11-10'), 'single');
  });

  test('length counts both ends, across months too', () => {
    assert.equal(rangeLength(range), 5);
    assert.equal(rangeLength({ start: '2026-11-28', end: '2026-12-02' }), 5);
    assert.equal(rangeLength({ start: '2026-11-10', end: '' }), 1);
    assert.equal(rangeLength({ start: '', end: '' }), 0);
  });
});

describe('the days of a trip', () => {
  test('every day, ends included, across a month end', () => {
    assert.deepEqual(daysOf({ start: '2026-11-29', end: '2026-12-02' }), [
      '2026-11-29',
      '2026-11-30',
      '2026-12-01',
      '2026-12-02',
    ]);
    assert.deepEqual(daysOf({ start: '2026-11-10', end: '' }), ['2026-11-10']);
    assert.deepEqual(daysOf({ start: '', end: '' }), []);
  });

  test('a day is inside the trip, or any day is when there are no dates', () => {
    const trip = { start: '2026-11-10', end: '2026-11-14' };
    assert.equal(isInRange(trip, '2026-11-12'), true);
    assert.equal(isInRange(trip, '2026-11-15'), false);
    assert.equal(isInRange({ start: '2026-11-10', end: '' }, '2026-11-11'), false);
    assert.equal(isInRange({ start: '', end: '' }, '2030-01-01'), true);
  });
});
