import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  choiceFor,
  needsTypedMethod,
  PAYMENT_CHOICES,
  paymentMethodLabel,
  storedPayment,
} from '../src/utils/paymentMethod.ts';

describe('the how-was-it-paid choices', () => {
  test('cash is offered first, with no method text', () => {
    assert.equal(PAYMENT_CHOICES[0].label, 'Cash');
    assert.equal(PAYMENT_CHOICES[0].cash, true);
    assert.equal(PAYMENT_CHOICES[0].value, '');
  });

  test('there is no "Not cash" answer, which was the confusing one', () => {
    assert.equal(
      PAYMENT_CHOICES.some((choice) => /not cash/i.test(choice.label)),
      false,
    );
  });

  test('every choice has a label a person would say out loud', () => {
    for (const choice of PAYMENT_CHOICES) {
      assert.ok(choice.label.length > 0);
      assert.ok(choice.label.length <= 20, `${choice.label} is too long for a chip`);
    }
  });
});

describe('reading a saved payment back into a choice', () => {
  test('a cash payment points at the cash choice', () => {
    assert.equal(choiceFor({ isCash: true })?.label, 'Cash');
  });

  test('only Cash and Other are offered', () => {
    assert.deepEqual(
      PAYMENT_CHOICES.map((choice) => choice.label),
      ['Cash', 'Other'],
    );
  });

  test('an older GCash payment reads back as Other', () => {
    assert.equal(choiceFor({ isCash: false, method: 'GCash' })?.label, 'Other');
  });

  test('an unlisted method falls back to Other, and its words are kept', () => {
    const choice = choiceFor({ isCash: false, method: 'Maya' });
    assert.equal(choice?.label, 'Other');
    assert.equal(needsTypedMethod(choice), true);
  });

  test('a payment with no answer yet points at nothing', () => {
    assert.equal(choiceFor({}), null);
    assert.equal(choiceFor({ isCash: false }), null);
    assert.equal(choiceFor({ isCash: false, method: '   ' }), null);
  });
});

describe('what gets stored', () => {
  test('cash stores the flag and no method text', () => {
    assert.deepEqual(storedPayment(PAYMENT_CHOICES[0], 'ignored'), { isCash: true });
  });

  test('an older method keeps its saved name when edited', () => {
    assert.deepEqual(storedPayment(choiceFor({ isCash: false, method: 'GCash' }), 'GCash'), {
      isCash: false,
      method: 'GCash',
    });
  });

  test('Other keeps the words the person typed', () => {
    const other = PAYMENT_CHOICES.find((choice) => choice.value === 'Other')!;
    assert.deepEqual(storedPayment(other, '  Maya  '), { isCash: false, method: 'Maya' });
  });

  test('Other with nothing typed stores no method, not an empty one', () => {
    const other = PAYMENT_CHOICES.find((choice) => choice.value === 'Other')!;
    assert.deepEqual(storedPayment(other, '   '), { isCash: false });
  });

  test('a round trip keeps a method it started with', () => {
    // The sheet hands the saved name back in, so an edit does not lose it.
    const saved = storedPayment(choiceFor({ isCash: false, method: 'Card' }), 'Card');
    assert.deepEqual(saved, { isCash: false, method: 'Card' });
    assert.equal(choiceFor(saved)?.label, 'Other');
  });
});

describe('how a saved payment is named', () => {
  test('cash reads as cash', () => {
    assert.equal(paymentMethodLabel({ isCash: true }), 'Cash');
  });

  test('a method reads as itself', () => {
    assert.equal(paymentMethodLabel({ isCash: false, method: 'GCash' }), 'GCash');
  });

  test('a payment with nothing recorded says so instead of showing a blank', () => {
    assert.equal(paymentMethodLabel({ isCash: false }), 'Not specified');
    assert.equal(paymentMethodLabel({}), 'Not specified');
  });
});
