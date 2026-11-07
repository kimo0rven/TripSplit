/**
 * How each person likes to be paid: GCash, Maya, a bank account, or anything
 * else, with an optional QR. Shown to the people paying them in a trip.
 *
 * Kept free of imports so it can be tested with `node --test`.
 */

export type PayKind = 'gcash' | 'maya' | 'bank' | 'other';

export interface PayMethod {
  id: string;
  kind: PayKind;
  /** The name on the account, so the payer can check it before sending. */
  accountName: string;
  /** Mobile number or account number. */
  number: string;
  /** For a bank, which bank; for "other", what it is (e.g. PayPal). */
  provider?: string;
  /** A picture of the person's payment QR. */
  qrUrl?: string;
}

export const PAY_KINDS: { key: PayKind; label: string }[] = [
  { key: 'gcash', label: 'GCash' },
  { key: 'maya', label: 'Maya' },
  { key: 'bank', label: 'Bank' },
  { key: 'other', label: 'Other' },
];

/** "GCash", "BPI", "PayPal": what the method is called in a list. */
export const payMethodTitle = (method: Pick<PayMethod, 'kind' | 'provider'>): string => {
  const provider = method.provider?.trim();
  if ((method.kind === 'bank' || method.kind === 'other') && provider) return provider;
  return PAY_KINDS.find((kind) => kind.key === method.kind)?.label ?? 'Other';
};

/** A Philippine mobile number in the usual 0917 123 4567 shape, else as typed. */
export const formatPayNumber = (method: Pick<PayMethod, 'kind' | 'number'>): string => {
  const digits = method.number.replace(/\D/g, '');
  if ((method.kind === 'gcash' || method.kind === 'maya') && /^(09|639)\d{9}$/.test(digits)) {
    const local = digits.startsWith('63') ? '0' + digits.slice(2) : digits;
    return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
  }
  return method.number.trim();
};

/** What is wrong with a method before saving, or ''. */
export const payMethodProblem = (method: PayMethod): string => {
  if (!method.number.trim() && !method.qrUrl) return 'Add a number or a QR.';
  if (method.kind === 'gcash' || method.kind === 'maya') {
    const digits = method.number.replace(/\D/g, '');
    if (digits && !/^(09|639)\d{9}$/.test(digits)) {
      return 'That doesn’t look like a mobile number. It should start with 09 and have 11 digits.';
    }
  }
  if (method.kind === 'bank' && !method.provider?.trim()) return 'Say which bank.';
  if (!method.accountName.trim()) return 'Add the name on the account.';
  return '';
};

/** Keeps only well-formed methods, trimmed, in their saved order. */
export const cleanPayMethods = (value: unknown): PayMethod[] => {
  const list = Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? Object.values(value)
      : [];
  return list
    .filter(
      (item): item is PayMethod =>
        !!item &&
        typeof item === 'object' &&
        typeof (item as PayMethod).id === 'string' &&
        PAY_KINDS.some((kind) => kind.key === (item as PayMethod).kind),
    )
    .map((item) => ({
      id: item.id,
      kind: item.kind,
      accountName: String(item.accountName ?? '').trim(),
      number: String(item.number ?? '').trim(),
      ...(item.provider?.trim() ? { provider: item.provider.trim() } : {}),
      ...(item.qrUrl ? { qrUrl: item.qrUrl } : {}),
    }))
    .filter((item) => item.number || item.qrUrl);
};
