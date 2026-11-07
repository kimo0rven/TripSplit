import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  budgetLine,
  categorySlices,
  chartDays,
  dailyBars,
  dayPartOf,
  daysBetween,
  niceCeiling,
  OTHER_KEY,
  settleProgress,
  timeGrid,
  topCategories,
} from '../src/utils/charts.ts';

const expenses = [
  {
    amount: 900,
    category: 'stay',
    spentOn: '2026-11-01',
    spentTime: '15:00',
    paidBy: { kim: 900 },
    shares: { kim: 450, ana: 450 },
  },
  {
    amount: 300,
    category: 'food',
    spentOn: '2026-11-01',
    spentTime: '19:30',
    paidBy: { ana: 300 },
    shares: { kim: 150, ana: 150 },
  },
  {
    amount: 200,
    category: 'food',
    spentOn: '2026-11-02',
    spentTime: '08:00',
    paidBy: { kim: 200 },
    shares: { kim: 100, ana: 100 },
  },
  {
    amount: 50,
    category: 'tips',
    spentOn: '2026-11-03',
    paidBy: { kim: 50 },
    shares: { kim: 25, ana: 25 },
  },
];

test('the chart covers the trip dates, stretched to any expense outside them', () => {
  assert.deepEqual(daysBetween('2026-10-30', '2026-11-02'), [
    '2026-10-30',
    '2026-10-31',
    '2026-11-01',
    '2026-11-02',
  ]);
  assert.deepEqual(chartDays({ startDate: '2026-11-01', endDate: '2026-11-02' }, expenses), [
    '2026-11-01',
    '2026-11-02',
    '2026-11-03',
  ]);
  assert.equal(chartDays({}, []).length, 0);
});

test('each day is a bar, split by the biggest categories, with the rest as Other', () => {
  const top = topCategories(expenses, 2);
  assert.deepEqual(top, ['stay', 'food']);
  const bars = dailyBars(expenses, ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04'], top);
  assert.deepEqual(bars[0], {
    day: '2026-11-01',
    total: 1200,
    parts: [
      { key: 'stay', amount: 900 },
      { key: 'food', amount: 300 },
    ],
  });
  assert.deepEqual(bars[2].parts, [{ key: OTHER_KEY, amount: 50 }]);
  assert.equal(bars[3].total, 0);
});

test('the donut adds up to the whole', () => {
  const slices = categorySlices(expenses, ['stay']);
  assert.equal(slices.length, 2);
  assert.equal(Math.round(slices.reduce((sum, slice) => sum + slice.fraction, 0) * 1000), 1000);
  assert.deepEqual(categorySlices([], ['stay']), []);
});

test('spending climbs day by day, with a forecast at the pace so far', () => {
  const days = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04'];
  const line = budgetLine(expenses, days, '2026-11-02');
  assert.deepEqual(
    line.spent.map((point) => point.total),
    [1200, 1400],
  );
  // 1400 over 2 days is 700 a day; 2 days left makes 2800.
  assert.equal(line.forecast, 2800);
  assert.equal(budgetLine(expenses, days, '2026-12-01').forecast, null);
});

test('times fall into parts of the day, and untimed expenses are counted', () => {
  assert.equal(dayPartOf('08:00'), 'morning');
  assert.equal(dayPartOf('12:00'), 'afternoon');
  assert.equal(dayPartOf('20:59'), 'evening');
  assert.equal(dayPartOf('02:00'), 'night');
  assert.equal(dayPartOf(''), null);
  const grid = timeGrid(expenses, ['2026-11-01', '2026-11-02', '2026-11-03']);
  assert.deepEqual(grid.cells[0], [0, 900, 300, 0]);
  assert.equal(grid.max, 900);
  assert.equal(grid.untimed, 1);
});

test('settling up shows what is still owed and what was paid back', () => {
  const payments = [{ from: 'ana', to: 'kim', amount: 300, settledOn: '2026-11-02' }];
  const points = settleProgress(expenses, payments, ['2026-11-01', '2026-11-02'], '2026-11-02');
  // Day 1: kim paid 900 and owes 600 → kim is owed 300.
  assert.deepEqual(points[0], { day: '2026-11-01', outstanding: 300, paidBack: 0 });
  // Day 2: kim +100 more, then ana pays 300 back → kim is owed 100.
  assert.deepEqual(points[1], { day: '2026-11-02', outstanding: 100, paidBack: 300 });
});

test('chart tops are round numbers', () => {
  assert.equal(niceCeiling(830), 1000);
  assert.equal(niceCeiling(2100), 2500);
  assert.equal(niceCeiling(0), 1);
});
