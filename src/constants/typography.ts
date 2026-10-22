/**
 * Where the capital letters of Plus Jakarta Sans actually sit.
 *
 * These are measured from the font file itself, not guessed:
 *
 *   - a capital is 0.745 of the font size tall
 *   - the line box is 1.26 of the font size tall, with far more room above the
 *     letters (1.038) than below them (0.222)
 *
 * Because of that lopsided box, a capital centred inside its box sits about
 * 0.0355 of the font size too low. Anything centred by eye - a single letter
 * in a circle - has to be lifted by that amount to look truly centred.
 */
export const CAP_HEIGHT_RATIO = 0.745;
export const CAP_CENTER_OFFSET_RATIO = 0.0355;
