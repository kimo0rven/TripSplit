import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { needsEmailVerification, verificationProblem } from '../src/utils/verification.ts';

const from = Date.parse('2026-11-05T06:00:00Z');
const newAccount = { creationTime: 'Thu, 05 Nov 2026 07:00:00 GMT', providerIds: ['password'] };

describe('who has to verify their email', () => {
  test('a new password account must verify', () => {
    assert.equal(needsEmailVerification({ ...newAccount, emailVerified: false }, from), true);
  });

  test('a verified account goes straight in', () => {
    assert.equal(needsEmailVerification({ ...newAccount, emailVerified: true }, from), false);
  });

  test('accounts from before verification arrived are let through', () => {
    const old = { creationTime: 'Mon, 02 Nov 2026 10:00:00 GMT', providerIds: ['password'] };
    assert.equal(needsEmailVerification({ ...old, emailVerified: false }, from), false);
  });

  test('a sign-in that already proves the email is not asked again', () => {
    assert.equal(
      needsEmailVerification(
        { ...newAccount, providerIds: ['google.com'], emailVerified: false },
        from,
      ),
      false,
    );
  });

  test('an unknown creation time is asked, and nobody signed in is not', () => {
    assert.equal(needsEmailVerification({ emailVerified: false, creationTime: null }, from), true);
    assert.equal(needsEmailVerification(null, from), false);
  });
});

describe('verification errors', () => {
  test('too many sends and no connection are explained plainly', () => {
    assert.match(verificationProblem('auth/too-many-requests'), /Wait a few minutes/);
    assert.match(verificationProblem('auth/network-request-failed'), /connection/);
    assert.match(verificationProblem('anything-else'), /try again/);
  });
});

describe('the real cutoff', () => {
  test('an account made this afternoon, right after the change shipped, must verify', () => {
    const justNow = { creationTime: 'Thu, 05 Nov 2026 05:55:00 GMT', providerIds: ['password'] };
    assert.equal(needsEmailVerification({ ...justNow, emailVerified: false }), true);
  });
});
