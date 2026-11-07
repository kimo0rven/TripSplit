/**
 * Reads the useful parts out of a receipt's recognised text: the total, the
 * date and the store's name. The text comes from on-device OCR, which hands
 * back blocks of lines in no guaranteed order, so this works line by line and
 * says how sure it is.
 *
 * Kept free of imports so it can be tested with `node --test`.
 */

export interface ParsedReceipt {
  /** The amount to pay, in pesos (or the receipt's currency), when found. */
  total?: number;
  /**
   * How the total was found: 'label' = next to a word like TOTAL or AMOUNT
   * DUE; 'largest' = no label matched, so the biggest amount was taken, which
   * the person should check.
   */
  totalFrom?: 'label' | 'largest';
  /** The receipt's date as YYYY-MM-DD, when one could be read. */
  date?: string;
  /** The store's name, for the expense title. */
  merchant?: string;
  /** The receipt's lines, in order, when at least two could be read. */
  items?: ReceiptLine[];
  /** True when the lines add up to the total, so splitting by item is safe. */
  itemsMatchTotal?: boolean;
}

export interface ReceiptLine {
  name: string;
  /** The line's price as printed (already times the quantity). */
  amount: number;
}

/** Labels that mean "this is what you pay", best first. */
const TOTAL_LABELS: RegExp[] = [
  /\bGRAND\s*TOTAL\b/,
  /\bTOTAL\s*AMOUNT\s*DUE\b/,
  /\bAMOUNT\s*DUE\b/,
  /\bTOTAL\s*DUE\b/,
  /\bBALANCE\s*DUE\b/,
  /\bAMOUNT\s*PAYABLE\b/,
  /\bTOTAL\s*AMOUNT\b/,
  /\bNET\s*AMOUNT\b/,
  /\bTOTAL\b/,
];

/** A line with one of these is about something other than the bill's total. */
const NOT_TOTAL =
  /\b(SUB\s*-?\s*TOTAL|TOTAL\s*(QTY|QUANTITY|ITEMS?|PCS|DISCOUNTS?|SAVINGS|VAT|TAX)|CASH|CHANGE|TENDER(ED)?|VAT(ABLE)?|VAT-?EXEMPT|ZERO\s*RATED|DISCOUNT|SENIOR|PWD|SERVICE\s*CHARGE|TIP|POINTS|BALANCE\s*(REMAINING|LEFT))\b/;

/** An amount with centavos: 1,234.50 · P250.00 · ₱ 99.75 · PHP 1 234.00. */
const MONEY = /(?:₱|PHP|P)?\s*(\d{1,3}(?:[,\s]\d{3})+|\d+)\.(\d{2})(?!\d)/g;

/** Anything this large is a phone number, TIN or card number read as money. */
const MAX_AMOUNT = 1_000_000;

const amountsIn = (line: string): number[] => {
  const found: number[] = [];
  for (const match of line.matchAll(MONEY)) {
    const value = Number(`${match[1].replace(/[,\s]/g, '')}.${match[2]}`);
    if (Number.isFinite(value) && value > 0 && value < MAX_AMOUNT) found.push(value);
  }
  return found;
};

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const pad = (value: number) => String(value).padStart(2, '0');

/** A real calendar date as YYYY-MM-DD, or undefined. */
const toDateKey = (year: number, month: number, day: number): string | undefined => {
  if (year < 100) year += 2000;
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1) return undefined;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1) return undefined; // e.g. Feb 31
  return `${year}-${pad(month)}-${pad(day)}`;
};

const readDate = (line: string): string | undefined => {
  // 2026-11-05 or 2026/11/05
  let m = line.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (m) return toDateKey(+m[1], +m[2], +m[3]);

  // 11/05/2026 or 11-05-26: month first, as Philippine receipts print it,
  // unless the first number cannot be a month.
  m = line.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})\b/);
  if (m) {
    const [a, b, y] = [+m[1], +m[2], +m[3]];
    return a > 12 ? toDateKey(y, b, a) : toDateKey(y, a, b);
  }

  // Nov 05, 2026 · November 5 2026
  m = line.match(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\b/);
  if (m) {
    const month = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1;
    if (month) return toDateKey(+m[3], month, +m[2]);
  }

  // 05 Nov 2026
  m = line.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})\b/);
  if (m) {
    const month = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1;
    if (month) return toDateKey(+m[3], month, +m[1]);
  }
  return undefined;
};

/** Header lines that are never the store's name. */
const NOT_MERCHANT =
  /(RECEIPT|INVOICE|\bTIN\b|VAT\s*REG|\bTEL\b|PHONE|MOBILE|ADDRESS|\bST\.|STREET|\bAVE\b|AVENUE|\bBRGY\b|BARANGAY|CITY|PROVINCE|BRANCH|WELCOME|THANK|PLEASE|COME\s*AGAIN|VISIT\s*US|ENJOY|CASHIER|\bDATE\b|\bTIME\b|\bPOS\b|\bS\/?N\b|\bMIN\b|\bPTU\b|ORDER|TABLE|SERVER|ACCREDITATION|PERMIT|OWNED|OPERATED|WWW\.|\.COM|@)/;

const titleCase = (text: string) =>
  text
    .toLowerCase()
    .replace(/\b([a-z])/g, (letter) => letter.toUpperCase())
    .replace(/\b(Inc|Corp|Co|Ltd)\b\.?/g, (word) => word);

const readMerchant = (lines: string[]): string | undefined => {
  for (const line of lines.slice(0, 6)) {
    const clean = line.replace(/\s+/g, ' ').trim();
    const letters = clean.replace(/[^A-Za-z]/g, '').length;
    if (letters < 3 || clean.length > 40) continue;
    if (NOT_MERCHANT.test(clean.toUpperCase())) continue;
    if (amountsIn(clean).length || readDate(clean)) continue;
    // Mostly letters: a name, not a code.
    if (letters / clean.replace(/\s/g, '').length < 0.6) continue;
    return clean === clean.toUpperCase() ? titleCase(clean) : clean;
  }
  return undefined;
};

/** Lines about the receipt itself, never something that was bought. */
const NOT_ITEM =
  /(\bTIN\b|VAT\s*REG|\bTEL\b|PHONE|INVOICE|RECEIPT|CASHIER|\bTABLE\b|\bO\.?R\.?\s*(NO|#)|\bS\.?I\.?\s*(NO|#)|\bQTY\b|\bPAX\b|\bGUESTS?\b|\bSTAFF\b|\bTRANS(ACTION)?\b|\bITEMS?\s*(SOLD|COUNT)\b|AMOUNT\s*$)/;

/** A line that is only an amount, such as the price OCR split off its name. */
const ONLY_AMOUNT = /^(?:₱|PHP|P)?\s*[\d,\s]+\.\d{2}$/i;

const cleanItemName = (text: string): string =>
  text
    // A quantity in front: "2 Yum Burger", "2x Yum Burger", "2 @".
    .replace(/^\s*\d{1,2}\s*[xX@]?\s+(?=\D)/, '')
    // The line price at the end.
    .replace(/\s*(?:₱|PHP|P)?\s*[\d,]+\.\d{2}\s*[A-Z]?\s*$/i, '')
    // A unit price left before it: "Ensaymada @ 45.00" or "Ensaymada 45.00 @".
    .replace(/\s*@\s*(?:₱|PHP|P)?\s*[\d,]+\.\d{2}\s*$/i, '')
    .replace(/\s*(?:₱|PHP|P)?\s*[\d,]+\.\d{2}\s*@\s*$/i, '')
    .replace(/\s+[xX]\s*\d{1,2}\s*$/, '')
    .replace(/[.:\-–\s]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * The things bought, from the lines above the subtotal or total: a name with a
 * price at the end, or a name with its price alone on the next line.
 */
const readItems = (lines: string[]): ReceiptLine[] => {
  const end = lines.findIndex((line) => {
    const upper = line.toUpperCase();
    return /\bSUB\s*-?\s*TOTAL\b/.test(upper) || TOTAL_LABELS.some((label) => label.test(upper));
  });
  const body = end >= 0 ? lines.slice(0, end) : lines;
  const items: ReceiptLine[] = [];

  for (let i = 0; i < body.length; i += 1) {
    const line = body[i];
    const upper = line.toUpperCase();
    if (NOT_TOTAL.test(upper) || NOT_ITEM.test(upper) || readDate(line)) continue;

    let amounts = amountsIn(line);
    let text = line;
    if (!amounts.length) {
      // The price may have landed on the next line by itself.
      const next = body[i + 1] ?? '';
      if (!ONLY_AMOUNT.test(next.replace(/^PHP\s*/i, ''))) continue;
      amounts = amountsIn(next);
      i += 1;
    } else if (!/\d\.\d{2}\s*[A-Z]?\s*$/i.test(line)) {
      // An amount in the middle of the line is not a price column.
      continue;
    }
    if (!amounts.length) continue;

    const name = cleanItemName(text);
    if (name.replace(/[^A-Za-z]/g, '').length < 2) continue;
    items.push({
      name: name.length > 40 ? name.slice(0, 40).trim() : name,
      amount: amounts[amounts.length - 1],
    });
  }
  return items;
};

/**
 * Pulls the total, date and store name out of OCR text.
 *
 * @param blocks what the text recogniser returned: blocks of one or more lines.
 */
export const parseReceipt = (blocks: string[]): ParsedReceipt => {
  const lines = blocks
    .flatMap((block) => String(block ?? '').split(/\r?\n/))
    .map((line) => line.trim())
    .filter(Boolean);

  const result: ParsedReceipt = {};

  // 1. A total beside its label, preferring the most specific label. When the
  //    label and its amount landed on separate lines, the very next line is
  //    taken if it is nothing but an amount.
  let best: { rank: number; value: number } | null = null;
  lines.forEach((line, index) => {
    const upper = line.toUpperCase();
    if (NOT_TOTAL.test(upper)) return;
    const rank = TOTAL_LABELS.findIndex((label) => label.test(upper));
    if (rank < 0) return;

    let values = amountsIn(line);
    if (!values.length) {
      const next = lines[index + 1] ?? '';
      if (/^[₱P]?\s*[\d,\s]+\.\d{2}$/i.test(next.replace(/^PHP\s*/i, ''))) values = amountsIn(next);
    }
    if (!values.length) return;
    const value = values[values.length - 1];
    if (!best || rank < best.rank || (rank === best.rank && value > best.value)) {
      best = { rank, value };
    }
  });

  if (best) {
    result.total = (best as { value: number }).value;
    result.totalFrom = 'label';
  } else {
    // 2. No label found: the biggest amount on a line that is not cash,
    //    change or tax. Usually the total, but worth a second look.
    const amounts = lines.filter((line) => !NOT_TOTAL.test(line.toUpperCase())).flatMap(amountsIn);
    if (amounts.length) {
      result.total = Math.max(...amounts);
      result.totalFrom = 'largest';
    }
  }

  for (const line of lines) {
    const date = readDate(line);
    if (date) {
      result.date = date;
      break;
    }
  }

  const merchant = readMerchant(lines);
  if (merchant) result.merchant = merchant;

  // The store's name is not something bought.
  const items = readItems(lines).filter(
    (item, index) =>
      !(index === 0 && merchant && item.name.toLowerCase() === merchant.toLowerCase()),
  );
  if (items.length >= 2) {
    result.items = items;
    if (result.total) {
      const sum = items.reduce((total, item) => total + Math.round(item.amount * 100), 0);
      result.itemsMatchTotal = Math.abs(sum - Math.round(result.total * 100)) <= 1;
    }
  }

  return result;
};
