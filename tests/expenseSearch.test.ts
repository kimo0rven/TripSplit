import assert from 'node:assert/strict';
import { test } from 'node:test';

import { findExpenses } from '../src/utils/expenseSearch.ts';

const names: Record<string, string> = { kim: 'Kim', ana: 'Ana Reyes' };
const nameOf = (id: string) => names[id] ?? '';
const categoryName = (key: string) => ({ food: 'Food', transport: 'Transport' })[key] ?? 'Other';

const expenses = [
  {
    id: 'a',
    title: 'Dinner at Kanto',
    amount: 900,
    category: 'food',
    spentOn: '2026-11-01',
    paidBy: { kim: 900 },
    shares: { kim: 450, ana: 450 },
  },
  {
    id: 'b',
    title: 'Taxi',
    amount: 250,
    category: 'transport',
    spentOn: '2026-11-02',
    paidBy: { ana: 250 },
    shares: { ana: 250 },
    notes: 'to the airport',
  },
  {
    id: 'c',
    title: 'Café lunch',
    amount: 300,
    category: 'food',
    spentOn: '2026-11-02',
    paidBy: { ana: 300 },
    shares: { kim: 150, ana: 150 },
    items: [{ name: 'Adobo' }],
  },
];

const ids = (list: { id: string }[]) => list.map((item) => item.id);

test('words are found in titles, notes, items, people and categories', () => {
  assert.deepEqual(ids(findExpenses(expenses, { text: 'airport' }, nameOf, categoryName)), ['b']);
  assert.deepEqual(ids(findExpenses(expenses, { text: 'adobo' }, nameOf, categoryName)), ['c']);
  assert.deepEqual(ids(findExpenses(expenses, { text: 'transport' }, nameOf, categoryName)), ['b']);
  // Accents don't matter, and every word must match.
  assert.deepEqual(ids(findExpenses(expenses, { text: 'cafe' }, nameOf, categoryName)), ['c']);
  assert.deepEqual(ids(findExpenses(expenses, { text: 'dinner kim' }, nameOf, categoryName)), [
    'a',
  ]);
  assert.deepEqual(ids(findExpenses(expenses, { text: 'dinner reyes' }, nameOf, categoryName)), [
    'a',
  ]);
});

test('a number finds the amount', () => {
  assert.deepEqual(ids(findExpenses(expenses, { text: '250' }, nameOf, categoryName)), ['b']);
  assert.deepEqual(ids(findExpenses(expenses, { text: '₱900' }, nameOf, categoryName)), ['a']);
});

test('filters combine, and the order can change', () => {
  assert.deepEqual(
    ids(
      findExpenses(
        expenses,
        { category: 'food', sharedWith: 'kim', payerId: 'ana' },
        nameOf,
        categoryName,
      ),
    ),
    ['c'],
  );
  assert.deepEqual(
    ids(findExpenses(expenses, { day: '2026-11-02' }, nameOf, categoryName)).sort(),
    ['b', 'c'],
  );
  assert.deepEqual(ids(findExpenses(expenses, { sort: 'highest' }, nameOf, categoryName)), [
    'a',
    'c',
    'b',
  ]);
  assert.deepEqual(ids(findExpenses(expenses, { sort: 'oldest' }, nameOf, categoryName))[0], 'a');
});
