import InlineInput from '@/components/trip/inline-input';
import ItemisedEditor from '@/components/trip/itemised-editor';
import ReceiptPicker from '@/components/trip/receipt-picker';
import PrimaryButton from '@/components/Button/primary-button';
import Avatar from '@/components/ui/avatar';
import BottomSheet from '@/components/ui/bottom-sheet';
import { HelperText } from '@/components/ui/card';
import ChoiceChips, { FieldLabel } from '@/components/ui/choice-chips';
import DateCalendar from '@/components/ui/date-calendar';
import { TextField } from '@/components/ui/text-input-field';
import { categoryLook } from '@/constants/expense-categories';
import { BrandColors, Spacing } from '@/constants/theme';
import { createRecurring } from '@/services/Firebase/recurringService';
import { createExpense, ExpenseInput, updateExpense } from '@/services/Firebase/expenseService';
import { uploadReceipt } from '@/services/Supabase/receiptService';
import { Expense, ExpenseItem, RepeatEvery, SplitMode } from '@/types/expenses';
import { TripMember } from '@/types/trips';
import { EXPENSE_CATEGORIES } from '@/utils/balance';
import TimeField from '@/components/ui/time-field';
import {
  centsToInput,
  formatMoney,
  nowTime,
  parseAmount,
  receiptsOf,
  todayKey,
} from '@/utils/money';
import {
  balanceValues,
  computeShares,
  emptyValues,
  splitEqual,
  validateSplit,
} from '@/utils/split';
import { pickImage, takePhoto } from '@/utils/imagePicker';
import { Check, Receipt, Users } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

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

const TIME_PRESETS = ['07:00', '09:00', '12:00', '15:00', '18:00', '20:00'];

const SPLIT_CHOICES = [
  { value: 'equal', label: 'Equal' },
  { value: 'percentage', label: 'Percent' },
  { value: 'custom', label: 'Custom' },
];

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
  const [category, setCategory] = useState('food');
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

  // Photos already saved (web links) and newly picked ones (local files), in order.
  const [receiptUris, setReceiptUris] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // A photo taken outside the form (the dashboard's Receipt button) is dropped
  // in as soon as the form opens, so it can go straight onto the new expense.
  useEffect(() => {
    if (!visible) return;
    setReceiptUris(expense ? receiptsOf(expense) : initialReceiptUri ? [initialReceiptUri] : []);
  }, [visible, initialReceiptUri, expense]);

  // Editing starts from what was saved.
  useEffect(() => {
    if (!visible || !expense) return;
    setTitle(expense.title);
    setAmountText(centsToInput(parseAmount(expense.amount)));
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
        Object.entries(expense.paidBy ?? {}).map(([id, value]) => [
          id,
          centsToInput(parseAmount(value)),
        ]),
      ),
    );

    setSplitMode(expense.splitMode || 'equal');
    setSplitIds(Object.keys(expense.shares ?? {}));
    setSplitValues(expense.splitDetail?.input ?? {});
    setError('');
  }, [visible, expense, currentUserId]);

  const itemsCents = items.reduce((sum, item) => sum + parseAmount(item.amount), 0);
  const totalCents = itemised ? itemsCents : parseAmount(amountText);
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

  const reset = () => {
    setTitle('');
    setAmountText('');
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
    setReceiptUris([]);
    setError('');
    setSaving(false);
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
      if (uris.length) setReceiptUris((previous) => [...previous, ...uris]);
    } catch (err) {
      console.error('Failed to pick a receipt photo:', err);
      setError('Could not open your camera or photos.');
    }
  };

  const toggleParticipant = (id: string) => {
    const current = participants;
    const next = current.includes(id) ? current.filter((value) => value !== id) : [...current, id];
    setSplitIds(next);
    setSplitValues((previous) => {
      const cleaned: Record<string, number> = {};
      next.forEach((value) => {
        cleaned[value] = previous[value] ?? 0;
      });
      return cleaned;
    });
  };

  const allSelected = participants.length === allIds.length;

  /** Seeds sensible starting values when the split mode changes. */
  const recomputeSplit = (mode: SplitMode, nextTotal: number) => {
    if (mode === 'equal') {
      setSplitValues(emptyValues(allIds));
      return;
    }

    const seeded: Record<string, number> = {};

    if (mode === 'percentage') {
      const even = Math.round((100 / Math.max(participants.length, 1)) * 100) / 100;
      participants.forEach((id) => {
        seeded[id] = even;
      });
    } else {
      const evenCents = splitEqual(nextTotal, participants);
      participants.forEach((id) => {
        seeded[id] = (evenCents[id] ?? 0) / 100;
      });
    }

    setSplitValues(seeded);
  };

  const changeMode = (mode: SplitMode) => {
    setSplitMode(mode);
    recomputeSplit(mode, totalCents);
  };

  const changeAmount = (text: string) => {
    setAmountText(text);
  };

  /** Types into one row, then lets the last edited row take the leftover. */
  const changeSplitValue = (id: string, text: string) => {
    const numeric = Number(text.replace(/[^0-9.]/g, '')) || 0;
    setSplitValues((previous) => {
      const next = { ...previous, [id]: numeric };
      const others = participants.filter((value) => value !== id);
      if (others.length === 0) return next;

      if (splitMode === 'percentage') {
        const othersTotal = others.reduce((sum, value) => sum + (next[value] || 0), 0);
        const remaining = Math.max(0, Math.round((100 - othersTotal) * 100) / 100);
        // Only auto-fill when exactly one person is left; otherwise respect typing.
        if (others.length === 1) {
          next[others[0]] = remaining;
        }
      } else if (splitMode === 'custom') {
        const othersTotal = others.reduce((sum, value) => sum + (next[value] || 0), 0);
        const remaining = Math.max(0, Math.round((totalCents / 100 - othersTotal) * 100) / 100);
        if (others.length === 1) {
          next[others[0]] = remaining;
        }
      }

      return next;
    });
  };

  /** Re-balances explicitly, for the "make it add up" shortcut. */
  const autoBalance = () => {
    if (splitMode === 'equal') return;
    const anchor = participants[participants.length - 1];
    setSplitValues((previous) =>
      balanceValues(splitMode, totalCents, participants, previous, anchor),
    );
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
    if (multiplePayers) {
      const entries = payerIds
        .map((id) => [id, parseAmount(payerAmounts[id]) / 100] as const)
        .filter(([, value]) => value > 0);
      if (entries.length === 0) {
        setError('Add at least one person who paid.');
        return;
      }
      paidBy = Object.fromEntries(entries);
      const paidTotal = entries.reduce((sum, [, value]) => sum + value, 0);
      if (Math.abs(paidTotal - totalCents / 100) > 0.01) {
        setError(
          `The amounts paid add up to ${formatMoney(paidTotal, currency)}, not ${formatMoney(
            totalCents / 100,
            currency,
          )}.`,
        );
        return;
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
    const target = totalCents;
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
          <TextField
            title={`Amount (${currency})`}
            placeholder="0.00"
            value={amountText}
            onChangeText={changeAmount}
            keyboardType="numeric"
          />
        )}

        <View style={styles.group}>
          <FieldLabel>Category</FieldLabel>
          <ChoiceChips
            choices={EXPENSE_CATEGORIES.map((entry) => ({
              value: entry.value,
              label: entry.label,
              icon: categoryLook(entry.value).icon,
              iconColor: categoryLook(entry.value).tint,
            }))}
            selectedValue={category}
            onSelect={setCategory}
          />
        </View>

        <View style={styles.group}>
          <FieldLabel>When</FieldLabel>
          <DateCalendar value={spentOn} onChange={setSpentOn} maxDay={todayKey()} />
        </View>

        <View style={styles.group}>
          <FieldLabel>Time</FieldLabel>
          <TimeField value={spentTime} onChange={setSpentTime} presets={TIME_PRESETS} />
        </View>

        {/* ----- Who paid ----- */}
        <View style={styles.group}>
          <FieldLabel>Who paid?</FieldLabel>
          <Text style={styles.sectionHint}>
            The money left someone's pocket. If one person covered the whole bill, leave the switch
            off.
          </Text>
          <View style={styles.switchRow}>
            <View style={styles.switchTextWrap}>
              <Text style={styles.switchLabel}>More than one person paid</Text>
              <Text style={styles.switchHint}>
                Turn this on when two or more of you chipped in for the same bill.
              </Text>
            </View>
            <Switch
              value={multiplePayers}
              onValueChange={(value) => {
                setMultiplePayers(value);
                if (value) setPayerAmounts({});
              }}
              trackColor={{ false: BrandColors.border, true: BrandColors.base400 }}
              thumbColor={multiplePayers ? BrandColors.base50 : BrandColors.background}
              {...({ activeThumbColor: BrandColors.base50 } as object)}
            />
          </View>

          {multiplePayers ? (
            <View style={styles.payerList}>
              {members.map((member) => (
                <View key={member.id} style={styles.payerRow}>
                  <Avatar name={member.fullname} size={32} photoURL={member.photoURL} />
                  <Text style={styles.payerName} numberOfLines={1}>
                    {member.fullname}
                  </Text>
                  <View style={styles.payerInput}>
                    <Text style={styles.payerCurrency}>{currency}</Text>
                    <InlineInput
                      value={payerAmounts[member.id] ?? ''}
                      placeholder="0.00"
                      onChangeText={(text) =>
                        setPayerAmounts((previous) => ({ ...previous, [member.id]: text }))
                      }
                    />
                  </View>
                </View>
              ))}
              <Pressable style={styles.splitEvenPayers} onPress={splitPayersEvenly}>
                <Users size={14} color={BrandColors.info} />
                <Text style={styles.splitEvenText}>Split the total evenly between everyone</Text>
              </Pressable>
              <HelperText
                tone={Math.abs(paidPreviewTotal - totalCents / 100) > 0.01 ? 'error' : 'success'}
              >
                Paid so far {formatMoney(paidPreviewTotal, currency)} of{' '}
                {formatMoney(totalCents / 100, currency)}
              </HelperText>
            </View>
          ) : (
            <View style={styles.payerList}>
              <View style={styles.participantGrid}>
                {members.map((member) => {
                  const on = member.id === soloPayerId;
                  return (
                    <Pressable
                      key={member.id}
                      style={[styles.participant, on && styles.participantOn]}
                      onPress={() => setSoloPayerId(member.id)}
                    >
                      <Avatar name={member.fullname} size={22} photoURL={member.photoURL} />
                      <Text
                        style={[styles.participantName, on && styles.participantNameOn]}
                        numberOfLines={1}
                      >
                        {member.id === currentUserId ? 'You' : member.fullname.split(' ')[0]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <HelperText>{nameOf(soloPayerId)} paid the whole bill.</HelperText>
            </View>
          )}
        </View>

        {/* ----- Itemised receipt ----- */}
        <View style={styles.group}>
          <View style={styles.switchRow}>
            <View style={styles.switchTextWrap}>
              <Text style={styles.switchLabel}>Itemise the receipt</Text>
              <Text style={styles.switchHint}>
                Enter each item with its price and choose who shared it.
              </Text>
            </View>
            <Switch
              value={itemised}
              onValueChange={(value) => {
                setItemised(value);
                if (value && items.length === 0) {
                  setItems([
                    { id: newItemId(), name: '', amount: amountText, sharedBy: [...allIds] },
                  ]);
                }
              }}
              trackColor={{ false: BrandColors.border, true: BrandColors.base400 }}
              thumbColor={itemised ? BrandColors.base50 : BrandColors.background}
              {...({ activeThumbColor: BrandColors.base50 } as object)}
            />
          </View>
        </View>

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
          />
        )}

        {/* ----- Who shares it ----- */}
        {!itemised && (
          <View style={styles.group}>
            <FieldLabel
              right={
                <Pressable onPress={() => setSplitIds(allSelected ? [] : [...allIds])} hitSlop={8}>
                  <Text style={styles.linkText}>{allSelected ? 'Clear' : 'Select all'}</Text>
                </Pressable>
              }
            >
              Who shares the cost?
            </FieldLabel>

            <Text style={styles.sectionHint}>
              The people who owe a part of this bill. This can be different from who paid.
            </Text>

            <View style={styles.participantGrid}>
              {members.map((member) => {
                const isIn = participants.includes(member.id);
                return (
                  <Pressable
                    key={member.id}
                    style={[styles.participant, isIn && styles.participantOn]}
                    onPress={() => toggleParticipant(member.id)}
                  >
                    <View style={[styles.participantCheck, isIn && styles.participantCheckOn]}>
                      {isIn && <Check size={12} color={BrandColors.background} />}
                    </View>
                    <Text
                      style={[styles.participantName, isIn && styles.participantNameOn]}
                      numberOfLines={1}
                    >
                      {member.fullname.split(' ')[0]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <ChoiceChips
              choices={SPLIT_CHOICES}
              selectedValue={splitMode}
              onSelect={(value) => changeMode(value as SplitMode)}
              equalWidth
            />

            {splitMode !== 'equal' && (
              <View style={styles.splitEditor}>
                {members
                  .filter((member) => participants.includes(member.id))
                  .map((member) => (
                    <View key={member.id} style={styles.splitRow}>
                      {/* The name and its money share one column, so a long name
                        can never squeeze the input field into the number. */}
                      <View style={styles.splitLeft}>
                        <Text style={styles.splitName} numberOfLines={1}>
                          {member.fullname}
                        </Text>
                        <Text style={styles.splitShare} numberOfLines={1}>
                          {formatMoney((previewShares[member.id] ?? 0) / 100, currency)}
                        </Text>
                      </View>
                      <View style={styles.splitInputWrap}>
                        <InlineInput
                          value={splitValues[member.id] ? String(splitValues[member.id]) : ''}
                          placeholder="0"
                          onChangeText={(text) => changeSplitValue(member.id, text)}
                        />
                        <Text style={styles.splitUnit}>
                          {splitMode === 'percentage' ? '%' : currency}
                        </Text>
                      </View>
                    </View>
                  ))}

                <Pressable style={styles.splitEvenPayers} onPress={autoBalance}>
                  <Text style={styles.splitEvenText}>Make it add up automatically</Text>
                </Pressable>

                <HelperText tone={Math.abs(previewLeft) > 1 ? 'error' : 'success'}>
                  {Math.abs(previewLeft) > 1
                    ? `${formatMoney(Math.abs(previewLeft) / 100, currency)} still ${
                        previewLeft > 0 ? 'unassigned' : 'over the total'
                      }`
                    : 'The split adds up to the total.'}
                </HelperText>
              </View>
            )}
          </View>
        )}

        {/* ----- Receipt ----- */}
        <ReceiptPicker
          uris={receiptUris}
          onRemove={(index) => setReceiptUris((previous) => previous.filter((_, i) => i !== index))}
          onPick={handlePickReceipt}
        />

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
    </BottomSheet>
  );
}

/** A compact numeric field that sits inside a row with its own border. */
const styles = StyleSheet.create({
  scroll: { gap: Spacing.four, paddingBottom: Spacing.four },
  repeatHint: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 12, color: BrandColors.secondary },
  itemTotal: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 22, color: BrandColors.primary },
  group: {
    gap: Spacing.two,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: BrandColors.surfaceAlt,
    borderRadius: 12,
    padding: Spacing.three,
  },
  switchTextWrap: {
    flex: 1,
    gap: 2,
  },
  switchLabel: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    color: BrandColors.primary,
  },
  switchHint: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    color: BrandColors.secondary,
  },
  sectionHint: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: BrandColors.secondary,
  },
  payerList: {
    gap: Spacing.two,
  },
  payerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 12,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  payerName: {
    flex: 1,
    minWidth: 0,
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 13,
    color: BrandColors.primary,
  },
  payerInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 8,
    backgroundColor: BrandColors.surfaceAlt,
    width: 120,
    flexShrink: 0,
  },
  payerCurrency: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    color: BrandColors.secondary,
    paddingLeft: 6,
    flexShrink: 0,
  },
  splitEvenPayers: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.one,
  },
  splitEvenText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: BrandColors.info,
  },
  singlePayer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  linkText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: BrandColors.info,
  },
  participantGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  participant: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BrandColors.border,
    maxWidth: '48%',
  },
  participantOn: {
    borderColor: BrandColors.base50,
    backgroundColor: BrandColors.base200,
  },
  participantCheck: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BrandColors.disabled,
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantCheckOn: {
    backgroundColor: BrandColors.primary,
    borderColor: BrandColors.primary,
  },
  participantName: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: BrandColors.secondary,
  },
  participantNameOn: {
    color: BrandColors.primary,
    fontFamily: 'PlusJakartaSans-Bold',
  },
  splitEditor: {
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 12,
    padding: Spacing.three,
    backgroundColor: BrandColors.surfaceAlt,
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  splitLeft: {
    flex: 1,
    // minWidth lets this column shrink inside the row. Without it the text
    // box keeps its full width and draws over the input beside it.
    minWidth: 0,
    gap: 2,
  },
  splitName: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 13,
    color: BrandColors.primary,
  },
  splitInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 8,
    backgroundColor: BrandColors.background,
    width: 112,
    flexShrink: 0,
  },
  splitUnit: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    color: BrandColors.secondary,
    paddingRight: 6,
    flexShrink: 0,
  },
  splitShare: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: BrandColors.secondary,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: BrandColors.infoBg,
    borderRadius: 12,
    padding: Spacing.three,
  },
  summaryText: {
    flex: 1,
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: BrandColors.primary,
  },
});
