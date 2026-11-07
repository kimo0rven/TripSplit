/**
 * How a settlement between two people was actually paid.
 *
 * The form used to ask "Is this paid in cash?" with "Cash" and "Not cash" as the
 * answers, which is a question and an answer that do not match - nobody says
 * "not cash". It now asks how it was paid and offers the ways people really pay,
 * so picking one reads like a sentence.
 *
 * Kept free of imports so it can be tested with `node --test`.
 */

/** A stored settlement's `isCash` flag and its free-text `method`. */
export interface PaidWithInput {
  isCash?: boolean;
  method?: string;
}

export interface PaymentChoice {
  /** The stored `method` value. Cash stores none. */
  value: string;
  label: string;
  /** True for the cash choice. */
  cash: boolean;
}

/**
 * The choices the form offers, in the order they are shown.
 *
 * Cash, handed over in person, or Other, which is paid through PayMongo. Older
 * payments saved as GCash, Bank transfer or Card read back as Other and keep
 * their saved name.
 */
export const PAYMENT_CHOICES: PaymentChoice[] = [
  { value: '', label: 'Cash', cash: true },
  { value: 'Other', label: 'Other', cash: false },
];

/** The choice picked for a stored payment, or null when it has not been asked. */
export const choiceFor = ({ isCash, method }: PaidWithInput): PaymentChoice | null => {
  if (isCash === undefined || isCash === null) return null;
  if (isCash) return PAYMENT_CHOICES[0];

  const text = (method || '').trim();
  if (!text) return null;

  const known = PAYMENT_CHOICES.find(
    (choice) => !choice.cash && choice.value.toLowerCase() === text.toLowerCase(),
  );
  return known ?? PAYMENT_CHOICES[PAYMENT_CHOICES.length - 1];
};

/**
 * The `isCash` and `method` pair to store for a picked choice.
 *
 * "Other" keeps the words the person typed. A method left blank writes no
 * `method` at all, so an empty string never lands in the record and get shown as
 * a blank where a payment kind should be.
 */
export const storedPayment = (
  choice: PaymentChoice | null,
  typedMethod = '',
): { isCash: boolean; method?: string } => {
  if (!choice) return { isCash: true };

  if (choice.cash) return { isCash: true };

  const words = typedMethod.trim();
  if (choice.value === 'Other') {
    return { isCash: false, ...(words ? { method: words } : {}) };
  }
  return { isCash: false, method: choice.value };
};

/** Whether this choice needs a text box beside it to name the method. */
export const needsTypedMethod = (choice: PaymentChoice | null): boolean =>
  Boolean(choice && !choice.cash && choice.value === 'Other');

/** What to call a saved payment on a card or in a list. */
export const paymentMethodLabel = ({ isCash, method }: PaidWithInput): string => {
  if (isCash === true) return 'Cash';
  const text = (method || '').trim();
  return text || 'Not specified';
};
