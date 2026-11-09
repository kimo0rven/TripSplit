import PrimaryButton from '@/components/Button/primary-button';
import Avatar from '@/components/ui/avatar';
import BottomSheet from '@/components/ui/bottom-sheet';
import { HelperText } from '@/components/ui/card';
import { PayToCard } from '@/components/trip/settle/pay-to-card';
import TabSlider from '@/components/ui/tab-slider';
import { TextField } from '@/components/ui/text-input-field';
import { BrandColors, Spacing } from '@/constants/theme';
import { fetchExpenses } from '@/services/Firebase/expenseService';
import { createSettlement, fetchSettlements } from '@/services/Firebase/settlementService';
import { isConnected } from '@/services/offline/offlineStore';
import { DebtEdge, Settlement } from '@/types/expenses';
import { TripMember } from '@/types/trips';
import { computeBalances, simplifyDebts } from '@/utils/balance';
import { formatMoney, todayKey } from '@/utils/money';
import { debtBetween, pendingBetween } from '@/utils/settle';
import { Check } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { themedStyles } from '@/constants/themed-styles';

const METHOD_TABS = [
  { key: 'cash', label: 'Cash' },
  { key: 'other', label: 'Transfer' },
] as const;

interface SettleAllSheetProps {
  visible: boolean;
  onClose: () => void;
  tripId: string;
  currency: string;
  members: TripMember[];
  edges: DebtEdge[];
  /** Every payment in the trip, so money still waiting for confirmation is taken off. */
  settlements?: Settlement[];
  currentUserId: string;
  /** Every payment that was recorded, in the order they were saved. */
  onSaved: (saved: Settlement[]) => void;
}

/**
 * Pays everyone you owe in one go: one payment per person, each for the full
 * debt, all with the same method and note. Each person still confirms their
 * own payment, as with any other.
 */
export default function SettleAllSheet({
  visible,
  onClose,
  tripId,
  currency,
  members,
  edges,
  settlements = [],
  currentUserId,
  onSaved,
}: SettleAllSheetProps) {
  // What is left on each debt once payments still waiting are taken off.
  const owed = edges
    .filter((edge) => edge.from === currentUserId)
    .map((edge) => ({
      ...edge,
      amount:
        Math.round((edge.amount - pendingBetween(settlements, edge.from, edge.to)) * 100) / 100,
    }))
    .filter((edge) => edge.amount > 0.004);
  const [picked, setPicked] = useState<string[]>([]);
  const [method, setMethod] = useState<'cash' | 'other'>('cash');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Everyone is ticked each time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    setPicked(edges.filter((edge) => edge.from === currentUserId).map((edge) => edge.to));
    setMethod('cash');
    setNote('');
    setError('');
    setSaving(false);
    // Only a fresh open resets the sheet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const nameOf = (id: string) => members.find((member) => member.id === id)?.fullname ?? 'Member';
  const photoOf = (id: string) => members.find((member) => member.id === id)?.photoURL;
  const money = (value: number) => formatMoney(value, currency);
  const chosen = owed.filter((edge) => picked.includes(edge.to));
  const total = chosen.reduce((sum, edge) => sum + edge.amount, 0);

  const toggle = (id: string) =>
    setPicked((previous) =>
      previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id],
    );

  const save = async () => {
    if (saving || !chosen.length) return;
    setSaving(true);
    setError('');

    // The latest balances from the server, so nobody is paid for a debt that
    // was settled from another phone in the meantime.
    if (isConnected()) {
      try {
        const [freshExpenses, freshPayments] = await Promise.all([
          fetchExpenses(tripId, { preferCache: false }),
          fetchSettlements(tripId, { preferCache: false }),
        ]);
        const freshEdges = simplifyDebts(
          computeBalances(
            members.map((member) => member.id),
            freshExpenses,
            freshPayments,
          ),
          freshPayments,
        );
        const changed = chosen.filter(
          (edge) =>
            debtBetween(freshEdges, currentUserId, edge.to) -
              pendingBetween(freshPayments, currentUserId, edge.to) +
              0.005 <
            edge.amount,
        );
        if (changed.length) {
          setError(
            `The balances changed since this opened (${changed
              .map((edge) => nameOf(edge.to).split(' ')[0])
              .join(', ')}). Close this and open it again to see what is owed now.`,
          );
          setSaving(false);
          return;
        }
      } catch (err) {
        console.warn('Could not check the latest balances:', err);
      }
    }

    const saved: Settlement[] = [];
    try {
      for (const edge of chosen) {
        saved.push(
          await createSettlement(tripId, {
            from: currentUserId,
            to: edge.to,
            amount: edge.amount,
            kind: 'full',
            settledOn: todayKey(),
            isCash: method === 'cash',
            ...(method === 'other' ? { method: 'Transfer' } : {}),
            proofUrls: [],
            note: note.trim(),
            createdBy: currentUserId,
          }),
        );
      }
      onSaved(saved);
      onClose();
    } catch (err: any) {
      console.error('Failed to settle all:', err);
      // Whatever was saved stays saved; say how far it got.
      if (saved.length) onSaved(saved);
      setError(
        (saved.length ? `${saved.length} of ${chosen.length} payments were recorded. ` : '') +
          (err?.message || 'Could not record the payments.'),
      );
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      title="Settle all"
      onClose={() => {
        if (!saving) onClose();
      }}
      footer={
        <>
          {!!error && <HelperText tone="error">{error}</HelperText>}
          <PrimaryButton
            title={
              saving
                ? 'Recording…'
                : chosen.length
                  ? `Record ${chosen.length} ${chosen.length === 1 ? 'payment' : 'payments'} · ${money(total)}`
                  : 'Pick who you paid'
            }
            onPress={save}
            buttonColor={BrandColors.base50}
            textColor={BrandColors.primary}
            borderColor={BrandColors.base50}
            borderWidth={0}
            disabled={saving || !chosen.length}
          />
        </>
      }
    >
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.lead}>
          You owe {owed.length} {owed.length === 1 ? 'person' : 'people'}. Untick anyone you haven’t
          paid yet.
        </Text>

        <View style={styles.list}>
          {owed.map((edge) => {
            const on = picked.includes(edge.to);
            return (
              <Pressable
                key={edge.to}
                style={({ pressed }) => [styles.row, on && styles.rowOn, pressed && styles.pressed]}
                onPress={() => toggle(edge.to)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`Pay ${nameOf(edge.to)} ${money(edge.amount)}`}
              >
                <View style={[styles.box, on && styles.boxOn]}>
                  {on && <Check size={14} color={BrandColors.onBrand} strokeWidth={3} />}
                </View>
                <Avatar name={nameOf(edge.to)} size={34} photoURL={photoOf(edge.to)} />
                <Text style={styles.name} numberOfLines={1}>
                  {nameOf(edge.to)}
                </Text>
                <Text style={styles.amount}>{money(edge.amount)}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment method</Text>
          <TabSlider items={METHOD_TABS} value={method} onChange={setMethod} />
          <HelperText>
            {method === 'cash'
              ? 'Paid in cash. Each person confirms they received theirs.'
              : 'Sent to each person’s GCash, Maya or bank account, below. Each person confirms theirs.'}
          </HelperText>
        </View>

        {/* Each person's GCash, Maya or bank details, to send the money to. */}
        {method === 'other' &&
          chosen.map((edge) => (
            <PayToCard
              key={edge.to}
              tripId={tripId}
              payeeId={edge.to}
              payeeLabel={nameOf(edge.to).split(' ')[0]}
              compact
            />
          ))}

        <TextField
          title="Note (optional)"
          placeholder="Added to every payment, like a reference number"
          value={note}
          onChangeText={setNote}
          multiline
          minHeight={80}
        />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = themedStyles(() => ({
  body: { gap: Spacing.four, paddingBottom: Spacing.four },
  lead: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 14, color: BrandColors.primary },
  list: { gap: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: BrandColors.border,
    padding: Spacing.three,
  },
  rowOn: { borderColor: BrandColors.base50, backgroundColor: BrandColors.inputField },
  pressed: { opacity: 0.7 },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: BrandColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: BrandColors.base50, borderColor: BrandColors.base50 },
  name: { flex: 1, fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: BrandColors.primary },
  amount: { fontFamily: 'PlusJakartaSans-ExtraBold', fontSize: 14, color: BrandColors.primary },
  section: { gap: Spacing.two },
  sectionTitle: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: BrandColors.primary },
}));
