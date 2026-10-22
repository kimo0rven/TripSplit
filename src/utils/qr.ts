/**
 * QR payloads used across the app.
 *
 * We encode a small link (not a bare code) so a QR can say *what* it is:
 *   https://tripsplit-14f93.web.app/j?code=AB12CD  -> join a trip
 *   tripsplit://friend?uid=abc123                  -> add a friend
 *
 * The trip QR uses an https link on purpose: any phone camera can open that one,
 * and the page it lands on hands the code back to the app. The scanner in
 * src/app/scan.tsx still reads the older `tripsplit://` trip links too, so QRs
 * shared before this change keep working.
 */

export type QrPayload =
  | { type: 'trip'; code: string }
  | { type: 'friend'; uid: string }
  | { type: 'unknown'; raw: string };

/**
 * Where a QR points so that *any* camera can open it.
 *
 * This is the Firebase Hosting site's address. The page at /j on that site
 * forwards the code to the app (see public/index.html), and the app rewrites
 * the incoming link to the join screen (see src/app/+native-intent.ts).
 */
export const JOIN_QR_ORIGIN = 'https://tripsplit-14f93.web.app';

export const buildTripQr = (code: string): string =>
  `${JOIN_QR_ORIGIN}/j?code=${encodeURIComponent(code)}`;

export const buildFriendQr = (uid: string): string => `tripsplit://friend?uid=${uid}`;

/** Reads the first value of a query param out of a link-like string. */
const readParam = (value: string, key: string): string => {
  const match = value.match(new RegExp(`[?&]${key}=([^&\\s]+)`));
  return match ? decodeURIComponent(match[1]) : '';
};

export const parseQrPayload = (raw: string): QrPayload => {
  const value = (raw || '').trim();
  if (!value) return { type: 'unknown', raw: value };

  // Friend link.
  const uid = readParam(value, 'uid');
  if (uid) {
    return { type: 'friend', uid };
  }

  // Trip link.
  const code = readParam(value, 'code');
  if (code) {
    return { type: 'trip', code: code.toUpperCase() };
  }

  // A link whose last segment is the code, e.g. "tripsplit://join/AB12CD".
  if (value.includes('://')) {
    const parts = value.split(/[/?#]/).filter(Boolean);
    const last = parts[parts.length - 1] || '';
    if (last) return { type: 'trip', code: last.toUpperCase() };
  }

  // A bare invite code typed straight into the QR.
  return { type: 'trip', code: value.toUpperCase() };
};
