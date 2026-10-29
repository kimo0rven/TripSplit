import assert from 'node:assert/strict';
import { test } from 'node:test';
import { groupByDay } from '../src/utils/listGrouping.ts';
import { dayHeading } from '../src/utils/money.ts';

test('groups neighbours that share a day', () => {
  const rows = [
    { id: 'a', day: '2026-05-02' },
    { id: 'b', day: '2026-05-02' },
    { id: 'c', day: '2026-05-01' },
  ];

  const groups = groupByDay(rows, (row) => row.day);

  assert.equal(groups.length, 2);
  assert.deepEqual(
    groups[0].items.map((row) => row.id),
    ['a', 'b'],
  );
  assert.deepEqual(
    groups[1].items.map((row) => row.id),
    ['c'],
  );
});

test('one record per day makes one group each', () => {
  const rows = [{ day: '2026-05-03' }, { day: '2026-05-02' }, { day: '2026-05-01' }];

  assert.equal(groupByDay(rows, (row) => row.day).length, 3);
});

test('records with no day land in one unnamed group rather than vanishing', () => {
  const rows = [{ day: '' }, { day: '' }];
  const groups = groupByDay(rows, (row) => row.day);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].day, '');
  assert.equal(groups[0].items.length, 2);
  assert.equal(dayHeading(''), 'No date');
});

test('an empty list has no groups', () => {
  assert.deepEqual(
    groupByDay([], (row: { day: string }) => row.day),
    [],
  );
});

test('today and yesterday get plain words, older days get a date', () => {
  const keyOf = (date: Date) =>
    `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`;

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  assert.equal(dayHeading(keyOf(today)), 'Today');
  assert.equal(dayHeading(keyOf(yesterday)), 'Yesterday');

  const older = new Date(today);
  older.setDate(older.getDate() - 10);
  // A real date rather than a word, so it has a comma before the year.
  assert.match(dayHeading(keyOf(older)), /\d{4}$/);
});

test('undated records never sit above a dated one', () => {
  // A record with no day is grouped under an empty heading, so it has to arrive
  // last. Sorted naively, an empty string compares "less than" every real day
  // and the undated entry takes the top of the list instead.
  const items = [
    { day: '2026-10-23', name: 'today' },
    { day: '', name: 'undated' },
    { day: '2026-10-22', name: 'yesterday' },
  ];

  const sorted = [...items].sort((a, b) => {
    if (a.day === b.day) return 0;
    if (!a.day) return 1;
    if (!b.day) return -1;
    return a.day < b.day ? 1 : -1;
  });

  const groups = groupByDay(sorted, (item) => item.day);
  assert.deepEqual(
    groups.map((group) => group.day),
    ['2026-10-23', '2026-10-22', ''],
  );
  assert.equal(groups[groups.length - 1].items[0].name, 'undated');
});
