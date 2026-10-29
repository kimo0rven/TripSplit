/**
 * How many characters of a trip name are shown before it is cut short.
 *
 * Trip names are free text, so someone can type a whole sentence. Every screen
 * shows the name on one line beside an icon, a date or an amount, and there the
 * long ones were squeezed or lost their tail inside the layout. Cutting here
 * keeps the line readable and makes the ending the same everywhere.
 */
export const TRIP_NAME_LIMIT = 22;

/**
 * A trip name short enough for one line, ending in "…" when it had to be cut.
 *
 * The cut lands on a whole word when one is close to the limit, so a name reads
 * "Cebu with the family…" rather than "Cebu with the fami…". A name that already
 * fits comes back untouched - no ellipsis, because nothing was hidden.
 */
export const shortName = (name: string | null | undefined, max = TRIP_NAME_LIMIT): string => {
  const clean = (name ?? '').trim();
  if (clean.length <= max) return clean;

  // One character is saved for the ellipsis, so the whole string still fits.
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  // Only take the whole-word cut when it keeps most of the room.
  const body = space > max * 0.6 ? cut.slice(0, space) : cut;

  return body.trimEnd() + '…';
};

/**
 * A short, human reading of a number of bytes.
 *
 * Used by the Settings screen to show how much offline data is on the phone.
 * Kept to whole numbers below 10 and one decimal above, so "1.4 MB" rather
 * than "1.42 MB" — the point is a sense of size, not an exact figure.
 */
export const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';

  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }

  // Bytes are never worth a decimal; a file is 512 B, not 512.0 B.
  if (unit === 0) return `${Math.round(value)} B`;

  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${units[unit]}`;
};
