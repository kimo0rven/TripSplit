/**
 * Who has to verify their email before using the app.
 *
 * Kept free of imports so it can be tested with `node --test`.
 */

/**
 * Accounts made before email verification arrived are let through as they
 * are, so nobody already using the app is locked out. Every account made from
 * this moment on has to verify. Set it to 0 to make everyone verify.
 */
// 1:00 PM Manila time on Nov 5, 2026, before verification shipped. It must be
// in the past: a later time lets anyone who signs up before it skip verifying.
export const VERIFICATION_REQUIRED_FROM = Date.parse('2026-11-05T05:00:00Z');

/** How long "Resend email" waits between sends, so the inbox is not flooded. */
export const RESEND_COOLDOWN_SECONDS = 60;

export interface VerifiableUser {
  emailVerified?: boolean;
  /** Firebase's `metadata.creationTime`, e.g. "Thu, 05 Nov 2026 06:30:00 GMT". */
  creationTime?: string | null;
  /** Firebase's `providerData[].providerId`, e.g. ["password"]. */
  providerIds?: string[];
}

/** True when this signed-in person must verify their email before going on. */
export const needsEmailVerification = (
  user: VerifiableUser | null | undefined,
  requiredFrom: number = VERIFICATION_REQUIRED_FROM,
): boolean => {
  if (!user || user.emailVerified) return false;
  // Google or Apple sign-in already proves the email; only passwords need it.
  const providers = user.providerIds ?? [];
  if (providers.length > 0 && !providers.includes('password')) return false;
  const created = Date.parse(user.creationTime ?? '');
  // An unknown creation time is treated as new: better to ask than to skip.
  if (Number.isNaN(created)) return true;
  return created >= requiredFrom;
};

/** Firebase's verification errors, in words a person can act on. */
export const verificationProblem = (code: string | null | undefined): string => {
  switch (code) {
    case 'auth/too-many-requests':
      return 'Too many emails were sent just now. Wait a few minutes, then try again.';
    case 'auth/network-request-failed':
      return 'Could not reach the internet. Check your connection and try again.';
    case 'auth/user-token-expired':
    case 'auth/user-disabled':
    case 'auth/user-not-found':
      return 'Your sign-in has expired. Sign out and sign in again.';
    default:
      return 'Something went wrong. Please try again.';
  }
};
