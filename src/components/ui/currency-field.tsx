import BigButtonOptions from '@/components/ui/big-button-options';
import BottomSheet from '@/components/ui/bottom-sheet';
import { currencies } from '@/constants/currencies';
import { BrandColors, Spacing } from '@/constants/theme';
import { ChevronDown } from 'lucide-react-native';
import { ReactNode, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface CurrencyFieldProps {
  title?: string;
  value: string;
  onChange: (code: string) => void;
  /** A line under the field, such as what changing it does. */
  hint?: ReactNode;
  /**
   * Just the code and an arrow, shaped like a text field, to sit beside one
   * in the same row.
   */
  compact?: boolean;
}

export const currencyName = (code: string) =>
  currencies.find((currency) => currency.value === code)?.name ?? code;

/**
 * One tile showing the chosen currency; tapping it opens the full list in a
 * sheet, so the long list does not take over the page.
 */
export default function CurrencyField({
  title = 'Currency',
  value,
  onChange,
  hint,
  compact = false,
}: CurrencyFieldProps) {
  const [open, setOpen] = useState(false);

  return (
    <View style={compact ? styles.wrapCompact : styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <Pressable
        style={({ pressed }) => [
          compact ? styles.tileCompact : styles.tile,
          pressed && styles.pressed,
        ]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${title}: ${currencyName(value)}. Change`}
      >
        <Text style={styles.code}>{value}</Text>
        {!compact && (
          <Text style={styles.name} numberOfLines={1}>
            {currencyName(value)}
          </Text>
        )}
        <ChevronDown size={16} color={BrandColors.secondary} />
      </Pressable>
      {hint}

      <BottomSheet visible={open} title={title} onClose={() => setOpen(false)}>
        <BigButtonOptions
          choices={currencies}
          selectedValue={value}
          onSelect={(choice) => {
            onChange(choice.value);
            setOpen(false);
          }}
          maxHeight={420}
        />
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  // Matches the text fields: the same label gap, corners, padding and border,
  // so the two line up side by side.
  wrapCompact: { gap: 6 },
  tileCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.one,
    backgroundColor: BrandColors.inputField,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  title: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: BrandColors.primary },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: BrandColors.inputField,
    borderRadius: 15,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  pressed: { opacity: 0.7 },
  code: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: BrandColors.primary },
  name: {
    flex: 1,
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    color: BrandColors.secondary,
  },
});
