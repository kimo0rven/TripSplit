import { BrandColors, Spacing } from '@/constants/theme';
import { DEFAULT_TRIP_COLOR, TRIP_ICON_COLORS } from '@/constants/trip-colors';
import { DEFAULT_TRIP_ICON, TRIP_ICONS } from '@/constants/trip-icons';
import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

interface TripIconPickerProps {
  /** The chosen icon key. Empty or unknown falls back to the default icon. */
  value?: string;
  onSelect: (key: string) => void;
  /** The chosen colour key. Optional, so the icon-only picker still works. */
  colorValue?: string;
  onSelectColor?: (key: string) => void;
}

/**
 * A grid of pictures to pick for a trip, with a row of colours underneath.
 *
 * The 18 icons sit in six even columns and the 8 colours in one even row, so
 * both fill the width and line up at any screen size.
 */
export default function TripIconPicker({
  value,
  onSelect,
  colorValue,
  onSelectColor,
}: TripIconPickerProps) {
  const selected = value || DEFAULT_TRIP_ICON;
  const selectedColor = colorValue || DEFAULT_TRIP_COLOR;

  return (
    <View style={styles.wrapper}>
      <View style={styles.grid}>
        {TRIP_ICONS.map(({ key, label, Icon }) => {
          const isOn = key === selected;

          return (
            <Pressable
              key={key}
              style={[styles.cell, isOn && styles.cellOn]}
              onPress={() => onSelect(key)}
              accessibilityRole="button"
              accessibilityState={{ selected: isOn }}
              accessibilityLabel={label}
            >
              <Icon
                size={22}
                color={isOn ? BrandColors.primary : BrandColors.secondary}
                strokeWidth={2}
              />
            </Pressable>
          );
        })}
      </View>

      {onSelectColor ? (
        // Eight swatches spread evenly across one line.
        <View style={styles.swatches}>
          {TRIP_ICON_COLORS.map(({ key, label, background, foreground }) => {
            const isOn = key === selectedColor;

            return (
              <Pressable
                key={key}
                style={[
                  styles.swatch,
                  { backgroundColor: background },
                  isOn && { borderColor: foreground },
                ]}
                onPress={() => onSelectColor(key)}
                accessibilityRole="button"
                accessibilityState={{ selected: isOn }}
                accessibilityLabel={`${label} colour`}
              >
                {isOn && <Check size={16} color={foreground} strokeWidth={3} />}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: Spacing.three,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: Spacing.two,
  },
  cell: {
    // Six equal columns that fill the row: (100% - 5 gaps) / 6.
    width: '15.4%',
    aspectRatio: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BrandColors.border,
    backgroundColor: BrandColors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellOn: {
    borderWidth: 2,
    borderColor: BrandColors.base50,
    backgroundColor: BrandColors.base200,
  },
  swatches: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  swatch: {
    width: '10.5%',
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
