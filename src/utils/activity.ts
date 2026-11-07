/**
 * A trip's activity log: everything that happened, newest first, built from
 * what the trip already stores. Expenses, payments and plans keep who made
 * them and their edit history; members keep when they joined.
 *
 * Deleted things leave nothing behind, so they cannot be listed.
 *
 * Kept free of imports so it can be tested with `node --test`.
 */

export type ActivityKind = 'trip' | 'member' | 'expense' | 'payment' | 'plan';

export interface ActivityEntry {
  id: string;
  at: string;
  /** Who did it, as a member id; '' when unknown. */
  by: string;
  kind: ActivityKind;
  /** What happened, without the person's name: "added Dinner · ₱300". */
  text: string;
  /** Extra lines, such as the fields an edit changed. */
  details?: string[];
  /** The expense, payment or plan it is about, to open it. */
  targetId?: string;
}

interface Change {
  label: string;
  from: string;
  to: string;
}

interface Logged {
  id?: string;
  at: string;
  by: string;
  changes?: Change[] | string;
}

interface ActivitySource {
  trip: { name: string; createdBy: string; createdAt?: string };
  members: {
    id: string;
    joinedAt?: string;
    joinedWith?: string;
    addedBy?: string;
    invitedBy?: string;
    role?: string;
  }[];
  expenses: {
    id: string;
    title: string;
    amount: number;
    createdBy?: string;
    createdAt?: string;
    history?: Logged[];
  }[];
  settlements: {
    id: string;
    from: string;
    to: string;
    amount: number;
    status?: string;
    createdBy?: string;
    createdAt?: string;
    confirmedBy?: string;
    confirmedAt?: string;
    history?: Logged[];
  }[];
  plans: {
    id: string;
    title: string;
    createdBy?: string;
    createdAt?: string;
    history?: Logged[];
  }[];
  /** Deleted expenses and plans still in the trash. */
  trash?: {
    id: string;
    kind: 'expense' | 'plan';
    item: { title?: string; amount?: number };
    deletedAt: string;
    deletedBy: string;
  }[];
  /** When the trip was closed, and by whom. */
  closed?: { at: string; by: string };
  /** A member's short name, for the text of payments. */
  nameOf: (id: string) => string;
  money: (value: number) => string;
}

const changeLines = (changes: Logged['changes']): string[] => {
  if (!changes) return [];
  // Older entries kept the changes as one string.
  if (typeof changes === 'string') return changes ? [changes] : [];
  return changes.map((change) =>
    change.from || change.to
      ? `${change.label}: ${change.from || '—'} → ${change.to || '—'}`
      : change.label,
  );
};

/** Every event in a trip, newest first. */
export const buildActivity = (source: ActivitySource): ActivityEntry[] => {
  const { nameOf, money } = source;
  const entries: ActivityEntry[] = [];
  const push = (entry: ActivityEntry) => {
    if (entry.at && !Number.isNaN(Date.parse(entry.at))) entries.push(entry);
  };

  if (source.trip.createdAt) {
    push({
      id: 'trip',
      at: source.trip.createdAt,
      by: source.trip.createdBy,
      kind: 'trip',
      text: `created ${source.trip.name}`,
    });
  }

  source.members.forEach((member) => {
    // The trip's creator "joined" when it was made, which is already said.
    if (!member.joinedAt || member.id === source.trip.createdBy) return;
    push({
      id: `member-${member.id}`,
      at: member.joinedAt,
      by: member.id,
      kind: 'member',
      text:
        member.invitedBy && member.addedBy
          ? `joined, invited by ${nameOf(member.invitedBy)}`
          : member.joinedWith && member.addedBy
            ? `joined, let in by ${nameOf(member.addedBy)}`
            : member.joinedWith
              ? 'joined with the invite code'
              : member.addedBy
                ? `was added by ${nameOf(member.addedBy)}`
                : 'joined the trip',
    });
  });

  source.expenses.forEach((expense) => {
    if (expense.createdAt) {
      push({
        id: `expense-${expense.id}`,
        at: expense.createdAt,
        by: expense.createdBy ?? '',
        kind: 'expense',
        text: `added ${expense.title} · ${money(expense.amount)}`,
        targetId: expense.id,
      });
    }
    (expense.history ?? []).forEach((entry, index) => {
      push({
        id: `expense-${expense.id}-edit-${entry.id ?? index}`,
        at: entry.at,
        by: entry.by,
        kind: 'expense',
        text: `edited ${expense.title}`,
        details: changeLines(entry.changes),
        targetId: expense.id,
      });
    });
  });

  source.settlements.forEach((payment) => {
    const pair = `${nameOf(payment.from)} → ${nameOf(payment.to)} · ${money(payment.amount)}`;
    if (payment.createdAt) {
      push({
        id: `payment-${payment.id}`,
        at: payment.createdAt,
        by: payment.createdBy ?? payment.from,
        kind: 'payment',
        text: `recorded a payment: ${pair}`,
        targetId: payment.id,
      });
    }
    if (payment.confirmedAt && (payment.status === 'confirmed' || payment.status === 'declined')) {
      push({
        id: `payment-${payment.id}-answer`,
        at: payment.confirmedAt,
        by: payment.confirmedBy ?? payment.to,
        kind: 'payment',
        text: `${payment.status === 'declined' ? 'declined' : 'confirmed'} a payment: ${pair}`,
        targetId: payment.id,
      });
    }
    (payment.history ?? []).forEach((entry, index) => {
      push({
        id: `payment-${payment.id}-edit-${entry.id ?? index}`,
        at: entry.at,
        by: entry.by,
        kind: 'payment',
        text: `edited a payment: ${pair}`,
        details: changeLines(entry.changes),
        targetId: payment.id,
      });
    });
  });

  source.plans.forEach((plan) => {
    if (plan.createdAt) {
      push({
        id: `plan-${plan.id}`,
        at: plan.createdAt,
        by: plan.createdBy ?? '',
        kind: 'plan',
        text: `added the plan ${plan.title}`,
        targetId: plan.id,
      });
    }
    (plan.history ?? []).forEach((entry, index) => {
      push({
        id: `plan-${plan.id}-edit-${entry.id ?? index}`,
        at: entry.at,
        by: entry.by,
        kind: 'plan',
        text: `edited the plan ${plan.title}`,
        details: changeLines(entry.changes),
        targetId: plan.id,
      });
    });
  });

  (source.trash ?? []).forEach((entry) => {
    const title = entry.item?.title || 'something';
    push({
      id: `trash-${entry.id}`,
      at: entry.deletedAt,
      by: entry.deletedBy,
      kind: entry.kind,
      text:
        entry.kind === 'expense'
          ? `deleted ${title}${entry.item?.amount ? ` · ${money(entry.item.amount)}` : ''}`
          : `deleted the plan ${title}`,
      targetId: entry.id,
    });
  });

  if (source.closed?.at) {
    push({
      id: 'trip-closed',
      at: source.closed.at,
      by: source.closed.by,
      kind: 'trip',
      text: `closed ${source.trip.name}`,
    });
  }

  return entries.sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || a.id.localeCompare(b.id));
};
