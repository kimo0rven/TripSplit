import { BrandColors, Spacing } from '@/constants/theme';
import { LucideIcon } from 'lucide-react-native';
import { ScrollView, StyleSheet, Text, Pressable, View } from 'react-native';

export interface FilterOption {
  value: string;
  label: string;
  /** Small picture left of the label; the category's own icon, for instance. */
  icon?: LucideIcon;
  /** Colour for that picture. */
  iconColor?: string;
}

interface FilterChipsProps {
  options: FilterOption[];
  /** The value currently filtering; `null` means everything is shown. */
  value: string | null;
  onChange: (value: string | null) => void;
  /** Value of the "show everything" chip. Defaults to `all`. */
  allValue?: string;
  /** Word on that chip. */
  allLabel?: string;
  /** Screen-reader name for the whole row, e.g. "Filter by category". */
  label?: string;
}

/**
 * A scrolling row of filter pills, with a "All" chip first.
 *
 * Scrolling rather than wrapping because there are usually more filters than fit
 * across a phone, and a wrapped row would push the list further down the screen
 * every time a category was added.
 */
export default function FilterChips({
  options,
  value,
  onChange,
  allValue = 'all',
  allLabel = 'All',
  label = 'Filter',
}: FilterChipsProps) {
  const all: FilterOption = { value: allValue, label: allLabel };
  const chips = [all, ...options];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityLabel={label}
    >
      {chips.map((option) => {
        // `null` is what the page holds for "no filter", so the All chip has to
        // light up for both it and its own value.
        const on =
          option.value === allValue ? value === null || value === allValue : value === option.value;
        const Icon = option.icon;
        const tint = on ? BrandColors.primary : (option.iconColor ?? BrandColors.secondary);

        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value === allValue ? null : option.value)}
            style={[styles.chip, on && styles.chipOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={option.label}
          >
            {!!Icon && (
              <View style={styles.chipIcon}>
                <Icon size={13} color={tint} />
              </View>
            )}
            <Text style={[styles.label, on && styles.labelOn]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.one,
    paddingRight: Spacing.four,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.two,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BrandColors.border,
    backgroundColor: BrandColors.background,
  },
  chipOn: {
    backgroundColor: BrandColors.base50,
    borderColor: BrandColors.base50,
  },
  chipIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: BrandColors.secondary,
  },
  labelOn: {
    fontFamily: 'PlusJakartaSans-Bold',
    color: BrandColors.primary,
  },
});
