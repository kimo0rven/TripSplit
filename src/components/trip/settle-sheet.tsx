import PrimaryButton from '@/components/Button/primary-button';
import Avatar from '@/components/ui/avatar';
import BottomSheet from '@/components/ui/bottom-sheet';
import { HelperText } from '@/components/ui/card';
import { FieldLabel } from '@/components/ui/choice-chips';
import { TextField } from '@/components/ui/text-input-field';
import { BrandColors, Spacing } from '@/constants/theme';
import { createSettlement, updateSettlement } from '@/services/Firebase/settlementService';
import { DebtEdge, Settlement } from '@/types/expenses';
import { TripMember } from '@/types/trips';
import { formatMoney, parseAmount, todayKey } from '@/utils/money';
import { uploadReceipt } from '@/services/Supabase/receiptService';
import { pickImage, takePhoto } from '@/utils/imagePicker';
import { Image } from 'expo-image';
import { Camera, Check, Images, Trash2 } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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
  onSaved: (settlement: Settlement) => void;
}

/**
 * Records a part payment or a full payment between two members.
 * The suggested debts come from the simplified list, so the amount starts
 * at what is actually owed.
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
  onSaved,
}: SettleSheetProps) {
  const defaultFrom = preselect?.from || currentUserId || members[0]?.id || '';
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(preselect?.to || '');
  const [amountText, setAmountText] = useState('');
  const [note, setNote] = useState('');
  const [isCash, setIsCash] = useState<boolean | null>(null);
  const [method, setMethod] = useState('');
  const [proofUris, setProofUris] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // The debt between the two chosen people, straight from the simplifier.
  const owed = useMemo(() => {
    const direct = edges.find((edge) => edge.from === from && edge.to === to);
    if (direct) return direct.amount;
    const reverse = edges.find((edge) => edge.from === to && edge.to === from);
    return reverse ? -reverse.amount : 0;
  }, [edges, from, to]);

  useEffect(() => {
    if (!visible) return;
    if (settlement) {
      setFrom(settlement.from);
      setTo(settlement.to);
      setAmountText(String(settlement.amount));
      setNote(settlement.note ?? '');
      setIsCash(settlement.isCash ?? null);
      setMethod(settlement.method ?? '');
      setProofUris(settlement.proofUrls ?? []);
    } else {
      setFrom(preselect?.from || currentUserId || members[0]?.id || '');
      setTo(preselect?.to || '');
      setAmountText(preselect?.amount ? String(preselect.amount) : '');
      setNote('');
      setIsCash(null);
      setMethod('');
      setProofUris([]);
    }
    setError('');
    setSaving(false);
  }, [visible, settlement?.id, preselect?.from, preselect?.to, preselect?.amount, currentUserId]);

  const amountValue = parseAmount(amountText) / 100;
  const nameOf = (id: string) => members.find((member) => member.id === id)?.fullname ?? 'Member';

  const suggestions = edges.filter((edge) => edge.from === from || edge.to === from);

  const handleSave = async () => {
    if (saving) return;
    setError('');

    if (!from || !to) {
      setError('Pick who is paying and who receives it.');
      return;
    }
    if (from === to) {
      setError('Pick two different people.');
      return;
    }
    if (amountValue <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }

    if (isCash === null) {
      setError('Tell us if this was paid in cash.');
      return;
    }
    if (!isCash && !method.trim()) {
      setError('Tell us how it was paid, e.g. GCash.');
      return;
    }

    const kind: 'full' | 'partial' = owed > 0 && amountValue >= owed - 0.01 ? 'full' : 'partial';

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
          { from, to, amount: amountValue, kind, isCash, method, proofUrls, note },
          { currency, names, by: currentUserId, byName: names[currentUserId] || 'Someone' },
        );
        onSaved(updated);
        onClose();
        return;
      }
      const saved = await createSettlement(tripId, {
        from,
        to,
        amount: amountValue,
        kind,
        settledOn: todayKey(),
        isCash,
        method,
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

  const handlePickProof = async (source: 'camera' | 'library') => {
    try {
      const result =
        source === 'camera'
          ? await takePhoto({ quality: 0.7 })
          : await pickImage({ includeBase64: false, quality: 0.7 });
      if (result.denied) {
        setError(
          source === 'camera'
            ? 'Camera access is off. Turn it on in your phone settings.'
            : 'Photo access is off. Turn it on in your phone settings.',
        );
        return;
      }
      const uri = result.asset?.uri;
      if (uri) setProofUris((previous) => [...previous, uri]);
    } catch (err) {
      console.error('Failed to pick a proof photo:', err);
      setError('Could not open your camera or photos.');
    }
  };

  const fillFull = () => {
    if (owed <= 0) return;
    setAmountText(String(owed));
  };

  const fillHalf = () => {
    if (owed <= 0) return;
    setAmountText((Math.round((owed / 2) * 100) / 100).toString());
  };

  return (
    <BottomSheet
      visible={visible}
      title={settlement ? 'Edit payment' : 'Settle up'}
      onClose={onClose}
      footer={
        <>
          {!!error && <HelperText tone="error">{error}</HelperText>}
          <PrimaryButton
            title={saving ? 'Saving…' : settlement ? 'Save changes' : 'Record payment'}
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
        <View style={styles.group}>
          <FieldLabel>Who is paying?</FieldLabel>
          <View style={styles.peopleRow}>
            {members.map((member) => {
              const isOn = member.id === from;
              return (
                <Pressable
                  key={member.id}
                  style={[styles.person, isOn && styles.personOn]}
                  onPress={() => {
                    setFrom(member.id);
                    if (member.id === to) setTo('');
                  }}
                >
                  <Avatar name={member.fullname} size={26} photoURL={member.photoURL} />
                  <Text style={[styles.personName, isOn && styles.personNameOn]} numberOfLines={1}>
                    {member.fullname.split(' ')[0]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.group}>
          <FieldLabel>Who receives it?</FieldLabel>
          <View style={styles.peopleRow}>
            {members
              .filter((member) => member.id !== from)
              .map((member) => {
                const isOn = member.id === to;
                return (
                  <Pressable
                    key={member.id}
                    style={[styles.person, isOn && styles.personOn]}
                    onPress={() => setTo(member.id)}
                  >
                    <Avatar name={member.fullname} size={26} photoURL={member.photoURL} />
                    <Text
                      style={[styles.personName, isOn && styles.personNameOn]}
                      numberOfLines={1}
                    >
                      {member.fullname.split(' ')[0]}
                    </Text>
                    {isOn && <Check size={12} color={BrandColors.primary} />}
                  </Pressable>
                );
              })}
          </View>
        </View>

        {suggestions.length > 0 && (
          <View style={styles.suggestions}>
            <FieldLabel>Suggested from the current debts</FieldLabel>
            {suggestions.map((edge) => (
              <Pressable
                key={`${edge.from}-${edge.to}`}
                style={({ pressed }) => [styles.suggestionRow, pressed && styles.pressed]}
                onPress={() => {
                  setFrom(edge.from);
                  setTo(edge.to);
                  setAmountText(String(edge.amount));
                }}
              >
                <Text style={styles.suggestionText}>
                  {nameOf(edge.from)} → {nameOf(edge.to)}
                </Text>
                <Text style={styles.suggestionAmount}>{formatMoney(edge.amount, currency)}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {to ? (
          <HelperText tone={owed > 0 ? 'muted' : 'success'}>
            {owed > 0
              ? `${nameOf(from)} still owes ${nameOf(to)} ${formatMoney(owed, currency)}.`
              : `There is no open debt between ${nameOf(from)} and ${nameOf(to)}.`}
          </HelperText>
        ) : null}

        <View style={styles.group}>
          <TextField
            title={`Amount (${currency})`}
            placeholder="0.00"
            value={amountText}
            onChangeText={setAmountText}
            keyboardType="numeric"
          />
          <View style={styles.quickRow}>
            <Pressable style={styles.quickChip} onPress={fillFull}>
              <Text style={styles.quickText}>
                Full {owed > 0 ? formatMoney(owed, currency) : ''}
              </Text>
            </Pressable>
            <Pressable style={styles.quickChip} onPress={fillHalf}>
              <Text style={styles.quickText}>Half</Text>
            </Pressable>
          </View>
          <HelperText>
            Pay less than the full debt and it is saved as a part payment. The rest stays owed.
          </HelperText>
        </View>

        <View style={styles.group}>
          <FieldLabel>Is this paid in cash?</FieldLabel>
          <View style={styles.peopleRow}>
            {[
              { label: 'Cash', value: true },
              { label: 'Not cash', value: false },
            ].map((option) => {
              const isOn = isCash === option.value;
              return (
                <Pressable
                  key={option.label}
                  style={[styles.person, isOn && styles.personOn]}
                  onPress={() => setIsCash(option.value)}
                >
                  <Text style={[styles.personName, isOn && styles.personNameOn]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {isCash === false && (
            <TextField
              title="How was it paid?"
              placeholder="e.g. GCash, bank transfer"
              value={method}
              onChangeText={setMethod}
            />
          )}
        </View>

        <View style={styles.group}>
          <FieldLabel>Proof of payment (optional)</FieldLabel>
          {proofUris.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.proofStrip}>
                {proofUris.map((uri, index) => (
                  <View key={uri + index} style={styles.proofItem}>
                    <Image source={{ uri }} style={styles.proofImage} contentFit="cover" />
                    <Pressable
                      style={styles.proofRemove}
                      onPress={() => setProofUris((prev) => prev.filter((_, i) => i !== index))}
                      accessibilityLabel="Remove photo"
                    >
                      <Trash2 size={14} color={BrandColors.background} />
                    </Pressable>
                  </View>
                ))}
              </View>
            </ScrollView>
          )}
          <View style={styles.peopleRow}>
            <Pressable style={styles.person} onPress={() => handlePickProof('camera')}>
              <Camera size={16} color={BrandColors.primary} />
              <Text style={styles.personName}>Take photo</Text>
            </Pressable>
            <Pressable style={styles.person} onPress={() => handlePickProof('library')}>
              <Images size={16} color={BrandColors.primary} />
              <Text style={styles.personName}>
                {proofUris.length > 0 ? 'Add another' : 'Choose photo'}
              </Text>
            </Pressable>
          </View>
        </View>

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
  proofStrip: { flexDirection: 'row', gap: Spacing.two },
  proofItem: { width: 96, height: 96 },
  proofImage: {
    width: 96,
    height: 96,
    borderRadius: 12,
    backgroundColor: BrandColors.inputField,
  },
  proofRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: BrandColors.error,
    borderRadius: 8,
    padding: 5,
  },
  scroll: {
    gap: Spacing.four,
    paddingBottom: Spacing.four,
  },
  group: {
    gap: Spacing.two,
  },
  peopleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 20,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    maxWidth: '48%',
  },
  personOn: {
    borderColor: BrandColors.base50,
    backgroundColor: BrandColors.base200,
  },
  personName: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: BrandColors.secondary,
  },
  personNameOn: {
    color: BrandColors.primary,
    fontFamily: 'PlusJakartaSans-Bold',
  },
  suggestions: {
    gap: Spacing.two,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: BrandColors.surfaceAlt,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
  suggestionText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: BrandColors.primary,
  },
  suggestionAmount: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 12,
    color: BrandColors.primary,
  },
  quickRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  quickChip: {
    borderWidth: 1,
    borderColor: BrandColors.base50,
    borderRadius: 20,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  quickText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: BrandColors.primary,
  },
});
