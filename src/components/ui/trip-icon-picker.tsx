import { BrandColors, Spacing } from '@/constants/theme';
import { DEFAULT_TRIP_COLOR, TRIP_ICON_COLORS } from '@/constants/trip-colors';
import { DEFAULT_TRIP_ICON, TRIP_ICONS, type TripIconChoice } from '@/constants/trip-icons';
import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

/** Six icons to a line, so the 18 icons make three tidy rows. */
const ICON_COLUMNS = 6;

/**
 * Splits the icons into whole rows.
 *
 * Rows are built up front rather than relying on wrapping, because a wrapped
 * row leaves the last line with spare width that has to be spread between its
 * cells - which is what made the gaps uneven and let the icons drift.
 */
function toRows(icons: TripIconChoice[]): TripIconChoice[][] {
  const rows: TripIconChoice[][] = [];

  for (let start = 0; start < icons.length; start += ICON_COLUMNS) {
    rows.push(icons.slice(start, start + ICON_COLUMNS));
  }

  return rows;
}

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
 * The 18 icons sit in six even columns and the 8 colours in one even row. Each
 * cell shares its row's width with `flex: 1` instead of a percentage, so every
 * box is the same size at any screen width and none of them can shift.
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
        {toRows(TRIP_ICONS).map((row) => (
          <View key={row[0].key} style={styles.row}>
            {row.map(({ key, label, Icon }) => {
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
        ))}
      </View>

      {onSelectColor ? (
        // Eight swatches spread evenly across one line.
        <View style={styles.row}>
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
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  cell: {
    // One share of the row each, so the six cells fill it exactly and stay the
    // same size no matter how wide the screen is.
    flex: 1,
    aspectRatio: 1,
    borderRadius: 14,
    // Always 2px, never swapped for a thinner one: changing the width would
    // resize the box and shove every icon after it along.
    borderWidth: 2,
    borderColor: BrandColors.border,
    backgroundColor: BrandColors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellOn: {
    borderColor: BrandColors.base50,
    backgroundColor: BrandColors.base200,
  },
  swatch: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
