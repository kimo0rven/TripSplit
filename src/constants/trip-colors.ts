/**
 * The colours a trip's icon square can wear.
 *
 * Each pair is a soft background with a dark icon colour of the same family.
 * Bright saturated squares would fight the yellow the app already uses for
 * buttons and the active trip, so these stay in the same muted range.
 */
export interface TripIconColor {
  key: string;
  label: string;
  /** The square behind the icon. */
  background: string;
  /** The icon itself. */
  foreground: string;
}

export const TRIP_ICON_COLORS: TripIconColor[] = [
  { key: 'amber', label: 'Amber', background: '#FED766', foreground: '#333333' },
  { key: 'sky', label: 'Sky', background: '#CFE3FF', foreground: '#14396B' },
  { key: 'mint', label: 'Mint', background: '#D2F0DD', foreground: '#14512F' },
  { key: 'rose', label: 'Rose', background: '#FFD9E0', foreground: '#7A1730' },
  { key: 'lilac', label: 'Lilac', background: '#E4DBFF', foreground: '#3F2A78' },
  { key: 'peach', label: 'Peach', background: '#FFE2C2', foreground: '#7A4210' },
  { key: 'teal', label: 'Teal', background: '#C8F0EE', foreground: '#0F4A47' },
  { key: 'slate', label: 'Slate', background: '#E4E6EB', foreground: '#2B2B33' },
];

/**
 * Trips made before colours existed wear the brand amber, which is what every
 * trip square used to be. Keeping that default means old trips look unchanged.
 */
export const DEFAULT_TRIP_COLOR = 'amber';

/** Finds a colour set, falling back to the default for anything unrecognised. */
export function findTripColor(key?: string): TripIconColor {
  return (
    TRIP_ICON_COLORS.find((choice) => choice.key === key) ??
    TRIP_ICON_COLORS.find((choice) => choice.key === DEFAULT_TRIP_COLOR) ??
    TRIP_ICON_COLORS[0]
  );
}
