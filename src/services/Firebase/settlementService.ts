import { auth } from '@/config/firebase';
import { myName, notify, tripLabel } from '@/services/notifications/inbox';
import { newId, readPath, writeAt, writeUpdates } from '@/services/offline/offlineStore';
import {
  EditContext,
  buildEntry,
  serializeEntry,
  diffSettlement,
  historyOf,
} from '@/utils/editLog';
import { EditLogEntry, Settlement, TripBudget } from '@/types/expenses';
import { formatMoney, parseAmount, todayKey, toAmount } from '@/utils/money';

export interface SettlementInput {
  from: string;
  to: string;
  amount: number | string;
  /** 'full' clears the whole debt between the two; 'partial' pays some of it. */
  kind: 'full' | 'partial';
  settledOn?: string;
  isCash: boolean;
  method?: string;
  proofUrls?: string[];
  note?: string;
  createdBy: string;
}

/**
 * Records money one member handed to another. The trip's balances fold these
 * in automatically, so the pair's remaining debt drops by `amount`.
 */
export const createSettlement = async (
  tripId: string,
  input: SettlementInput,
): Promise<Settlement> => {
  if (!tripId) throw new Error('No trip was selected.');
  if (!input.from || !input.to) throw new Error('Pick who is paying who.');
  if (input.from === input.to) throw new Error('A person cannot settle up with themselves.');

  const amount = toAmount(parseAmount(input.amount));
  if (amount <= 0) throw new Error('Enter an amount greater than zero.');

  const method = input.method?.trim();
  if (!input.isCash && !method) throw new Error('Tell us how it was paid, e.g. GCash.');

  const settlement: Settlement = {
    id: newId(),
    from: input.from,
    to: input.to,
    amount,
    kind: input.kind,
    settledOn: input.settledOn || todayKey(),
    isCash: input.isCash,
    // The receiver has to agree before a payment counts, unless they recorded it themselves.
    status: input.createdBy === input.to ? 'confirmed' : 'pending',
    ...(input.createdBy === input.to
      ? { confirmedBy: input.createdBy, confirmedAt: new Date().toISOString() }
      : {}),
    ...(input.proofUrls?.length ? { proofUrls: input.proofUrls } : {}),
    ...(!input.isCash && method ? { method } : {}),
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
  };

  await writeAt(`trips/${tripId}/settlements/${settlement.id}`, settlement);
  if (settlement.status === 'pending') {
    const tripName = (await readPath(`trips/${tripId}/name`)) as string | null;
    const currency = (await readPath(`trips/${tripId}/currency`)) as string | null;
    const trip = tripName ?? 'a trip';
    const payer = auth.currentUser?.displayName || 'Someone';
    await notify(
      settlement.to,
      'paymentRequests',
      'Payment to confirm',
      payer +
        ' says they paid you ' +
        formatMoney(settlement.amount, currency ?? undefined) +
        ' in ' +
        trip +
        '. Please confirm.',
      { tripId },
    );
  }
  return settlement;
};

/** Changes a recorded payment and keeps a log of what moved. */
export const updateSettlement = async (
  tripId: string,
  before: Settlement,
  input: Omit<SettlementInput, 'createdBy'>,
  context: EditContext,
): Promise<{ settlement: Settlement; entry: EditLogEntry | null }> => {
  if (!tripId || !before?.id) throw new Error('No payment was selected.');
  if (!input.from || !input.to) throw new Error('Pick who is paying who.');
  if (input.from === input.to) throw new Error('A person cannot settle up with themselves.');

  const amount = toAmount(parseAmount(input.amount));
  if (amount <= 0) throw new Error('Enter an amount greater than zero.');

  const method = input.method?.trim();
  if (!input.isCash && !method) throw new Error('Tell us how it was paid, e.g. GCash.');

  const note = input.note?.trim() || undefined;
  const proofUrls = input.proofUrls?.length ? input.proofUrls : undefined;
  const after = {
    from: input.from,
    to: input.to,
    amount,
    kind: input.kind,
    isCash: input.isCash,
    method: input.isCash ? undefined : method,
  };

  const changes = diffSettlement(before, after, context);
  const entry = changes.length ? buildEntry(newId(), context, changes) : null;
  const base = `trips/${tripId}/settlements/${before.id}`;
  // Any edit sends the payment back to the receiver, unless the receiver made it.
  const status: 'pending' | 'confirmed' = input.to === context.by ? 'confirmed' : 'pending';

  await writeUpdates({
    ...(entry ? { [`${base}/history/${entry.id}`]: serializeEntry(entry) } : {}),
    [`${base}/from`]: after.from,
    [`${base}/to`]: after.to,
    [`${base}/amount`]: amount,
    [`${base}/status`]: status,
    [`${base}/confirmedBy`]: status === 'confirmed' ? context.by : null,
    [`${base}/confirmedAt`]: status === 'confirmed' ? new Date().toISOString() : null,
    [`${base}/kind`]: after.kind,
    [`${base}/isCash`]: after.isCash,
    [`${base}/method`]: after.method ?? null,
    [`${base}/note`]: note ?? null,
    [`${base}/proofUrls`]: proofUrls ?? null,
    [`${base}/updatedAt`]: new Date().toISOString(),
  });

  return {
    settlement: {
      ...before,
      ...after,
      note,
      proofUrls,
      status,
      confirmedBy: status === 'confirmed' ? context.by : undefined,
      history: entry ? [entry, ...(before.history ?? [])] : before.history,
    },
    entry,
  };
};

/** The receiver accepts or rejects a payment that is waiting for them. */
export const respondToSettlement = async (
  tripId: string,
  settlementId: string,
  responderId: string,
  accept: boolean,
): Promise<{ status: 'confirmed' | 'declined'; confirmedBy: string; confirmedAt: string }> => {
  if (!tripId || !settlementId || !responderId) throw new Error('No payment was selected.');

  const result = {
    status: accept ? ('confirmed' as const) : ('declined' as const),
    confirmedBy: responderId,
    confirmedAt: new Date().toISOString(),
  };
  const base = `trips/${tripId}/settlements/${settlementId}`;
  await writeUpdates({
    [`${base}/status`]: result.status,
    [`${base}/confirmedBy`]: result.confirmedBy,
    [`${base}/confirmedAt`]: result.confirmedAt,
  });

  const record = (await readPath(base)) as Settlement | null;
  if (record) {
    const { name, currency } = await tripLabel(tripId);
    await notify(
      record.createdBy || record.from,
      'paymentUpdates',
      accept ? 'Payment confirmed' : 'Payment declined',
      myName() +
        (accept ? ' confirmed your ' : ' declined your ') +
        formatMoney(record.amount, currency) +
        ' payment in ' +
        name +
        '.',
      { tripId },
    );
  }
  return result;
};

export const fetchSettlements = async (
  tripId: string,
  options?: { preferCache?: boolean },
): Promise<Settlement[]> => {
  if (!tripId) return [];

  const data = (await readPath(`trips/${tripId}/settlements`, {
    preferCache: options?.preferCache,
  })) as Record<string, Omit<Settlement, 'id'>> | null;
  if (!data) return [];

  return (
    Object.entries(data)
      .map(([id, value]) => ({
        id,
        ...value,
        history: historyOf((value as { history?: unknown }).history),
      }))
      // Newest day first, matching how expenses are ordered. Keyed on the day the
      // money moved rather than on when the record was written: the list is split
      // into day sections using `settledOn`, and a payment entered late would
      // otherwise land outside its own section. Within a day, the newest entry
      // written comes first.
      .sort((a, b) => {
        const dayA = a.settledOn || '';
        const dayB = b.settledOn || '';
        if (dayA !== dayB) {
          // An undated payment belongs at the bottom, beside the oldest day,
          // rather than above today in a section of its own.
          if (!dayA) return 1;
          if (!dayB) return -1;
          return dayA < dayB ? 1 : -1;
        }
        return a.createdAt < b.createdAt ? 1 : -1;
      })
  );
};

export const fetchTripBudget = async (tripId: string): Promise<TripBudget | null> => {
  if (!tripId) return null;

  const data = (await readPath(`trips/${tripId}/budget`)) as TripBudget | null;
  if (!data) return null;

  return {
    amount: toAmount(parseAmount(data.amount)),
    updatedAt: data.updatedAt,
    updatedBy: data.updatedBy,
  };
};

export const saveTripBudget = async (
  tripId: string,
  amount: number | string,
  updatedBy: string,
): Promise<void> => {
  if (!tripId) throw new Error('No trip was selected.');

  const value = toAmount(parseAmount(amount));

  await writeUpdates({
    [`trips/${tripId}/budget/amount`]: value,
    [`trips/${tripId}/budget/updatedBy`]: updatedBy,
    [`trips/${tripId}/budget/updatedAt`]: new Date().toISOString(),
  });
};
