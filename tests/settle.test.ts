import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  findDuplicatePayment,
  pendingBetween,
  amountFor,
  amountProblem,
  choiceForAmount,
  debtBetween,
  debtsWithMe,
  fullDebtFor,
  halfOf,
  kindFor,
} from '../src/utils/settle.ts';

const edges = [
  { from: 'ana', to: 'kim', amount: 120 },
  { from: 'kim', to: 'ben', amount: 450 },
  { from: 'ana', to: 'ben', amount: 30 },
];
const names = { from: 'Kim', to: 'Ben', money: (value: number) => `₱${value.toFixed(2)}` };

describe('the debts on the Settle up sheet', () => {
  test('your own debts come first, then the ones owed to you, and nobody else', () => {
    assert.deepEqual(
      debtsWithMe(edges, 'kim').map((edge) => `${edge.from}>${edge.to}`),
      ['kim>ben', 'ana>kim'],
    );
  });

  test('the debt between two people reads either way round', () => {
    assert.equal(debtBetween(edges, 'kim', 'ben'), 450);
    assert.equal(debtBetween(edges, 'ben', 'kim'), -450);
    assert.equal(debtBetween(edges, 'kim', 'zoe'), 0);
  });

  test('editing a payment adds its own amount back to the debt', () => {
    const payment = { from: 'kim', to: 'ben', amount: 50 };
    assert.equal(fullDebtFor(400, payment, { from: 'kim', to: 'ben' }), 450);
    assert.equal(fullDebtFor(400, payment, { from: 'kim', to: 'ana' }), 400);
    assert.equal(fullDebtFor(-20, null), 0);
  });
});

describe('the Full, Half and Other amount chips', () => {
  test('each chip stands for its own amount', () => {
    assert.equal(amountFor('full', 450, 0), 450);
    assert.equal(amountFor('half', 450, 0), 225);
    assert.equal(amountFor('custom', 450, 300.456), 300.46);
    assert.equal(halfOf(0.03), 0.02);
  });

  test('an existing amount opens on the chip it matches', () => {
    assert.equal(choiceForAmount(450, 450), 'full');
    assert.equal(choiceForAmount(225, 450), 'half');
    assert.equal(choiceForAmount(300, 450), 'custom');
    assert.equal(choiceForAmount(0, 0), 'custom');
  });

  test('only the whole debt counts as a full settlement', () => {
    assert.equal(kindFor(450, 450), 'full');
    assert.equal(kindFor(300, 450), 'partial');
  });

  test('a typed amount is held to the debt', () => {
    assert.equal(amountProblem(300, 450, names), '');
    assert.equal(amountProblem(450, 450, names), '');
    assert.match(amountProblem(451, 450, names), /only owes Ben ₱450\.00/);
    assert.match(amountProblem(0, 450, names), /greater than zero/);
    assert.match(amountProblem(10, 0, names), /does not owe Ben anything/);
  });
});

describe('spotting a payment recorded twice', () => {
  const now = Date.parse('2026-11-07T10:00:00Z');
  const paid = [
    { id: 'a', from: 'ana', to: 'kim', amount: 500, createdAt: '2026-11-07T09:55:00Z' },
    { id: 'b', from: 'ana', to: 'kim', amount: 200, createdAt: '2026-11-07T09:00:00Z' },
    { id: 'c', from: 'kim', to: 'ana', amount: 500, createdAt: '2026-11-07T09:58:00Z' },
    { id: 'd', from: 'ana', to: 'kim', amount: 500, createdAt: '2026-11-05T09:00:00Z' },
  ];

  test('the same payer, receiver and amount, recorded minutes ago', () => {
    assert.equal(findDuplicatePayment(paid, { from: 'ana', to: 'kim', amount: 500 }, now)?.id, 'a');
  });

  test('a centavo of rounding still matches', () => {
    assert.equal(
      findDuplicatePayment(paid, { from: 'ana', to: 'kim', amount: 500.01 }, now)?.id,
      'a',
    );
  });

  test('a different amount, the other direction, or an old payment is not a repeat', () => {
    assert.equal(findDuplicatePayment(paid, { from: 'ana', to: 'kim', amount: 300 }, now), null);
    assert.equal(
      findDuplicatePayment(paid.slice(1), { from: 'ana', to: 'kim', amount: 500 }, now),
      null,
    );
  });

  test('a declined payment and the payment being edited are left out', () => {
    const declined = [{ ...paid[0], status: 'declined' }];
    assert.equal(
      findDuplicatePayment(declined, { from: 'ana', to: 'kim', amount: 500 }, now),
      null,
    );
    assert.equal(
      findDuplicatePayment(paid, { id: 'a', from: 'ana', to: 'kim', amount: 500 }, now),
      null,
    );
  });
});

test('money waiting for confirmation is counted per pair', () => {
  const payments = [
    { from: 'ana', to: 'kim', amount: 100, status: 'pending' },
    { from: 'ana', to: 'kim', amount: 50.5, status: 'pending' },
    { from: 'ana', to: 'kim', amount: 70, status: 'confirmed' },
    { from: 'ana', to: 'ben', amount: 20, status: 'pending' },
  ];
  assert.equal(pendingBetween(payments, 'ana', 'kim'), 150.5);
  assert.equal(pendingBetween(payments, 'kim', 'ana'), 0);
});
