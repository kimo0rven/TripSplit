import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EXPENSE_CATEGORIES, QUICK_CATEGORIES, categoryLabel } from '../src/utils/balance.ts';

test('every category value is unique', () => {
  const values = EXPENSE_CATEGORIES.map((entry) => entry.value);
  assert.equal(new Set(values).size, values.length);
});

test('every category has a label', () => {
  EXPENSE_CATEGORIES.forEach((entry) => {
    assert.equal(typeof entry.label, 'string');
    assert.ok(entry.label.length > 0, `${entry.value} needs a label`);
  });
});

test('the form keeps five everyday chips, and they are the first five', () => {
  assert.equal(QUICK_CATEGORIES.length, 5);
  assert.deepEqual(
    QUICK_CATEGORIES,
    EXPENSE_CATEGORIES.slice(0, 5).map((entry) => entry.value),
  );
});

test('the full list is clearly bigger than the quick row', () => {
  assert.ok(EXPENSE_CATEGORIES.length >= 20);
  assert.ok(EXPENSE_CATEGORIES.length > QUICK_CATEGORIES.length);
});

test('the everyday ones are still offered in the full list', () => {
  const all = EXPENSE_CATEGORIES.map((entry) => entry.value);
  QUICK_CATEGORIES.forEach((value) => assert.ok(all.includes(value), `${value} went missing`));
});

test('a saved category keeps its own name', () => {
  assert.equal(categoryLabel('grocery'), 'Groceries');
  assert.equal(categoryLabel('fuel'), 'Fuel');
  assert.equal(categoryLabel('insurance'), 'Insurance');
});

test('an old or unknown category falls back to Other', () => {
  assert.equal(categoryLabel('food'), 'Food');
  assert.equal(categoryLabel('something-from-2023'), 'Other');
  assert.equal(categoryLabel(undefined), 'Other');
});
