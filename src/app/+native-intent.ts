/**
 * Rewrites links that arrive from outside the app into a route the app knows.
 *
 * A trip QR now carries an ordinary web link
 * (`https://tripsplit-14f93.web.app/j?code=AB12CD`) so that the phone's own
 * camera can open it. That link has to end up on the join screen with the code
 * filled in, which is what this file does.
 *
 * The friend link (`tripsplit://friend?uid=…`) is always scanned inside the app,
 * so it is left alone.
 */

/** The address the QR codes point at. */
const JOIN_HOSTS = ['tripsplit-14f93.web.app', 'tripsplit-14f93.firebaseapp.com'];

/** Reads one query value out of a link. */
const readParam = (value: string, key: string): string => {
  const match = value.match(new RegExp(`[?&]${key}=([^&\\s]+)`));
  return match ? decodeURIComponent(match[1]) : '';
};

/**
 * Splits a link into its host and path, without the protocol.
 *
 * The split has to treat the first segment as the host even when there is no
 * slash after it, because `tripsplit://join?code=X` uses "join" as its host.
 */
const splitLink = (value: string): { host: string; path: string } => {
  const protocol = value.indexOf('://');

  if (protocol === -1) {
    return { host: '', path: value.replace(/^\/+/, '') };
  }

  const rest = value.slice(protocol + 3);
  const slash = rest.indexOf('/');
  const host = (slash === -1 ? rest : rest.slice(0, slash)).split(/[?#]/)[0].toLowerCase();
  const path = slash === -1 ? '' : rest.slice(slash + 1);

  return { host, path: path.replace(/^\/+/, '') };
};

/** Builds the join screen's address for a code. */
const joinPath = (code: string): string =>
  code ? `/trips/join?code=${encodeURIComponent(code)}` : '/trips/join';

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    if (!path) return '/';

    // A friend QR is always scanned in the app's scanner, so leave it be.
    if (readParam(path, 'uid')) return path;

    const { host, path: route } = splitLink(path);
    const routeName = route.split(/[?#]/)[0].replace(/\/+$/, '');
    // Invite codes are always capital letters.
    const code = readParam(path, 'code').trim().toUpperCase();

    // Already on the join screen: keep it, but tidy the code.
    if (routeName === 'trips/join') return joinPath(code);

    // An old QR: tripsplit://join?code=AB12CD
    if (host === 'join') return joinPath(code);

    // A new QR: https://<site>/j?code=AB12CD, or tripsplit:///j?code=AB12CD
    if (routeName === 'j' && (host === '' || JOIN_HOSTS.includes(host))) return joinPath(code);

    // Someone opened the site's front page rather than a QR link.
    if (!routeName && JOIN_HOSTS.includes(host)) return joinPath(code);

    return path;
  } catch {
    // Never throw here: a bad link should open the app, not crash it.
    return '/';
  }
}
