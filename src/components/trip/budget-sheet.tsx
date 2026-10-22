import PrimaryButton from '@/components/Button/primary-button';
import BottomSheet from '@/components/ui/bottom-sheet';
import { HelperText } from '@/components/ui/card';
import { TextField } from '@/components/ui/text-input-field';
import { BrandColors, Spacing } from '@/constants/theme';
import { saveTripBudget } from '@/services/Firebase/settlementService';
import { formatMoney, parseAmount } from '@/utils/money';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

interface BudgetSheetProps {
  visible: boolean;
  onClose: () => void;
  tripId: string;
  currentUserId: string;
  currency: string;
  currentBudget: number;
  onSaved: (amount: number) => void;
}

export default function BudgetSheet({
  visible,
  onClose,
  tripId,
  currentUserId,
  currency,
  currentBudget,
  onSaved,
}: BudgetSheetProps) {
  const [amountText, setAmountText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setAmountText(currentBudget > 0 ? String(currentBudget) : '');
    setError('');
    setSaving(false);
  }, [visible, currentBudget]);

  const handleSave = async () => {
    if (saving) return;
    const amount = parseAmount(amountText) / 100;

    setSaving(true);
    try {
      await saveTripBudget(tripId, amount, currentUserId);
      onSaved(amount);
      onClose();
    } catch (err: any) {
      console.error('Failed to save budget:', err);
      setError(err?.message || 'Could not save the budget.');
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      title="Trip budget"
      onClose={onClose}
      footer={
        <>
          {!!error && <HelperText tone="error">{error}</HelperText>}
          <HelperText>Leave it at 0 to remove the budget.</HelperText>
          <PrimaryButton
            title={saving ? 'Saving…' : 'Save budget'}
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
          title={`Total budget (${currency})`}
          placeholder="e.g. 20000"
          value={amountText}
          onChangeText={setAmountText}
          keyboardType="numeric"
        />
        <HelperText>
          Every member sees this budget. The reports tab shows what is left as the trip goes on.
          {currentBudget > 0 ? ` Right now it is ${formatMoney(currentBudget, currency)}.` : ''}
        </HelperText>
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
