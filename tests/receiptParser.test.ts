import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { parseReceipt } from '../src/utils/receiptParser.ts';

describe('reading a receipt', () => {
  test('a fast-food receipt: labelled total, not cash or change', () => {
    const result = parseReceipt([
      'JOLLIBEE\nSM City Baguio Branch\nVAT REG TIN 000-123-456-000',
      'OFFICIAL RECEIPT\nDate: 11/05/2026 Time: 12:41',
      '1 Chickenjoy 2pc 189.00\n2 Yum Burger 98.00\n1 Coke Float 55.00',
      'SUBTOTAL 342.00\nVATABLE SALES 305.36\nVAT 36.64',
      'TOTAL AMOUNT DUE 342.00\nCASH 500.00\nCHANGE 158.00',
    ]);
    assert.equal(result.total, 342);
    assert.equal(result.totalFrom, 'label');
    assert.equal(result.date, '2026-11-05');
    assert.equal(result.merchant, 'Jollibee');
  });

  test('a label and its amount split onto two lines', () => {
    const result = parseReceipt(['Cafe Sabel', 'GRAND TOTAL', 'P1,250.50', 'Nov 3, 2026']);
    assert.equal(result.total, 1250.5);
    assert.equal(result.totalFrom, 'label');
    assert.equal(result.date, '2026-11-03');
    assert.equal(result.merchant, 'Cafe Sabel');
  });

  test('the most specific label wins over a plain TOTAL', () => {
    const result = parseReceipt(['TOTAL 1,000.00', 'SERVICE CHARGE 100.00', 'AMOUNT DUE 1,100.00']);
    assert.equal(result.total, 1100);
  });

  test('without any label, the biggest non-cash amount is a guess', () => {
    const result = parseReceipt([
      'Sari-sari store',
      'Rice 52.00',
      'Eggs 96.00',
      '148.00',
      'Cash 200.00',
    ]);
    assert.equal(result.total, 148);
    assert.equal(result.totalFrom, 'largest');
  });

  test('phone numbers and TINs are not read as money', () => {
    const result = parseReceipt(['Tel 0917 123 4567', 'TIN 123-456-789-000', 'TOTAL 75.00']);
    assert.equal(result.total, 75);
  });

  test('dates in other shapes', () => {
    assert.equal(parseReceipt(['2026-10-21 08:15']).date, '2026-10-21');
    assert.equal(parseReceipt(['21/10/2026']).date, '2026-10-21');
    assert.equal(parseReceipt(['05 Nov 2026']).date, '2026-11-05');
    assert.equal(parseReceipt(['02/31/2026']).date, undefined);
  });

  test('nothing readable gives nothing back, never a made-up amount', () => {
    assert.deepEqual(parseReceipt(['', 'THANK YOU', 'Please come again']), {});
    assert.deepEqual(parseReceipt([]), {});
  });

  test('the lines bought, with quantities taken off their names', () => {
    const result = parseReceipt([
      'JOLLIBEE\nSM City Baguio Branch\nVAT REG TIN 000-123-456-000',
      'OFFICIAL RECEIPT\nDate: 11/05/2026 Time: 12:41',
      '1 Chickenjoy 2pc 189.00\n2 Yum Burger 98.00\n1 Coke Float 55.00',
      'SUBTOTAL 342.00\nVATABLE SALES 305.36\nVAT 36.64',
      'TOTAL AMOUNT DUE 342.00\nCASH 500.00\nCHANGE 158.00',
    ]);
    assert.deepEqual(result.items, [
      { name: 'Chickenjoy 2pc', amount: 189 },
      { name: 'Yum Burger', amount: 98 },
      { name: 'Coke Float', amount: 55 },
    ]);
    assert.equal(result.itemsMatchTotal, true);
  });

  test('a price on the line after its name, and a unit price before the line price', () => {
    const result = parseReceipt([
      'Cafe Sabel',
      'Iced Latte',
      '160.00',
      '2x Ensaymada @ 45.00 90.00',
      'GRAND TOTAL',
      'P250.00',
    ]);
    assert.deepEqual(result.items, [
      { name: 'Iced Latte', amount: 160 },
      { name: 'Ensaymada', amount: 90 },
    ]);
    assert.equal(result.itemsMatchTotal, true);
  });

  test('lines that do not add up are still listed, but flagged', () => {
    const result = parseReceipt(['Pares 120.00', 'Rice 20.00', 'TOTAL 160.00']);
    assert.equal(result.items?.length, 2);
    assert.equal(result.itemsMatchTotal, false);
  });

  test('one line alone is not offered as an item split', () => {
    assert.equal(parseReceipt(['Taxi fare 250.00', 'TOTAL 250.00']).items, undefined);
  });
});
