import { HelperText } from '@/components/ui/card';
import { TextField } from '@/components/ui/text-input-field';
import { BrandColors, Spacing } from '@/constants/theme';
import { formatMoney } from '@/utils/money';
import { halfOf, type AmountChoice } from '@/utils/settle';
import { Pressable, Text, View } from 'react-native';
import { themedStyles } from '@/constants/themed-styles';

interface AmountPickerProps {
  currency: string;
  /** The whole debt the chips work from. */
  debt: number;
  choice: AmountChoice;
  /** The amount being paid, whichever chip set it. */
  amount: number;
  /** What is typed while "Other amount" is picked. */
  typed: string;
  onChoice: (choice: AmountChoice) => void;
  onTyped: (text: string) => void;
}

/**
 * Full, Half or Other amount. The field can only be typed into for Other
 * amount; Full and Half fill it in and keep it read-only.
 */
export function AmountPicker({
  currency,
  debt,
  choice,
  amount,
  typed,
  onChoice,
  onTyped,
}: AmountPickerProps) {
  const none = debt <= 0;
  const chips: { key: AmountChoice; label: string }[] = [
    { key: 'full', label: none ? 'Full' : `Full · ${formatMoney(debt, currency)}` },
    { key: 'half', label: none ? 'Half' : `Half · ${formatMoney(halfOf(debt), currency)}` },
    { key: 'custom', label: 'Other amount' },
  ];

  return (
    <View style={styles.group}>
      <TextField
        title={`Amount (${currency})`}
        placeholder="0.00"
        value={choice === 'custom' ? typed : amount > 0 ? formatMoney(amount, currency) : ''}
        onChangeText={onTyped}
        keyboardType="numeric"
        editable={choice === 'custom' && !none}
      />
      <View style={styles.row}>
        {chips.map((chip) => {
          const isOn = choice === chip.key;
          return (
            <Pressable
              key={chip.key}
              style={({ pressed }) => [
                styles.chip,
                isOn && styles.chipOn,
                none && styles.chipOff,
                pressed && styles.pressed,
              ]}
              onPress={() => onChoice(chip.key)}
              disabled={none}
              accessibilityRole="button"
              accessibilityState={{ selected: isOn, disabled: none }}
            >
              <Text style={[styles.chipText, isOn && styles.chipTextOn]}>{chip.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <HelperText>
        {choice === 'full'
          ? 'Full clears the whole debt.'
          : choice === 'half'
            ? 'Half is saved as a part payment. The rest stays owed.'
            : `Type any amount up to ${formatMoney(debt, currency)}. The rest stays owed.`}
      </HelperText>
    </View>
  );
}

const styles = themedStyles(() => ({
  group: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    borderWidth: 1,
    borderColor: BrandColors.base50,
    borderRadius: 20,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  chipOn: {
    backgroundColor: BrandColors.base50,
  },
  chipOff: {
    borderColor: BrandColors.border,
    opacity: 0.5,
  },
  chipText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: BrandColors.primary,
  },
  chipTextOn: {
    fontFamily: 'PlusJakartaSans-Bold',
    color: BrandColors.onBrand,
  },
  pressed: {
    opacity: 0.7,
  },
}));
