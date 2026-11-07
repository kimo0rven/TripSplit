/**
 * Which expenses a payment pays for.
 *
 * Debts are simplified, so a payment can go to someone other than the person
 * who paid the bill: money is pooled, and who pays whom is just the shortest
 * route. What a payment does pay for is the payer's own unpaid shares. So
 * each member's shares are lined up oldest first and paid off in order:
 * first by what they paid for others, then by each payment they made, in the
 * order they made them.
 *
 * Kept free of imports so it can be tested with `node --test`.
 */

interface ExpenseLike {
  id: string;
  title: string;
  spentOn: string;
  createdAt?: string;
  paidBy?: Record<string, number>;
  shares?: Record<string, number>;
}

interface SettlementLike {
  id: string;
  from: string;
  to: string;
  amount: number;
  status?: string;
  createdAt?: string;
}

/** One expense, and how much of this member's share a payment covers. */
export interface CoveredShare {
  expenseId: string;
  title: string;
  spentOn: string;
  /** The member's whole unpaid share of the expense. */
  share: number;
  /** How much of that share this payment pays. */
  covered: number;
}

export interface Coverage {
  /** What each of the member's payments paid for, by payment id. */
  byPayment: Record<string, CoveredShare[]>;
  /** Shares still unpaid, oldest first, with `covered` = what is still owed. */
  open: CoveredShare[];
}

const cents = (value: number) => Math.round((Number(value) || 0) * 100);
const counts = (s: SettlementLike) => s.status !== 'declined' && s.status !== 'rejected';

/** Lines up a member's shares and pays them off with everything they paid. */
export const coverageFor = (
  memberId: string,
  expenses: ExpenseLike[],
  settlements: SettlementLike[],
): Coverage => {
  // What the member owes on each expense: their share minus what they put in.
  const items = expenses
    .map((expense) => ({
      expense,
      owed: cents(expense.shares?.[memberId] ?? 0) - cents(expense.paidBy?.[memberId] ?? 0),
    }))
    .filter((entry) => entry.owed > 0)
    .sort((a, b) =>
      a.expense.spentOn === b.expense.spentOn
        ? (a.expense.createdAt ?? '').localeCompare(b.expense.createdAt ?? '')
        : a.expense.spentOn < b.expense.spentOn
          ? -1
          : 1,
    )
    .map(({ expense, owed }) => ({ expense, share: owed, left: owed }));

  // Paying more than your share of other bills already pays off your own
  // shares; money handed to you by others undoes that.
  let credit =
    expenses.reduce((sum, expense) => {
      const extra = cents(expense.paidBy?.[memberId] ?? 0) - cents(expense.shares?.[memberId] ?? 0);
      return extra > 0 ? sum + extra : sum;
    }, 0) -
    settlements
      .filter((s) => counts(s) && s.to === memberId)
      .reduce((sum, s) => sum + cents(s.amount), 0);

  const take = (amount: number): CoveredShare[] => {
    const taken: CoveredShare[] = [];
    let rest = amount;
    for (const item of items) {
      if (rest <= 0) break;
      if (item.left <= 0) continue;
      const part = Math.min(item.left, rest);
      item.left -= part;
      rest -= part;
      taken.push({
        expenseId: item.expense.id,
        title: item.expense.title,
        spentOn: item.expense.spentOn,
        share: item.share / 100,
        covered: part / 100,
      });
    }
    return taken;
  };

  if (credit > 0) take(credit);

  const byPayment: Record<string, CoveredShare[]> = {};
  settlements
    .filter((s) => counts(s) && s.from === memberId)
    .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))
    .forEach((payment) => {
      byPayment[payment.id] = take(cents(payment.amount));
    });

  const open = items
    .filter((item) => item.left > 0)
    .map((item) => ({
      expenseId: item.expense.id,
      title: item.expense.title,
      spentOn: item.expense.spentOn,
      share: item.share / 100,
      covered: item.left / 100,
    }));

  return { byPayment, open };
};

/** What a new payment of `amount` would pay for, from the member's open shares. */
export const previewCoverage = (open: CoveredShare[], amount: number): CoveredShare[] => {
  const out: CoveredShare[] = [];
  let rest = cents(amount);
  for (const item of open) {
    if (rest <= 0) break;
    const part = Math.min(cents(item.covered), rest);
    rest -= part;
    out.push({ ...item, covered: part / 100 });
  }
  return out;
};
