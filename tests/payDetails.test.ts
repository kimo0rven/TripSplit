import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  cleanPayMethods,
  formatPayNumber,
  payMethodProblem,
  payMethodTitle,
} from '../src/utils/payDetails.ts';

const gcash = { id: 'a', kind: 'gcash' as const, accountName: 'Kim V.', number: '09171234567' };

test('a mobile number reads in groups', () => {
  assert.equal(formatPayNumber(gcash), '0917 123 4567');
  assert.equal(formatPayNumber({ kind: 'maya', number: '+63 917 123 4567' }), '0917 123 4567');
  assert.equal(formatPayNumber({ kind: 'bank', number: '1234-5678-90' }), '1234-5678-90');
});

test('the title is the bank or service when given', () => {
  assert.equal(payMethodTitle(gcash), 'GCash');
  assert.equal(payMethodTitle({ kind: 'bank', provider: 'BPI' }), 'BPI');
  assert.equal(payMethodTitle({ kind: 'other' }), 'Other');
});

test('problems are caught before saving', () => {
  assert.equal(payMethodProblem(gcash), '');
  assert.match(payMethodProblem({ ...gcash, number: '12345' }), /mobile number/);
  assert.match(payMethodProblem({ ...gcash, number: '', qrUrl: undefined }), /number or a QR/);
  assert.match(
    payMethodProblem({ id: 'b', kind: 'bank', accountName: 'K', number: '1' }),
    /which bank/,
  );
  assert.match(payMethodProblem({ ...gcash, accountName: ' ' }), /name on the account/);
  assert.equal(payMethodProblem({ ...gcash, number: '', qrUrl: 'https://x/qr.png' }), '');
});

test('stored methods are cleaned, whatever shape they come in', () => {
  assert.deepEqual(cleanPayMethods({ x: { ...gcash, accountName: ' Kim V. ' } }), [gcash]);
  assert.deepEqual(cleanPayMethods([{ id: 'z', kind: 'crypto', number: '1' }, null, 'junk']), []);
  assert.deepEqual(cleanPayMethods(null), []);
});
