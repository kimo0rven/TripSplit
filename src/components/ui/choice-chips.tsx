import { BrandColors, Spacing } from '@/constants/theme';
import { LucideIcon } from 'lucide-react-native';
import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export interface Choice {
  value: string;
  label: string;
  /** Optional picture shown left of the label. */
  icon?: LucideIcon;
  /** Colour for that picture. */
  iconColor?: string;
}

interface ChoiceChipsProps {
  choices: Choice[];
  selectedValue: string;
  onSelect: (value: string) => void;
  /** Chips share the row equally and cannot be wider than the screen. */
  equalWidth?: boolean;
  /** Keeps the chips on one line instead of wrapping; put it inside a horizontal ScrollView. */
  noWrap?: boolean;
}

/** A row of small pill buttons, used for categories and split modes. */
export default function ChoiceChips({
  choices,
  selectedValue,
  onSelect,
  equalWidth = false,
  noWrap = false,
}: ChoiceChipsProps) {
  return (
    <View style={[styles.row, noWrap && styles.noWrap]}>
      {choices.map((choice) => {
        const isSelected = choice.value === selectedValue;
        const Icon = choice.icon;
        return (
          <Pressable
            key={choice.value}
            onPress={() => onSelect(choice.value)}
            style={[styles.chip, equalWidth && styles.equalChip, isSelected && styles.selectedChip]}
          >
            {Icon && (
              <Icon
                size={13}
                color={isSelected ? BrandColors.primary : (choice.iconColor ?? BrandColors.primary)}
              />
            )}
            <Text style={[styles.label, isSelected && styles.selectedLabel]}>{choice.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Small label above a group of controls. */
export function FieldLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.labelRow}>
      <Text style={styles.fieldLabel}>{children}</Text>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  noWrap: {
    flexWrap: 'nowrap',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BrandColors.border,
    backgroundColor: BrandColors.background,
  },
  equalChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  selectedChip: {
    backgroundColor: BrandColors.base50,
    borderColor: BrandColors.base50,
  },
  label: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 13,
    color: BrandColors.primary,
  },
  selectedLabel: {
    fontFamily: 'PlusJakartaSans-Bold',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldLabel: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    color: BrandColors.primary,
    marginBottom: 6,
  },
});
