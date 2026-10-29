import { BrandColors, Spacing } from '@/constants/theme';
import { categoryLook } from '@/constants/expense-categories';
import { Check } from 'lucide-react-native';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/** Four per line, so the names under the pictures stay readable. */
const COLUMNS = 4;

export interface CategoryOption {
  value: string;
  label: string;
}

interface CategoryPickerProps {
  visible: boolean;
  onClose: () => void;
  options: readonly CategoryOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
}

/**
 * Splits the categories into whole rows.
 *
 * Rows are built up front instead of relying on wrapping: a wrapped row leaves
 * the last line with spare width that has to be spread across its cells, which
 * is what makes a grid look uneven and lets the boxes drift.
 */
function toRows(options: readonly CategoryOption[]): CategoryOption[][] {
  const rows: CategoryOption[][] = [];

  for (let start = 0; start < options.length; start += COLUMNS) {
    rows.push(options.slice(start, start + COLUMNS));
  }

  return rows;
}

/**
 * The full list of expense categories, as a grid of pictures and names.
 *
 * The expense form itself only carries the five everyday categories, because a
 * row of twenty-eight chips is a wall to read before every expense. The rest
 * live here, one tap behind "More".
 *
 * It is its own `Modal` rather than the usual bottom sheet because it opens
 * from inside the expense sheet, and a sheet opened over another one is
 * awkward: the first one's footer and save button get pushed out of sight. A
 * panel on top of everything is unambiguous - pick one, and you land back on
 * the form exactly where you left it.
 */
export default function CategoryPicker({
  visible,
  onClose,
  options,
  selectedValue,
  onSelect,
}: CategoryPickerProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <SafeAreaView edges={['bottom']} style={styles.panel}>
          <View style={styles.grabber} />
          <View style={styles.headerRow}>
            <Text style={styles.title} numberOfLines={1}>
              Pick a category
            </Text>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeButton}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scroll}
            // Shrinks inside the panel instead of pushing past its height, so
            // the list scrolls and the title stays where it is.
            style={styles.scrollArea}
          >
            {toRows(options).map((row) => (
              <View key={row[0].value} style={styles.row}>
                {row.map((option) => {
                  const look = categoryLook(option.value);
                  const Icon = look.icon;
                  const isOn = option.value === selectedValue;

                  return (
                    <Pressable
                      key={option.value}
                      style={styles.cell}
                      onPress={() => onSelect(option.value)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isOn }}
                      accessibilityLabel={option.label}
                    >
                      <View
                        style={[
                          styles.box,
                          // The chosen box wears its own category colour, so the
                          // answer is obvious without reading the names.
                          isOn
                            ? { backgroundColor: look.bg, borderColor: look.tint }
                            : { backgroundColor: BrandColors.surfaceAlt },
                        ]}
                      >
                        <Icon size={22} color={look.tint} strokeWidth={2} />
                        {isOn && (
                          <View style={[styles.tick, { backgroundColor: look.tint }]}>
                            <Check size={9} color={BrandColors.background} strokeWidth={4} />
                          </View>
                        )}
                      </View>
                      <Text style={[styles.cellLabel, isOn && styles.cellLabelOn]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
                {/* A short last row keeps its boxes the same width as the rest. */}
                {Array.from({ length: COLUMNS - row.length }).map((_, index) => (
                  <View key={`filler-${index}`} style={styles.cell} />
                ))}
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  panel: {
    maxHeight: '86%',
    backgroundColor: BrandColors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: Spacing.three,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: BrandColors.border,
    marginTop: Spacing.two,
    marginBottom: Spacing.two,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
  },
  title: {
    flex: 1,
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 18,
    color: BrandColors.primary,
  },
  closeButton: {
    paddingHorizontal: Spacing.two,
  },
  closeText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14,
    color: BrandColors.secondary,
  },
  scrollArea: {
    flexShrink: 1,
  },
  scroll: {
    gap: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  cell: {
    // One share of the row each, so the four cells fill it exactly and stay the
    // same size at any screen width.
    flex: 1,
    alignItems: 'center',
    gap: Spacing.one,
  },
  box: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tick: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    textAlign: 'center',
    color: BrandColors.secondary,
  },
  cellLabelOn: {
    fontFamily: 'PlusJakartaSans-Bold',
    color: BrandColors.primary,
  },
});
