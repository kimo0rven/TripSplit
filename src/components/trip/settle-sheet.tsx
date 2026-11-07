import PrimaryButton from '@/components/Button/primary-button';
import { AmountPicker } from '@/components/trip/settle/amount-picker';
import { CoversList } from '@/components/trip/settle/covers-list';
import { PayToCard } from '@/components/trip/settle/pay-to-card';
import { DebtSwitcher, PartiesHeader } from '@/components/trip/settle/parties-header';
import { PaymentMethodCard, type MethodKey } from '@/components/trip/settle/payment-method-card';
import { ProofPicker } from '@/components/trip/settle/proof-picker';
import BottomSheet from '@/components/ui/bottom-sheet';
import { HelperText } from '@/components/ui/card';
import { TextField } from '@/components/ui/text-input-field';
import { BrandColors, Spacing } from '@/constants/theme';
import { usePayMongoCheckout, type PayOutcome } from '@/hooks/use-paymongo-checkout';
import { payMongoConfigured } from '@/services/Firebase/paymongoService';
import { fetchExpenses } from '@/services/Firebase/expenseService';
import {
  createSettlement,
  fetchSettlements,
  updateSettlement,
} from '@/services/Firebase/settlementService';
import { isConnected } from '@/services/offline/offlineStore';
import { uploadReceipt } from '@/services/Supabase/receiptService';
import { DebtEdge, Expense, Settlement } from '@/types/expenses';
import { TripMember } from '@/types/trips';
import { computeBalances, countsTowardBalance, simplifyDebts } from '@/utils/balance';
import { coverageFor, previewCoverage } from '@/utils/coverage';
import { formatMoney, parseAmount, todayKey } from '@/utils/money';
import { choiceFor, PAYMENT_CHOICES, storedPayment } from '@/utils/paymentMethod';
import {
  amountFor,
  amountProblem,
  choiceForAmount,
  debtBetween,
  debtsWithMe,
  findDuplicatePayment,
  fullDebtFor,
  pendingBetween,
  kindFor,
  type AmountChoice,
} from '@/utils/settle';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

/** The clock, read only when a payment is about to be saved. */
const nowMs = () => Date.now();

/** "5 min ago", for a payment that may have been recorded twice. */
const agoText = (iso?: string) => {
  const minutes = Math.round((nowMs() - Date.parse(iso ?? '')) / 60000);
  if (!Number.isFinite(minutes) || minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours === 1 ? 'an hour ago' : `${hours} hours ago`;
};

interface SettleSheetProps {
  visible: boolean;
  onClose: () => void;
  tripId: string;
  currency: string;
  members: TripMember[];
  edges: DebtEdge[];
  currentUserId: string;
  /** When set, the sheet edits this payment instead of recording a new one. */
  settlement?: Settlement | null;
  preselect?: { from?: string; to?: string; amount?: number };
  /**
   * The trip's expenses and payments. With them, the sheet lists which
   * expenses the payment pays for; without them that list is left out.
   */
  expenses?: Expense[];
  settlements?: Settlement[];
  onSaved: (settlement: Settlement) => void;
}

/**
 * Records a payment between two members, by cash or through PayMongo.
 *
 * The pieces live in `./settle/`; this file holds the state and decides what
 * the one button at the bottom does.
 */
export default function SettleSheet({
  visible,
  onClose,
  tripId,
  currency,
  members,
  edges,
  currentUserId,
  preselect,
  settlement,
  expenses,
  settlements,
  onSaved,
}: SettleSheetProps) {
  const [from, setFrom] = useState(currentUserId);
  const [to, setTo] = useState('');
  const [choice, setChoice] = useState<AmountChoice>('full');
  const [typed, setTyped] = useState('');
  const [note, setNote] = useState('');
  const [method, setMethod] = useState<MethodKey>('cash');
  /** Kept as is, so editing an older GCash or bank payment does not lose its name. */
  const [savedMethod, setSavedMethod] = useState('');
  const [proofUris, setProofUris] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  /** A likely repeat of a payment already recorded, waiting for a second tap. */
  const [repeat, setRepeat] = useState<{ key: string; text: string } | null>(null);

  const checkout = usePayMongoCheckout({ visible, tripId, currency, currentUserId });

  /**
   * What is still to pay between two people: the simplified debt, less any
   * payment between them still waiting for the receiver to confirm. A
   * confirmed payment being edited is already in the balances, so it is added
   * back; a pending one was never taken off.
   */
  const pendingFor = (payer: string, payee: string) =>
    pendingBetween(
      (settlements ?? []).filter((item) => item.id !== settlement?.id),
      payer,
      payee,
    );
  const debtFor = (payer: string, payee: string) =>
    fullDebtFor(
      debtBetween(edges, payer, payee) - pendingFor(payer, payee),
      settlement && countsTowardBalance(settlement) ? settlement : null,
      { from: payer, to: payee },
    );

  // Start from the payment being edited, the debt picked elsewhere, or the
  // first debt you are part of (one you owe first, then one owed to you).
  useEffect(() => {
    if (!visible) return;
    if (settlement) {
      const debt = debtFor(settlement.from, settlement.to);
      const picked = choiceForAmount(settlement.amount, debt);
      setFrom(settlement.from);
      setTo(settlement.to);
      setChoice(picked);
      setTyped(picked === 'custom' ? String(settlement.amount) : '');
      setNote(settlement.note ?? '');
      const saved = choiceFor({ isCash: settlement.isCash, method: settlement.method });
      setMethod(saved && !saved.cash ? 'other' : 'cash');
      setSavedMethod(saved && !saved.cash ? (settlement.method ?? '') : '');
      setProofUris(settlement.proofUrls ?? []);
    } else {
      const fallback = preselect?.to ? null : debtsWithMe(edges, currentUserId)[0];
      const nextFrom = preselect?.from || fallback?.from || currentUserId || '';
      const nextTo = preselect?.to || fallback?.to || '';
      const debt = debtFor(nextFrom, nextTo);
      // A debt picked elsewhere may not know about payments still waiting.
      const start = Math.min(preselect?.amount || fallback?.amount || debt, debt);
      const picked = choiceForAmount(start, debt);
      setFrom(nextFrom);
      setTo(nextTo);
      setChoice(picked);
      setTyped(picked === 'custom' && start > 0 ? String(start) : '');
      setNote('');
      // Cash is the everyday case; switching to Other brings up PayMongo.
      setMethod('cash');
      setSavedMethod('');
      setProofUris([]);
    }
    setError('');
    setRepeat(null);
    setSaving(false);
    // Only a fresh open resets the form; later debt updates must not wipe it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, settlement?.id, preselect?.from, preselect?.to, preselect?.amount, currentUserId]);

  // A checkout left unfinished last time brings the sheet straight back to it.
  useEffect(() => {
    if (visible && !settlement && checkout.pending) setMethod('other');
  }, [visible, settlement, checkout.pending]);

  const memberOf = (id: string) => members.find((member) => member.id === id);
  const nameOf = (id: string) => memberOf(id)?.fullname ?? 'Member';
  /** "You" for the signed-in person, their first name for anyone else. */
  const labelOf = (id: string) =>
    id === currentUserId ? 'You' : nameOf(id).split(' ')[0] || 'Member';
  const personOf = (id: string) =>
    id ? { id, label: labelOf(id), fullname: nameOf(id), photoURL: memberOf(id)?.photoURL } : null;

  const pendingNow = to ? pendingFor(from, to) : 0;
  const debt = debtFor(from, to);
  const amount = amountFor(choice, debt, parseAmount(typed) / 100);
  const kind = kindFor(amount, debt);
  const money = (value: number) => formatMoney(value, currency);

  // Which of the payer's expense shares this money pays for. A new payment
  // takes the oldest shares still open; an edit is worked out in its place
  // among the payer's payments, at the amount it is being changed to.
  const covers = (() => {
    if (!expenses || !from || amount <= 0) return null;
    const all = settlements ?? [];
    if (settlement) {
      const edited = all.some((item) => item.id === settlement.id)
        ? all.map((item) => (item.id === settlement.id ? { ...item, from, to, amount } : item))
        : [...all, { ...settlement, from, to, amount }];
      return coverageFor(from, expenses, edited).byPayment[settlement.id] ?? [];
    }
    return previewCoverage(coverageFor(from, expenses, all).open, amount);
  })();

  /**
   * Payer and payee are fixed once the sheet knows them: an edit keeps its own
   * pair, and a debt tapped elsewhere arrives already chosen. Only the plain
   * "Settle up" button can switch between your debts.
   */
  const locked = !!settlement || !!preselect?.to;
  const myDebts = debtsWithMe(edges, currentUserId);
  const headline = !to
    ? 'Nobody to pay right now'
    : from === currentUserId
      ? `You are paying ${labelOf(to)}`
      : to === currentUserId
        ? `${labelOf(from)} is paying you`
        : `${labelOf(from)} is paying ${labelOf(to)}`;

  /**
   * "Other" on a new payment, made by you, means paying through PayMongo here -
   * when PayMongo is switched on. Off, Other is recorded like cash, with proof.
   */
  const onlineAvailable = payMongoConfigured();
  const payOnline = onlineAvailable && !settlement && method === 'other' && from === currentUserId;
  const checkingPending = payOnline && !!checkout.pending;

  const problemNow = () =>
    !to
      ? 'There is nobody to pay right now.'
      : debt <= 0.005 && pendingNow > 0
        ? `${nameOf(from)} already sent ${nameOf(to)} ${money(pendingNow)}, which covers it. It's waiting for ${nameOf(to).split(' ')[0]} to confirm.`
        : amountProblem(amount, debt, { from: nameOf(from), to: nameOf(to), money });

  const repeatKey = `${from}>${to}:${Math.round(amount * 100)}`;
  const repeatShown = repeat?.key === repeatKey ? repeat.text : '';

  /**
   * Before a new payment is saved, checks it against the latest payments on
   * the server, not just what this phone last loaded. Two things go wrong
   * otherwise: both people record the same cash, which counts it twice and
   * flips the debt; or someone else paid in the meantime, so the amount is now
   * more than is owed. Returns true when it is fine to go ahead.
   */
  const checkAgainstLatest = async (): Promise<boolean> => {
    let latest = settlements ?? [];
    let freshProblem = '';
    if (isConnected()) {
      try {
        const [freshExpenses, freshPayments] = await Promise.all([
          fetchExpenses(tripId, { preferCache: false }),
          fetchSettlements(tripId, { preferCache: false }),
        ]);
        latest = freshPayments;
        const freshEdges = simplifyDebts(
          computeBalances(
            members.map((member) => member.id),
            freshExpenses,
            freshPayments,
          ),
          freshPayments,
        );
        // Payments still waiting don't count in the balances, so they come off here.
        const freshDebt =
          debtBetween(freshEdges, from, to) - pendingBetween(freshPayments, from, to);
        freshProblem = amountProblem(amount, freshDebt, {
          from: nameOf(from),
          to: nameOf(to),
          money,
        });
      } catch (err) {
        // Slow or refused: fall back to what the sheet already has.
        console.warn('Could not check the latest payments:', err);
      }
    }

    const twin = findDuplicatePayment(latest, { from, to, amount }, nowMs());
    const twinText = twin
      ? `${twin.createdBy === currentUserId ? 'You' : labelOf(twin.createdBy || twin.to)} already recorded ${money(
          twin.amount,
        )} from ${labelOf(from)} to ${labelOf(to)} ${agoText(twin.createdAt)}.`
      : '';

    if (freshProblem) {
      setError(
        twin
          ? `${twinText} ${freshProblem}`
          : `The balances changed since this opened. ${freshProblem}`,
      );
      return false;
    }
    if (twin && repeat?.key !== repeatKey) {
      setRepeat({
        key: repeatKey,
        text: `${twinText} If this is the same payment, close this sheet. If it is a second one, tap Record anyway.`,
      });
      return false;
    }
    return true;
  };

  const afterPayMongo = (outcome: PayOutcome) => {
    if (outcome.kind === 'saved') {
      onSaved(outcome.settlement);
      onClose();
      return;
    }
    setError(outcome.message);
  };

  const handlePay = async () => {
    if (checkout.busy || saving) return;
    setError('');

    if (checkout.pending) {
      // A checkout is already out there. Ask about it rather than charging again.
      afterPayMongo(await checkout.check(note, kind));
      return;
    }

    const problem = problemNow();
    if (problem) {
      setError(problem);
      return;
    }
    if (!(await checkAgainstLatest())) return;
    const pesos = amount * (checkout.pesoRate ?? 1);
    if (checkout.pesoRate && pesos < checkout.minimum) {
      setError(`PayMongo payments start at ${formatMoney(checkout.minimum, 'PHP')}.`);
      return;
    }

    afterPayMongo(
      await checkout.pay({
        from,
        to,
        amount,
        kind,
        note,
        title: `${nameOf(from)} pays ${nameOf(to)}`,
        description: `${money(amount)} settled through TripSplit`,
      }),
    );
  };

  const handleSave = async () => {
    if (saving) return;
    setError('');

    // An edit is left alone here: its own amount is already inside the balances.
    const problem = settlement
      ? amount > 0
        ? ''
        : 'Enter an amount greater than zero.'
      : problemNow();
    if (problem) {
      setError(problem);
      return;
    }

    if (!settlement) {
      setSaving(true);
      const fine = await checkAgainstLatest();
      setSaving(false);
      if (!fine) return;
    }

    const paid = storedPayment(PAYMENT_CHOICES[method === 'cash' ? 0 : 1], savedMethod);
    // A non-cash payment must name how it was paid; "Other" is the honest answer.
    if (!paid.isCash && !paid.method) paid.method = 'Other';

    setSaving(true);
    try {
      const proofUrls: string[] = [];
      for (const uri of proofUris) {
        if (/^https?:\/\//.test(uri)) {
          proofUrls.push(uri);
          continue;
        }
        try {
          proofUrls.push(await uploadReceipt(uri, tripId));
        } catch (uploadError: any) {
          console.error('Failed to upload payment photo:', uploadError);
          setError(
            'A photo could not be uploaded, so the payment was not saved. (' +
              (uploadError?.message || 'Upload failed') +
              ')',
          );
          setSaving(false);
          return;
        }
      }

      if (settlement) {
        const names = Object.fromEntries(members.map((m) => [m.id, m.fullname]));
        const { settlement: updated } = await updateSettlement(
          tripId,
          settlement,
          {
            from,
            to,
            amount,
            kind,
            isCash: paid.isCash,
            method: paid.method,
            proofUrls,
            note,
          },
          { currency, names, by: currentUserId, byName: names[currentUserId] || 'Someone' },
        );
        onSaved(updated);
        onClose();
        return;
      }

      const saved = await createSettlement(tripId, {
        from,
        to,
        amount,
        kind,
        settledOn: todayKey(),
        isCash: paid.isCash,
        method: paid.method,
        proofUrls,
        note,
        createdBy: currentUserId,
      });
      onSaved(saved);
      onClose();
    } catch (err: any) {
      console.error('Failed to save settlement:', err);
      setError(err?.message || 'Could not record that payment.');
      setSaving(false);
    }
  };

  const footerTitle = payOnline
    ? checkout.stage === 'checkout'
      ? 'Opening PayMongo…'
      : checkout.stage === 'confirming'
        ? 'Confirming payment…'
        : checkingPending
          ? 'Check payment'
          : repeatShown
            ? 'Pay anyway'
            : `Pay ${amount > 0 ? money(amount) : ''}`.trim()
    : saving
      ? 'Saving…'
      : settlement
        ? 'Save changes'
        : repeatShown
          ? 'Record anyway'
          : 'Record payment';

  const footerDisabled = payOnline
    ? checkout.busy || saving || !checkout.ready || (!to && !checkingPending)
    : saving || !to;

  const pickDebt = (edge: DebtEdge) => {
    setFrom(edge.from);
    setTo(edge.to);
    setChoice('full');
    setTyped('');
    setError('');
  };

  return (
    <BottomSheet
      visible={visible}
      title={settlement ? 'Edit payment' : 'Settle up'}
      onClose={onClose}
      footer={
        <>
          {!!error && <HelperText tone="error">{error}</HelperText>}
          {!error && !!repeatShown && <HelperText tone="error">{repeatShown}</HelperText>}
          <PrimaryButton
            title={footerTitle}
            onPress={payOnline ? handlePay : handleSave}
            buttonColor={BrandColors.base50}
            textColor={BrandColors.primary}
            borderColor={BrandColors.base50}
            borderWidth={0}
            disabled={footerDisabled}
          />
        </>
      }
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
      >
        <PartiesHeader headline={headline} payer={personOf(from)} payee={personOf(to)} />

        {!locked && myDebts.length > 1 && (
          <DebtSwitcher
            debts={myDebts}
            from={from}
            to={to}
            currency={currency}
            labelOf={labelOf}
            onPick={pickDebt}
          />
        )}

        <AmountPicker
          currency={currency}
          debt={debt}
          choice={choice}
          amount={amount}
          typed={typed}
          onChoice={(next) => {
            setChoice(next);
            // Switching to Other amount starts from the current amount.
            if (next === 'custom' && !typed && amount > 0) setTyped(String(amount));
          }}
          onTyped={setTyped}
        />

        {pendingNow > 0 && (
          <HelperText>
            {money(pendingNow)} already sent to {labelOf(to)} is waiting for them to confirm, so
            it&apos;s taken off what&apos;s left to pay.
          </HelperText>
        )}

        {covers && (
          <CoversList
            title={settlement ? 'This payment covers' : 'This payment will cover'}
            owner={from === currentUserId ? 'your' : `${labelOf(from)}’s`}
            items={covers}
            currency={currency}
            empty={`No expense shares left to pay. This amount is extra and goes on ${
              from === currentUserId ? 'your' : `${labelOf(from)}’s`
            } balance.`}
          />
        )}

        <PaymentMethodCard
          method={method}
          onMethod={setMethod}
          payOnline={payOnline}
          onlineAvailable={onlineAvailable}
          editing={!!settlement}
          payerLabel={labelOf(from)}
          amount={amount}
          currency={currency}
          checkout={checkout}
          pendingPayee={checkout.pending ? labelOf(checkout.pending.to) : ''}
        />

        {/* Their GCash, Maya or bank details, when you are the one paying. */}
        {!settlement && !payOnline && from === currentUserId && !!to && (
          <PayToCard tripId={tripId} payeeId={to} payeeLabel={labelOf(to)} />
        )}

        {/* PayMongo keeps its own receipt, so there is no photo to add. */}
        {!payOnline && <ProofPicker uris={proofUris} onChange={setProofUris} onError={setError} />}

        <TextField
          title="Note (optional)"
          placeholder="Add a note about this payment, like a reference number or what it was for"
          value={note}
          onChangeText={setNote}
          multiline
          minHeight={120}
        />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: Spacing.four,
    paddingBottom: Spacing.four,
  },
});
