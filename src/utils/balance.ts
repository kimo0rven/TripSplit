import type { DebtEdge, Expense, MemberBalance, Settlement } from '@/types/expenses';

/**
 * Balance and debt maths.
 *
 * Each member's net is what they paid minus what they owe. Everyone's net
 * adds up to zero, so the people above zero are owed money and the people
 * below zero owe it. `simplifyDebts` turns that into the smallest sensible
 * list of payments.
 */

const cents = (value: number): number => Math.round((Number.isFinite(value) ? value : 0) * 100);

/** Only payments the receiver has not rejected or left waiting change the balances. */
export const countsTowardBalance = (settlement: Settlement): boolean =>
  !settlement.status || settlement.status === 'confirmed';

export const computeBalances = (
  memberIds: string[],
  expenses: Expense[],
  settlements: Settlement[] = [],
): MemberBalance[] => {
  const paid: Record<string, number> = {};
  const owed: Record<string, number> = {};

  memberIds.forEach((id) => {
    paid[id] = 0;
    owed[id] = 0;
  });

  const ensure = (id: string) => {
    if (paid[id] === undefined) paid[id] = 0;
    if (owed[id] === undefined) owed[id] = 0;
  };

  expenses.forEach((expense) => {
    Object.entries(expense.paidBy ?? {}).forEach(([id, amount]) => {
      ensure(id);
      paid[id] += cents(amount);
    });
    Object.entries(expense.shares ?? {}).forEach(([id, amount]) => {
      ensure(id);
      owed[id] += cents(amount);
    });
  });

  // A settlement is cash changing hands: it clears part of the payer's debt
  // and part of the receiver's credit, without touching who spent what.
  settlements.filter(countsTowardBalance).forEach((settlement) => {
    const amount = cents(settlement.amount);
    ensure(settlement.from);
    ensure(settlement.to);
    paid[settlement.from] += amount;
    owed[settlement.to] += amount;
  });

  return Object.keys(paid).map((memberId) => ({
    memberId,
    paid: paid[memberId] / 100,
    owed: owed[memberId] / 100,
    net: (paid[memberId] - owed[memberId]) / 100,
  }));
};

export interface TripTotals {
  total: number;
  balances: MemberBalance[];
  spent: number;
  settled: number;
}

export const computeTripTotals = (
  memberIds: string[],
  expenses: Expense[],
  settlements: Settlement[] = [],
): TripTotals => {
  const spent = expenses.reduce((sum, expense) => sum + cents(expense.amount), 0) / 100;
  const settled = settlements.filter(countsTowardBalance).reduce((sum, settlement) => sum + cents(settlement.amount), 0) / 100;

  return {
    total: spent,
    spent,
    settled,
    balances: computeBalances(memberIds, expenses, settlements),
  };
};

/**
 * Greedy debt simplification: pair the biggest debtor with the biggest
 * creditor over and over. With N members it never needs more than N - 1
 * payments, which is the practical minimum.
 *
 * `settlements` are already folded into the balances by computeBalances, so
 * pass them there and use the result here - do not subtract them twice.
 */
export const simplifyDebts = (balances: MemberBalance[]): DebtEdge[] => {
  const creditors = balances
    .filter((balance) => Math.round(balance.net * 100) > 0)
    .map((balance) => ({ id: balance.memberId, amount: Math.round(balance.net * 100) }))
    .sort((a, b) => b.amount - a.amount);

  const debtors = balances
    .filter((balance) => Math.round(balance.net * 100) < 0)
    .map((balance) => ({ id: balance.memberId, amount: -Math.round(balance.net * 100) }))
    .sort((a, b) => b.amount - a.amount);

  const edges: DebtEdge[] = [];
  let c = 0;
  let d = 0;

  while (c < creditors.length && d < debtors.length) {
    const creditor = creditors[c];
    const debtor = debtors[d];
    const amount = Math.min(creditor.amount, debtor.amount);

    if (amount > 0) {
      edges.push({
        from: debtor.id,
        to: creditor.id,
        amount: amount / 100,
      });
    }

    creditor.amount -= amount;
    debtor.amount -= amount;

    if (creditor.amount <= 0) c += 1;
    if (debtor.amount <= 0) d += 1;
  }

  return edges;
};

/** Before simplification: how much each pair of members owes each other. */
export const pairwiseDebts = (balances: MemberBalance[]): DebtEdge[] => simplifyDebts(balances);

export interface SettlementSuggestion {
  forMemberId: string;
  pay: DebtEdge[];
  receive: DebtEdge[];
}

export const suggestionsFor = (memberId: string, edges: DebtEdge[]): SettlementSuggestion => ({
  forMemberId: memberId,
  pay: edges.filter((edge) => edge.from === memberId),
  receive: edges.filter((edge) => edge.to === memberId),
});

/** Looks up the simple debt that sits between two members, if there is one. */
export const debtBetween = (edges: DebtEdge[], from: string, to: string): number => {
  const direct = edges.find((edge) => edge.from === from && edge.to === to);
  if (direct) return direct.amount;

  const reverse = edges.find((edge) => edge.from === to && edge.to === from);
  if (reverse) return -reverse.amount;

  return 0;
};

/** Categories offered on the expense form. */
export const EXPENSE_CATEGORIES = [
  { value: 'food', label: 'Food' },
  { value: 'transport', label: 'Transport' },
  { value: 'stay', label: 'Stay' },
  { value: 'activity', label: 'Activity' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'other', label: 'Other' },
] as const;

export const categoryLabel = (value?: string): string =>
  EXPENSE_CATEGORIES.find((category) => category.value === value)?.label ?? 'Other';
