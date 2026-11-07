import PayerSection from '@/components/trip/expense-payer-section';
import ExpenseSplitSection from '@/components/trip/expense-split-section';
import { styles } from '@/components/trip/expense-form-styles';
import ChoiceChips, { FieldLabel } from '@/components/ui/choice-chips';
import CategoryPicker from '@/components/ui/category-picker';
import { ChevronDown, ListChecks, Receipt } from 'lucide-react-native';
import ItemisedEditor from '@/components/trip/itemised-editor';
import ReceiptPicker from '@/components/trip/receipt-picker';
import PrimaryButton from '@/components/Button/primary-button';
import BottomSheet from '@/components/ui/bottom-sheet';
import { HelperText } from '@/components/ui/card';
import DayField from '@/components/ui/day-field';
import { TextField } from '@/components/ui/text-input-field';
import { categoryLook } from '@/constants/expense-categories';
import { BrandColors } from '@/constants/theme';
import { createRecurring } from '@/services/Firebase/recurringService';
import { createExpense, ExpenseInput, updateExpense } from '@/services/Firebase/expenseService';
import { uploadReceipt } from '@/services/Supabase/receiptService';
import { canScanReceipts, scanReceipt } from '@/services/receipts/scanReceipt';
import { fetchRateOn } from '@/services/currency/rates';
import CurrencyField from '@/components/ui/currency-field';
import RatesCredit from '@/components/ui/rates-credit';
import { cleanRateText, convertedCents, rateText, readOriginal } from '@/utils/foreignAmount';
import type { ReceiptLine } from '@/utils/receiptParser';
import { Expense, ExpenseItem, RepeatEvery, SplitMode } from '@/types/expenses';
import { TripMember } from '@/types/trips';
import { EXPENSE_CATEGORIES, QUICK_CATEGORIES, categoryLabel } from '@/utils/balance';
import TimeField from '@/components/ui/time-field';
import {
  centsToInput,
  formatDay,
  formatMoney,
  nowTime,
  parseAmount,
  receiptsOf,
  todayKey,
} from '@/utils/money';
import {
  cleanSplitText,
  computeShares,
  editSplit,
  emptyValues,
  evenValues,
  refill,
  splitByWeights,
  splitEqual,
  validateSplit,
} from '@/utils/split';
import { pickImage, takePhoto } from '@/utils/imagePicker';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View, Pressable } from 'react-native';

interface ExpenseFormProps {
  visible: boolean;
  onClose: () => void;
  tripId: string;
  currency: string;
  members: TripMember[];
  currentUserId: string;
  /** A photo taken before the form opened, e.g. from the dashboard's Receipt button. */
  initialReceiptUri?: string | null;
  /** When set, the form edits this expense instead of adding a new one. */
  expense?: Expense | null;
  onSaved: (expense: Expense) => void;
}

export default function ExpenseForm({
  visible,
  onClose,
  tripId,
  currency,
  members,
  currentUserId,
  initialReceiptUri,
  expense,
  onSaved,
}: ExpenseFormProps) {
  const isEditing = !!expense;
  const [title, setTitle] = useState('');
  const [amountText, setAmountText] = useState('');
  /** The currency it was paid in; the trip's own unless changed. */
  const [paidIn, setPaidIn] = useState(currency);
  /** The amount as paid, when paid in another currency. */
  const [foreignText, setForeignText] = useState('');
  /** Trip-currency units per one unit of `paidIn`. */
  const [fxRateText, setFxRateText] = useState('');
  const [fxRateStatus, setFxRateStatus] = useState<'loading' | 'ready' | 'missing'>('ready');
  /** Which day's rate is in the box, and where it came from. */
  const [fxRateInfo, setFxRateInfo] = useState<{
    day: string;
    source: 'history' | 'latest';
  } | null>(null);
  /** The currency and day the rate was looked up for, so a new date looks it up again. */
  const [fxLookedUp, setFxLookedUp] = useState('');
  /** True once the person typed their own rate; it is then never replaced. */
  const [fxTyped, setFxTyped] = useState(false);
  const [category, setCategory] = useState('food');
  // The full category grid, opened by "More" beside the everyday chips.
  const [pickingCategory, setPickingCategory] = useState(false);
  const [spentOn, setSpentOn] = useState(todayKey());
  const [spentTime, setSpentTime] = useState(nowTime());
  const [notes, setNotes] = useState('');
  const [repeat, setRepeat] = useState('never');

  // Day-to-day the payer is just you. The switch unlocks paying with others.
  const [multiplePayers, setMultiplePayers] = useState(false);
  const [payerAmounts, setPayerAmounts] = useState<Record<string, string>>({});
  // Who paid when it is just one person: you by default, but it can be anyone.
  const [soloPayerId, setSoloPayerId] = useState(currentUserId);

  // Itemised receipts: each line has its own price and the people sharing it.
  const [itemised, setItemised] = useState(false);
  const [items, setItems] = useState<
    { id: string; name: string; amount: string; sharedBy: string[] }[]
  >([]);

  const [splitMode, setSplitMode] = useState<SplitMode>('equal');
  // null means "nobody has touched the chips yet", which starts as everyone.
  const [splitIds, setSplitIds] = useState<string[] | null>(null);
  const [splitValues, setSplitValues] = useState<Record<string, number>>({});
  /** Rows typed into, oldest first; the others adjust so the split adds up. */
  const [splitEdited, setSplitEdited] = useState<string[]>([]);
  /** What is in each split box while typing, so "12." keeps its point. */
  const [splitTexts, setSplitTexts] = useState<Record<string, string>>({});

  // Photos already saved (web links) and newly picked ones (local files), in order.
  const [receiptUris, setReceiptUris] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  /** The fields a receipt scan may fill, as they stand right now. */
  const latest = useRef({ amountText, title, spentOn, itemised });
  // Kept in step after each render; the app's React Compiler forbids writing refs while rendering.
  useEffect(() => {
    latest.current = { amountText, title, spentOn, itemised };
  });
  /** Lines read off the receipt, offered as an item-by-item split. */
  const [scannedItems, setScannedItems] = useState<{
    items: ReceiptLine[];
    matches: boolean;
  } | null>(null);
  /** What reading the receipt photo found, shown under the photos. */
  const [scan, setScan] = useState<{
    status: 'scanning' | 'read' | 'guess' | 'nothing' | 'failed';
    text: string;
  } | null>(null);

  /**
   * Reads a new receipt photo on the phone and fills in what was left empty:
   * the amount, the title (the store's name) and the date. Anything the person
   * already typed is kept. Saved expenses are never rewritten by a scan.
   */
  const readReceipt = async (uri: string) => {
    if (isEditing || !uri || /^https?:\/\//.test(uri) || !canScanReceipts()) return;
    setScan({ status: 'scanning', text: 'Reading the receipt…' });
    try {
      const found = await scanReceipt(uri);
      // The form as it is now, after the scan: the person may have typed meanwhile.
      const now = latest.current;
      const filled: string[] = [];

      // Lines are offered, never applied on their own: splitting by item
      // changes the whole split, so the person chooses it.
      if (found.items?.length && !now.itemised) {
        setScannedItems({ items: found.items, matches: found.itemsMatchTotal !== false });
      }

      if (found.total && !now.itemised && !now.amountText.trim()) {
        setAmountText(centsToInput(Math.round(found.total * 100)));
        filled.push(formatMoney(found.total, currency));
      }
      if (found.merchant && !now.title.trim()) {
        setTitle(found.merchant);
        filled.push(found.merchant);
      }
      // Only a date that is not in the future, and only over the untouched default.
      if (found.date && found.date < todayKey() && now.spentOn === todayKey()) {
        setSpentOn(found.date);
        filled.push(formatDay(found.date));
      }

      if (!found.total) {
        setScan({
          status: 'nothing',
          text: 'Could not find a total on this receipt. Type the amount in above.',
        });
      } else if (!filled.length) {
        setScan({
          status: 'read',
          text: `The receipt says ${formatMoney(found.total, currency)}. Your own entries were kept.`,
        });
      } else {
        setScan({
          status: found.totalFrom === 'largest' ? 'guess' : 'read',
          text:
            (found.totalFrom === 'largest'
              ? 'Best guess from the receipt: '
              : 'Filled in from the receipt: ') +
            filled.join(' · ') +
            '. Check it before saving.',
        });
      }
    } catch (err) {
      console.warn('Could not read the receipt:', err);
      setScan({ status: 'failed', text: 'Could not read this photo. Type the amount in above.' });
    }
  };

  // A photo taken outside the form (the dashboard's Receipt button) is dropped
  // in as soon as the form opens, so it can go straight onto the new expense.
  useEffect(() => {
    if (!visible) return;
    setReceiptUris(expense ? receiptsOf(expense) : initialReceiptUri ? [initialReceiptUri] : []);
    setScan(null);
    setScannedItems(null);
    if (!expense) setPaidIn(currency);
    if (!expense && initialReceiptUri) void readReceipt(initialReceiptUri);
    // Runs once per opened photo; readReceipt reads the latest form state itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialReceiptUri, expense]);

  // Editing starts from what was saved.
  useEffect(() => {
    if (!visible || !expense) return;
    setTitle(expense.title);
    setAmountText(centsToInput(parseAmount(expense.amount)));
    const original = readOriginal(expense.original);
    setPaidIn(original?.currency ?? currency);
    setForeignText(original ? centsToInput(Math.round(original.amount * 100)) : '');
    setFxRateText(original ? rateText(original.rate) : '');
    setFxRateStatus('ready');
    // A saved rate stays as saved; it is looked up again only if the date changes.
    setFxLookedUp(original ? `${original.currency}|${expense.spentOn || todayKey()}` : '');
    setFxTyped(!!original);
    setFxRateInfo(null);
    setCategory(expense.category || 'other');
    setSpentOn(expense.spentOn || todayKey());
    setSpentTime(expense.spentTime ?? '');
    setNotes(expense.notes ?? '');

    const payers = Object.keys(expense.paidBy ?? {});
    setMultiplePayers(payers.length !== 1);
    setSoloPayerId(payers.length === 1 ? payers[0] : currentUserId);
    setItemised(!!expense.items?.length);
    setItems(
      (expense.items ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        amount: centsToInput(parseAmount(item.amount)),
        sharedBy: item.sharedBy ?? [],
      })),
    );
    setPayerAmounts(
      Object.fromEntries(
        // Paid abroad by several people: what each put in, in that currency.
        Object.entries(original?.paidBy ?? expense.paidBy ?? {}).map(([id, value]) => [
          id,
          centsToInput(parseAmount(value)),
        ]),
      ),
    );

    setSplitMode(expense.splitMode || 'equal');
    setSplitIds(Object.keys(expense.shares ?? {}));
    setSplitValues(expense.splitDetail?.input ?? {});
    // A saved split was set by hand: one edit moves only one other row.
    setSplitEdited(Object.keys(expense.splitDetail?.input ?? {}));
    setSplitTexts({});
    setError('');
  }, [visible, expense, currentUserId]);

  const itemsCents = items.reduce((sum, item) => sum + parseAmount(item.amount), 0);
  const totalCents = itemised ? itemsCents : parseAmount(amountText);
  const foreign = !itemised && paidIn !== currency;
  const foreignCents = parseAmount(foreignText);
  const fxRate = Number(fxRateText) || 0;

  /**
   * The amount as paid and the rate decide the trip-currency amount, which is
   * what the split and the balances use.
   */
  const applyForeign = (amount: string, rate: string) => {
    setForeignText(amount);
    setFxRateText(rate);
    const cents = convertedCents(parseAmount(amount), Number(rate) || 0);
    changeAmount(cents > 0 ? centsToInput(cents) : '');
  };

  /** Looks up the rate for the day of the expense, and applies it. */
  const lookUpRate = async (code: string, day: string, amount: string) => {
    setFxLookedUp(`${code}|${day}`);
    setFxRateStatus('loading');
    const found = await fetchRateOn(code, currency, day, todayKey());
    setFxRateStatus(found ? 'ready' : 'missing');
    setFxRateInfo(found ? { day: found.day, source: found.source } : null);
    applyForeign(amount, found ? rateText(found.rate) : '');
  };

  /** Picks the currency it was paid in, and loads that day's rate for it. */
  const choosePaidIn = async (code: string) => {
    setPaidIn(code);
    setFxTyped(false);
    // Amounts each payer put in were in the old currency; start them again.
    if (multiplePayers) setPayerAmounts({});
    if (code === currency) {
      setForeignText('');
      setFxRateText('');
      setFxRateStatus('ready');
      setFxRateInfo(null);
      setFxLookedUp('');
      return;
    }
    // An amount already typed (or read off a receipt) was what the receipt
    // says, so it becomes the amount paid in the new currency.
    const carried = foreign ? foreignText : amountText;
    setFxRateText('');
    applyForeign(carried, '');
    await lookUpRate(code, spentOn, carried);
  };

  // A new date means a different day's rate, unless the person typed their own.
  useEffect(() => {
    if (!visible || !foreign || fxTyped) return;
    if (fxLookedUp && fxLookedUp !== `${paidIn}|${spentOn}`) {
      void lookUpRate(paidIn, spentOn, foreignText);
    }
    // Only the date and currency decide when to look again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spentOn, paidIn, visible]);
  const allIds = useMemo(() => members.map((member) => member.id), [members]);

  // Everything is derived from the members list, so a selection can never
  // point at someone who is no longer in the trip.
  const itemShares = useMemo(() => {
    const result: Record<string, number> = {};
    items.forEach((item) => {
      const sharers = item.sharedBy.filter((id) => allIds.includes(id));
      const parts = splitEqual(parseAmount(item.amount), sharers);
      Object.entries(parts).forEach(([id, value]) => {
        result[id] = (result[id] ?? 0) + value;
      });
    });
    return result;
  }, [items, allIds]);

  const participants = itemised
    ? Object.keys(itemShares)
    : splitIds
      ? splitIds.filter((id) => allIds.includes(id))
      : allIds;
  const payerIds = multiplePayers
    ? Object.keys(payerAmounts).filter(
        (id) => allIds.includes(id) && parseAmount(payerAmounts[id]) > 0,
      )
    : [soloPayerId].filter(Boolean);

  const nameOf = (id: string): string =>
    members.find((member) => member.id === id)?.fullname || 'Member';

  /** The picture and colour of the category currently chosen. */
  const currentLook = categoryLook(category);
  // Capitalised, so React reads it as a component rather than a plain tag.
  const CurrentIcon = currentLook.icon;

  /** The five everyday categories, with their pictures, for the chip row. */
  const quickChoices = useMemo(
    () =>
      EXPENSE_CATEGORIES.filter((entry) => QUICK_CATEGORIES.includes(entry.value)).map((entry) => ({
        value: entry.value,
        label: entry.label,
        icon: categoryLook(entry.value).icon,
        iconColor: categoryLook(entry.value).tint,
      })),
    [],
  );

  const reset = () => {
    setTitle('');
    setAmountText('');
    setPaidIn(currency);
    setForeignText('');
    setFxRateText('');
    setFxRateStatus('ready');
    setFxRateInfo(null);
    setFxLookedUp('');
    setFxTyped(false);
    setCategory('food');
    setSpentOn(todayKey());
    setSpentTime(nowTime());
    setNotes('');
    setRepeat('never');
    setMultiplePayers(false);
    setPayerAmounts({});
    setSoloPayerId(currentUserId);
    setItemised(false);
    setItems([]);
    setSplitMode('equal');
    setSplitIds(null);
    setSplitValues({});
    setSplitEdited([]);
    setSplitTexts({});
    setReceiptUris([]);
    setScan(null);
    setError('');
    setSaving(false);
    setPickingCategory(false);
  };

  const handleClose = () => {
    if (saving) return;
    reset();
    onClose();
  };

  /** Opens the camera first, with the photo library as the other choice. */
  const handlePickReceipt = async (source: 'camera' | 'library') => {
    try {
      const result =
        source === 'camera'
          ? await takePhoto({ quality: 0.7 })
          : await pickImage({ includeBase64: false, quality: 0.7, multiple: true });

      if (result.denied) {
        setError(
          source === 'camera'
            ? 'Camera access is off. Turn it on in your phone settings to photograph a receipt.'
            : 'Photo access is off. Turn it on in your phone settings to pick a receipt.',
        );
        return;
      }

      const uris = ((result as any).assets ?? (result.asset ? [result.asset] : [])).map(
        (a: any) => a.uri,
      );
      if (uris.length) {
        setReceiptUris((previous) => [...previous, ...uris]);
        // The first photo of a new expense is read for its total.
        if (!isEditing && !amountText.trim()) void readReceipt(uris[0]);
      }
    } catch (err) {
      console.error('Failed to pick a receipt photo:', err);
      setError('Could not open your camera or photos.');
    }
  };

  /**
   * Starts a percent or custom split over: everyone even, nothing typed. Used
   * when the mode or the people sharing change, since the old numbers no
   * longer mean anything then.
   */
  const resetSplit = (mode: SplitMode, ids: string[], total: number) => {
    setSplitEdited([]);
    setSplitTexts({});
    setSplitValues(mode === 'equal' ? emptyValues(allIds) : evenValues(mode, total, ids));
  };

  const chooseParticipants = (next: string[]) => {
    setSplitIds(next);
    resetSplit(splitMode, next, totalCents);
  };

  const toggleParticipant = (id: string) => {
    const current = participants;
    chooseParticipants(
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  };

  const allSelected = participants.length === allIds.length;

  const changeMode = (mode: SplitMode) => {
    setSplitMode(mode);
    resetSplit(mode, participants, totalCents);
  };

  const changeAmount = (text: string) => {
    setAmountText(text);
    // A custom split's untouched rows follow the new total.
    if (splitMode === 'custom' && !itemised) {
      setSplitValues((previous) =>
        refill('custom', parseAmount(text), participants, previous, splitEdited),
      );
      setSplitTexts({});
    }
  };

  /**
   * One box typed into. The rows nobody typed into share what is left, and
   * once every row has been typed into, the one typed into longest ago adjusts.
   */
  const changeSplitValue = (id: string, text: string) => {
    const clean = cleanSplitText(text);
    const next = editSplit(
      splitMode,
      totalCents,
      participants,
      { values: splitValues, edited: splitEdited },
      id,
      Number(clean) || 0,
    );
    setSplitValues(next.values);
    setSplitEdited(next.edited);
    // Only the box being typed in keeps its raw text; the rest show numbers.
    setSplitTexts({ [id]: clean });
  };

  /** Back to an even split, for when the numbers got muddled. */
  const autoBalance = () => {
    if (splitMode === 'equal') return;
    resetSplit(splitMode, participants, totalCents);
  };

  const previewShares = useMemo(
    () => (itemised ? itemShares : computeShares(splitMode, totalCents, participants, splitValues)),
    [itemised, itemShares, splitMode, totalCents, participants, splitValues],
  );

  const previewTotal = Object.values(previewShares).reduce((sum, value) => sum + value, 0);
  const previewLeft = totalCents - previewTotal;

  const handleSave = async () => {
    if (saving) return;
    setError('');

    if (!itemised && totalCents > 0 && splitMode !== 'equal' && Math.abs(previewLeft) > 1) {
      setError('Make the split add up to the total first - use the helper below the fields.');
      return;
    }

    if (!title.trim()) {
      setError('Give this expense a name.');
      return;
    }
    if (totalCents <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }

    if (itemised) {
      if (items.some((item) => parseAmount(item.amount) > 0 && item.sharedBy.length === 0)) {
        setError('Pick at least one person to share each item.');
        return;
      }
      if (items.some((item) => !item.name.trim() && parseAmount(item.amount) > 0)) {
        setError('Give every item a name.');
        return;
      }
    }

    // Money paid: one payer takes the whole bill, or several must add up.
    let paidBy: Record<string, number> = {};
    let foreignPaidBy: Record<string, number> | undefined;
    if (multiplePayers) {
      const entries = payerIds
        .map((id) => [id, parseAmount(payerAmounts[id]) / 100] as const)
        .filter(([, value]) => value > 0);
      if (entries.length === 0) {
        setError('Add at least one person who paid.');
        return;
      }
      // Paid abroad, each payer's amount is in the currency it was paid in.
      const payerCurrency = foreign ? paidIn : currency;
      const target = foreign ? foreignCents : totalCents;
      const paidTotal = entries.reduce((sum, [, value]) => sum + value, 0);
      // Whole cents, not "within a cent": one cent of slack lets a save through
      // that leaves the trip's balances off by that cent forever.
      if (Math.round(paidTotal * 100) !== target) {
        setError(
          `The amounts paid add up to ${formatMoney(paidTotal, payerCurrency)}, not ${formatMoney(
            target / 100,
            payerCurrency,
          )}.`,
        );
        return;
      }
      if (foreign) {
        // Each payer's share of the converted total, to the cent, adding up exactly.
        foreignPaidBy = Object.fromEntries(entries);
        const converted = splitByWeights(
          totalCents,
          Object.fromEntries(entries.map(([id, value]) => [id, Math.round(value * 100)])),
        );
        paidBy = Object.fromEntries(
          Object.entries(converted).map(([id, value]) => [id, value / 100]),
        );
      } else {
        paidBy = Object.fromEntries(entries);
      }
    } else {
      if (!soloPayerId) {
        setError('Pick who paid.');
        return;
      }
      paidBy = { [soloPayerId]: totalCents / 100 };
    }

    const check = itemised
      ? { ok: true, message: '' }
      : validateSplit(splitMode, totalCents, participants, splitValues);
    if (!check.ok) {
      setError(check.message || 'Check the split and try again.');
      return;
    }

    setSaving(true);

    try {
      const receiptUrls: string[] = [];
      for (const uri of receiptUris) {
        // Photos that are already uploaded keep their link.
        if (/^https?:\/\//.test(uri)) {
          receiptUrls.push(uri);
          continue;
        }
        try {
          receiptUrls.push(await uploadReceipt(uri, tripId));
        } catch (uploadError) {
          console.error('Failed to upload receipt:', uploadError);
          setError(
            `The receipt photo could not be uploaded, so the expense was not saved. (${
              (uploadError as any)?.message ?? 'unknown error'
            })`,
          );
          setSaving(false);
          return;
        }
      }

      const sharesCents = Object.fromEntries(
        Object.entries(previewShares).map(([id, value]) => [id, value / 100]),
      );

      const savedItems: ExpenseItem[] = itemised
        ? items
            .filter((item) => parseAmount(item.amount) > 0)
            .map((item) => ({
              id: item.id,
              name: item.name.trim(),
              amount: parseAmount(item.amount) / 100,
              sharedBy: item.sharedBy.filter((id) => allIds.includes(id)),
            }))
        : [];

      const input: ExpenseInput = {
        title,
        amount: totalCents / 100,
        category,
        spentOn,
        spentTime,
        notes,
        paidBy,
        shares: sharesCents,
        splitMode: itemised ? 'custom' : splitMode,
        splitDetail: {
          mode: itemised ? 'custom' : splitMode,
          ...(itemised
            ? { input: sharesCents }
            : splitMode !== 'equal'
              ? { input: splitValues }
              : {}),
        },
        items: savedItems,
        receiptUrls,
        ...(foreign && foreignCents > 0 && fxRate > 0
          ? {
              original: {
                currency: paidIn,
                amount: foreignCents / 100,
                rate: fxRate,
                ...(foreignPaidBy ? { paidBy: foreignPaidBy } : {}),
              },
            }
          : {}),
        createdBy: expense?.createdBy ?? currentUserId,
      };

      let saved: Expense;
      if (expense) {
        const names = Object.fromEntries(members.map((m) => [m.id, m.fullname]));
        const entry = await updateExpense(tripId, expense.id, input, {
          before: expense,
          context: {
            currency,
            names,
            by: currentUserId,
            byName: names[currentUserId] || 'Someone',
          },
        });
        saved = {
          ...expense,
          history: entry ? [entry, ...(expense.history ?? [])] : expense.history,
          ...input,
          receiptUrl: input.receiptUrls?.[0],
          receiptUrls: input.receiptUrls?.length ? input.receiptUrls : undefined,
          title: title.trim(),
          amount: totalCents / 100,
          notes: notes.trim() || undefined,
          // The next edit builds on this one.
          revision: (expense.revision ?? 0) + 1,
        };
      } else {
        saved = await createExpense(tripId, input);
        if (repeat !== 'never') {
          await createRecurring(
            tripId,
            {
              title: title.trim(),
              amount: totalCents / 100,
              category,
              every: repeat as RepeatEvery,
              spentTime,
              notes: notes.trim() || undefined,
              paidBy: saved.paidBy,
              shares: saved.shares,
              splitMode: saved.splitMode,
              createdBy: currentUserId,
            },
            spentOn,
          );
        }
      }

      reset();
      onSaved(saved);
    } catch (err: any) {
      console.error('Failed to save expense:', err);
      setError(err?.message || 'Could not save that expense. Please try again.');
      setSaving(false);
    }
  };

  const paidPreviewTotal = multiplePayers
    ? payerIds.reduce((sum, id) => sum + parseAmount(payerAmounts[id]) / 100, 0)
    : totalCents / 100;

  const newItemId = () => Math.random().toString(36).slice(2, 10);

  const updateItem = (
    id: string,
    patch: Partial<{ name: string; amount: string; sharedBy: string[] }>,
  ) =>
    setItems((previous) => previous.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  const splitPayersEvenly = () => {
    // Paid abroad, payers type what they paid in that currency.
    const target = foreign ? foreignCents : totalCents;
    if (target <= 0 || allIds.length === 0) return;
    const even = splitEqual(target, allIds);
    const next: Record<string, string> = {};
    allIds.forEach((id) => {
      next[id] = centsToInput(even[id] ?? 0);
    });
    setPayerAmounts(next);
  };

  return (
    <BottomSheet
      visible={visible}
      title={isEditing ? 'Edit expense' : 'Add expense'}
      onClose={handleClose}
      footer={
        <>
          {!!error && <HelperText tone="error">{error}</HelperText>}
          <PrimaryButton
            title={saving ? 'Saving…' : isEditing ? 'Save changes' : 'Save expense'}
            onPress={handleSave}
            buttonColor={BrandColors.base50}
            textColor={BrandColors.primary}
            borderColor={BrandColors.base50}
            borderWidth={0}
            disabled={saving}
          />
        </>
      }
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
      >
        <TextField
          title="What was it for?"
          placeholder="e.g. Dinner at Kanto"
          value={title}
          onChangeText={setTitle}
        />
        {itemised ? (
          <View style={styles.group}>
            <FieldLabel>Total</FieldLabel>
            <Text style={styles.itemTotal}>{formatMoney(itemsCents / 100, currency)}</Text>
          </View>
        ) : (
          <View style={styles.group}>
            {/* The amount and its currency share one row: the currency is a
                property of the number, not a separate question. */}
            <View style={styles.amountRow}>
              <View style={styles.amountField}>
                <TextField
                  title="Amount"
                  placeholder="0.00"
                  value={foreign ? foreignText : amountText}
                  onChangeText={foreign ? (text) => applyForeign(text, fxRateText) : changeAmount}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.paidInField}>
                <CurrencyField title="Paid in" value={paidIn} onChange={choosePaidIn} compact />
              </View>
            </View>

            {foreign && (
              <>
                <View style={styles.fxRow}>
                  <Text style={styles.fxLabel}>1 {paidIn} =</Text>
                  <View style={styles.fxInput}>
                    <TextField
                      title=""
                      placeholder={fxRateStatus === 'loading' ? 'Loading…' : 'Rate'}
                      value={fxRateText}
                      onChangeText={(text) => {
                        setFxTyped(true);
                        applyForeign(foreignText, cleanRateText(text));
                      }}
                      keyboardType="numeric"
                    />
                  </View>
                  <Text style={styles.fxLabel}>{currency}</Text>
                </View>
                <HelperText tone={fxRateStatus === 'missing' && !fxRate ? 'error' : 'muted'}>
                  {fxRateStatus === 'missing' && !fxRate
                    ? 'Could not load a rate. Type the rate your card or money changer used.'
                    : `Comes to ${formatMoney(totalCents / 100, currency)} in the trip’s currency. ${
                        fxTyped
                          ? 'Using the rate you typed.'
                          : fxRateInfo?.source === 'history'
                            ? `The rate is the published one for ${formatDay(fxRateInfo.day)}.`
                            : 'The rate is today’s; no published rate was found for that day.'
                      } Change it to match what you were charged.`}
                </HelperText>
                {!fxTyped && fxRateInfo?.source === 'latest' && <RatesCredit />}
                {!fxTyped && fxRateInfo?.source === 'history' && (
                  <Text style={styles.fxCredit}>Rates by Frankfurter</Text>
                )}
              </>
            )}
          </View>
        )}

        <View style={styles.group}>
          <FieldLabel
            right={
              <Pressable
                onPress={() => setPickingCategory(true)}
                hitSlop={8}
                style={styles.moreLink}
                accessibilityRole="button"
                accessibilityLabel="See all categories"
              >
                <Text style={styles.linkText}>More</Text>
                <ChevronDown size={13} color={BrandColors.info} />
              </Pressable>
            }
          >
            Category
          </FieldLabel>
          <ChoiceChips choices={quickChoices} selectedValue={category} onSelect={setCategory} />
          {/* An older expense can carry a category that is not one of the five,
              so it is shown here rather than quietly swapped for "Food". */}
          {!QUICK_CATEGORIES.includes(category) && (
            <Pressable
              onPress={() => setPickingCategory(true)}
              style={styles.fullCategory}
              accessibilityRole="button"
              accessibilityLabel={`Category: ${categoryLabel(category)}`}
            >
              <View style={[styles.fullCategoryIcon, { backgroundColor: currentLook.bg }]}>
                <CurrentIcon size={14} color={currentLook.tint} />
              </View>
              <Text style={styles.fullCategoryText}>{categoryLabel(category)}</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.group}>
          <FieldLabel>When</FieldLabel>
          {/* The day and the time share one row, as one answer to "when". Both
              open the same kind of pop-up: a calendar, and a time picker. */}
          <View style={styles.whenRow}>
            <View style={styles.whenDay}>
              <DayField label="Date" value={spentOn} onChange={setSpentOn} maxDay={todayKey()} />
            </View>
            <View style={styles.whenTime}>
              <TimeField value={spentTime} onChange={setSpentTime} />
            </View>
          </View>
        </View>

        {/* ----- Who paid ----- */}
        <PayerSection
          members={members}
          currentUserId={currentUserId}
          // Paid abroad, each payer types what they paid in that currency.
          currency={foreign ? paidIn : currency}
          multiplePayers={multiplePayers}
          onToggleMultiple={(value) => {
            setMultiplePayers(value);
            if (value) setPayerAmounts({});
          }}
          payerAmounts={payerAmounts}
          onChangePayerAmount={(memberId, text) =>
            setPayerAmounts((previous) => ({ ...previous, [memberId]: text }))
          }
          soloPayerId={soloPayerId}
          onPickSoloPayer={setSoloPayerId}
          paidPreviewTotal={paidPreviewTotal}
          totalAmount={(foreign ? foreignCents : totalCents) / 100}
          onSplitEvenly={splitPayersEvenly}
          nameOf={nameOf}
        />

        {/* ----- Who shares it, and how ----- */}
        <ExpenseSplitSection
          members={members}
          currency={currency}
          currentUserId={currentUserId}
          participants={participants}
          onToggleParticipant={toggleParticipant}
          onSelectAll={() => chooseParticipants(allSelected ? [] : [...allIds])}
          allSelected={allSelected}
          splitMode={splitMode}
          onChangeMode={changeMode}
          itemised={itemised}
          onToggleItemised={(value) => {
            setItemised(value);
            if (value && items.length === 0) {
              setItems([{ id: newItemId(), name: '', amount: amountText, sharedBy: [...allIds] }]);
            }
          }}
          splitValues={splitValues}
          splitTexts={splitTexts}
          splitEdited={splitEdited}
          onChangeSplitValue={changeSplitValue}
          previewShares={previewShares}
          previewLeft={previewLeft}
          onAutoBalance={autoBalance}
        />

        {itemised && (
          <ItemisedEditor
            items={items}
            setItems={setItems}
            members={members}
            allIds={allIds}
            currency={currency}
            itemShares={itemShares}
            nameOf={nameOf}
            updateItem={updateItem}
            currentUserId={currentUserId}
          />
        )}

        {/* ----- Receipt ----- */}
        <ReceiptPicker
          uris={receiptUris}
          onRemove={(index) => setReceiptUris((previous) => previous.filter((_, i) => i !== index))}
          onPick={handlePickReceipt}
        />
        {!!scan && (
          <HelperText
            tone={
              scan.status === 'read' ? 'success' : scan.status === 'scanning' ? 'muted' : 'error'
            }
          >
            {scan.text}
          </HelperText>
        )}
        {!!scannedItems && !itemised && (
          <Pressable
            style={({ pressed }) => [styles.scanItems, pressed && { opacity: 0.7 }]}
            onPress={() => {
              setItemised(true);
              setItems(
                scannedItems.items.map((line) => ({
                  id: newItemId(),
                  name: line.name,
                  amount: centsToInput(Math.round(line.amount * 100)),
                  sharedBy: [...allIds],
                })),
              );
              setScannedItems(null);
            }}
            accessibilityRole="button"
          >
            <ListChecks size={18} color={BrandColors.primary} />
            <View style={styles.scanItemsText}>
              <Text style={styles.scanItemsTitle}>
                Split by item · {scannedItems.items.length} lines read
              </Text>
              <Text style={styles.scanItemsHint}>
                {scannedItems.matches
                  ? 'Then tap who had what. Everyone shares each line to start with.'
                  : `The lines add up to ${formatMoney(
                      scannedItems.items.reduce((sum, line) => sum + line.amount, 0),
                      currency,
                    )}, not the total. Check them after.`}
              </Text>
            </View>
          </Pressable>
        )}

        <TextField
          title="Notes (optional)"
          placeholder="Who ordered what, tips, etc."
          value={notes}
          onChangeText={setNotes}
          multiline
          minHeight={110}
        />

        {!expense && (
          <View style={styles.group}>
            <FieldLabel>Repeat</FieldLabel>
            <ChoiceChips
              choices={[
                { value: 'never', label: 'Never' },
                { value: 'daily', label: 'Daily' },
                { value: 'weekly', label: 'Weekly' },
                { value: 'monthly', label: 'Monthly' },
              ]}
              selectedValue={repeat}
              onSelect={setRepeat}
            />
            {repeat !== 'never' && (
              <Text style={styles.repeatHint}>
                The same expense, with the same split, is added again{' '}
                {repeat === 'daily' ? 'each day' : repeat === 'weekly' ? 'each week' : 'each month'}{' '}
                when someone opens the trip. You can stop it from the Expenses tab.
              </Text>
            )}
          </View>
        )}

        <View style={styles.summaryCard}>
          <Receipt size={16} color={BrandColors.secondary} />
          <Text style={styles.summaryText}>
            {participants.length} {participants.length === 1 ? 'person shares' : 'people share'}{' '}
            this bill of {formatMoney(totalCents / 100, currency)}.
          </Text>
        </View>
      </ScrollView>

      {/* The full category grid. Its own modal, sitting above the form sheet
          the way the receipt viewer does, so the form's footer is never
          covered while a category is being picked. */}
      <CategoryPicker
        visible={pickingCategory}
        onClose={() => setPickingCategory(false)}
        options={EXPENSE_CATEGORIES}
        selectedValue={category}
        onSelect={(value) => {
          setCategory(value);
          setPickingCategory(false);
        }}
      />
    </BottomSheet>
  );
}
