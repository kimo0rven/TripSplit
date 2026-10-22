/**
 * The colours a letter avatar can wear.
 *
 * Each pair is a soft background with a dark foreground of the same family, so
 * one big letter stays readable at the small sizes faces are drawn at.
 */
export interface AvatarColor {
  /** The circle behind the letter. */
  background: string;
  /** The letter itself. */
  foreground: string;
}

export const AVATAR_COLORS: AvatarColor[] = [
  { background: '#FED766', foreground: '#3A2E00' }, // brand amber
  { background: '#CFE3FF', foreground: '#14396B' }, // sky
  { background: '#D2F0DD', foreground: '#14512F' }, // mint
  { background: '#FFD9E0', foreground: '#7A1730' }, // rose
  { background: '#E4DBFF', foreground: '#3F2A78' }, // lilac
  { background: '#FFE2C2', foreground: '#7A4210' }, // peach
  { background: '#C8F0EE', foreground: '#0F4A47' }, // teal
  { background: '#E4E6EB', foreground: '#2B2B33' }, // slate
];

/**
 * Picks one of the eight colours for a person.
 *
 * The same name always lands on the same colour. That looks random down a list
 * of people, but a face keeps its colour between screens and between visits -
 * a colour that changed every time would be no help at all in telling two
 * people apart.
 */
export function avatarColorFor(seed?: string): AvatarColor {
  const text = (seed ?? '').trim().toLowerCase();
  if (!text) return AVATAR_COLORS[0];

  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    // `>>> 0` keeps the number positive, so the index below can never go
    // negative and pick nothing.
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }

  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
