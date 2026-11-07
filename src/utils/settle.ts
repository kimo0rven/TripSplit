/**
 * The maths behind the Settle up sheet: which debts you are part of, what the
 * Full / Half / Other amount chips stand for, and whether an amount may be paid.
 *
 * Kept free of imports so it can be tested with `node --test`.
 */

/** One simplified debt: `from` owes `to` this much. */
export interface Debt {
  from: string;
  to: string;
  amount: number;
}

/** Which amount chip is picked. */
export type AmountChoice = 'full' | 'half' | 'custom';

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** The debts you are part of, the ones you owe first. */
export const debtsWithMe = <T extends Debt>(edges: T[], me: string): T[] => [
  ...edges.filter((edge) => edge.from === me),
  ...edges.filter((edge) => edge.to === me),
];

/** What `from` owes `to` right now: negative when it is the other way round. */
export const debtBetween = (edges: Debt[], from: string, to: string): number => {
  const direct = edges.find((edge) => edge.from === from && edge.to === to);
  if (direct) return direct.amount;
  const reverse = edges.find((edge) => edge.from === to && edge.to === from);
  return reverse ? -reverse.amount : 0;
};

/**
 * The whole debt the chips work from. When editing a payment, its own amount is
 * already inside the balances, so it is added back to get the debt before it.
 */
export const fullDebtFor = (
  owed: number,
  editing?: { from: string; to: string; amount: number } | null,
  pair?: { from: string; to: string },
): number => {
  const own =
    editing && pair && editing.from === pair.from && editing.to === pair.to ? editing.amount : 0;
  return Math.max(0, round2(owed + own));
};

/** Half the debt, rounded to the centavo. */
export const halfOf = (debt: number): number => round2(debt / 2);

/** The amount a chip stands for; a custom amount keeps what was typed. */
export const amountFor = (choice: AmountChoice, debt: number, typed: number): number =>
  choice === 'full' ? debt : choice === 'half' ? halfOf(debt) : round2(typed);

/** Which chip an existing amount matches, so an edit opens on the right one. */
export const choiceForAmount = (amount: number, debt: number): AmountChoice => {
  if (debt > 0 && Math.abs(amount - debt) < 0.005) return 'full';
  if (debt > 0 && Math.abs(amount - halfOf(debt)) < 0.005) return 'half';
  return 'custom';
};

/** Whether paying this amount clears the whole debt. */
export const kindFor = (amount: number, debt: number): 'full' | 'partial' =>
  debt > 0 && amount >= debt - 0.01 ? 'full' : 'partial';

/**
 * Why an amount cannot be paid, or '' when it can. Paying more than is owed
 * would flip the debt the other way, so a payment is held to the debt.
 */
export const amountProblem = (
  amount: number,
  debt: number,
  names: { from: string; to: string; money: (value: number) => string },
): string => {
  if (!(amount > 0)) return 'Enter an amount greater than zero.';
  if (debt <= 0.005) return `${names.from} does not owe ${names.to} anything right now.`;
  if (amount > debt + 0.005) {
    return `${names.from} only owes ${names.to} ${names.money(debt)}. Lower the amount.`;
  }
  return '';
};

interface PaymentLike {
  id: string;
  from: string;
  to: string;
  amount: number;
  status?: string;
  createdAt?: string;
}

/**
 * Money already sent from one person to another that the receiver hasn't
 * confirmed yet. It doesn't count in the balances until they do, so the
 * debt still shows it; this is what to take off before paying again.
 */
export const pendingBetween = (
  payments: { from: string; to: string; amount: number; status?: string }[],
  from: string,
  to: string,
): number =>
  Math.round(
    payments
      .filter(
        (payment) => payment.status === 'pending' && payment.from === from && payment.to === to,
      )
      .reduce((sum, payment) => sum + Math.round(Number(payment.amount) * 100), 0),
  ) / 100;

/** How far back a payment of the same amount between the same two people counts as a likely repeat. */
export const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * A payment already recorded that looks like the one about to be saved: same
 * payer, same receiver, same amount, recorded recently, and not declined. The
 * usual cause is both people recording the same cash, which would otherwise
 * count it twice and flip the debt the other way.
 */
export const findDuplicatePayment = <T extends PaymentLike>(
  payments: T[],
  next: { from: string; to: string; amount: number; id?: string },
  now: number,
  windowMs = DUPLICATE_WINDOW_MS,
): T | null => {
  const cents = Math.round(next.amount * 100);
  const recent = payments
    .filter(
      (payment) =>
        payment.id !== next.id &&
        payment.status !== 'declined' &&
        payment.status !== 'rejected' &&
        payment.from === next.from &&
        payment.to === next.to &&
        Math.abs(Math.round(Number(payment.amount) * 100) - cents) <= 1,
    )
    .filter((payment) => {
      const at = Date.parse(payment.createdAt ?? '');
      return Number.isFinite(at) && now - at >= 0 && now - at <= windowMs;
    })
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  return recent[0] ?? null;
};
