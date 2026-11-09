import { BrandColors, Spacing } from '@/constants/theme';
import { formatTime } from '@/utils/money';
import { Clock, Minus, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { themedStyles } from '@/constants/themed-styles';

type Meridiem = 'AM' | 'PM';

interface TimeParts {
  /** 1 to 12. */
  hour: number;
  minute: number;
  meridiem: Meridiem;
}

/** Minutes move in five-minute steps, which covers real plans and keeps tapping short. */
const MINUTE_STEP = 5;

/** Reads stored 24-hour "HH:MM" into the pieces the picker shows. */
const toParts = (value?: string): TimeParts => {
  const match = /^(\d{1,2}):(\d{2})$/.exec((value || '').trim());
  if (!match) return { hour: 9, minute: 0, meridiem: 'AM' };

  const hours24 = Number(match[1]);
  const minute = Number(match[2]);
  if (hours24 > 23 || minute > 59) return { hour: 9, minute: 0, meridiem: 'AM' };

  const meridiem: Meridiem = hours24 >= 12 ? 'PM' : 'AM';
  const hour = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return { hour, minute, meridiem };
};

/** Turns the pieces back into the 24-hour "HH:MM" the trip data stores. */
const toValue = ({ hour, minute, meridiem }: TimeParts): string => {
  const hours24 = meridiem === 'PM' ? (hour % 12) + 12 : hour % 12;
  return `${`${hours24}`.padStart(2, '0')}:${`${minute}`.padStart(2, '0')}`;
};

const wrap = (value: number, min: number, max: number, delta: number): number => {
  const span = max - min + 1;
  return ((((value - min + delta) % span) + span) % span) + min;
};

interface TimeFieldProps {
  /** Stored 24-hour "HH:MM", or '' when no time is set. */
  value: string;
  onChange: (next: string) => void;
  /** The small word above the time in the tile. */
  label?: string;
}

/**
 * A 12-hour time picker: hours and minutes are stepped up and down and a
 * single AM/PM toggle finishes it. It shows and reads in 12-hour form while
 * the trip data keeps 24-hour "HH:MM" underneath.
 */
export default function TimeField({ value, onChange, label = 'Time' }: TimeFieldProps) {
  const [open, setOpen] = useState(false);
  const parts = toParts(value);
  const hasTime = /^\d{1,2}:\d{2}$/.test((value || '').trim());

  const apply = (next: Partial<TimeParts>) => {
    onChange(toValue({ ...parts, ...next }));
  };

  return (
    <>
      {/* The same tile as the day picker, so the two can sit side by side. */}
      <Pressable
        style={({ pressed }) => [styles.tile, open && styles.tileOpen, pressed && styles.pressed]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={
          hasTime ? `${label}: ${formatTime(value)}. Change` : `${label}: pick a time`
        }
      >
        <View style={styles.tileText}>
          <Text style={styles.tileLabel}>{label}</Text>
          <Text style={[styles.tileValue, !hasTime && styles.fieldPlaceholder]} numberOfLines={1}>
            {hasTime ? formatTime(value) : 'Pick a time'}
          </Text>
        </View>
        <Clock size={16} color={BrandColors.secondary} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
      >
        {/* Backdrop and card are siblings: a button can't sit inside another on the web. */}
        <View style={styles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Close the time picker"
          />
          <View style={styles.picker}>
            <Text style={styles.prompt}>{label}</Text>
            <View style={styles.pickerRow}>
              <Text style={styles.pickerLabel}>Hour</Text>
              <View style={styles.stepper}>
                <Pressable
                  style={styles.stepButton}
                  onPress={() => apply({ hour: wrap(parts.hour, 1, 12, -1) })}
                  hitSlop={6}
                  accessibilityLabel="One hour earlier"
                >
                  <Minus size={16} color={BrandColors.primary} />
                </Pressable>
                <Text style={styles.stepValue}>{`${parts.hour}`.padStart(2, '0')}</Text>
                <Pressable
                  style={styles.stepButton}
                  onPress={() => apply({ hour: wrap(parts.hour, 1, 12, 1) })}
                  hitSlop={6}
                  accessibilityLabel="One hour later"
                >
                  <Plus size={16} color={BrandColors.primary} />
                </Pressable>
              </View>
            </View>

            <View style={styles.pickerRow}>
              <Text style={styles.pickerLabel}>Minute</Text>
              <View style={styles.stepper}>
                <Pressable
                  style={styles.stepButton}
                  onPress={() => apply({ minute: wrap(parts.minute, 0, 59, -MINUTE_STEP) })}
                  hitSlop={6}
                  accessibilityLabel="Five minutes earlier"
                >
                  <Minus size={16} color={BrandColors.primary} />
                </Pressable>
                <Text style={styles.stepValue}>{`${parts.minute}`.padStart(2, '0')}</Text>
                <Pressable
                  style={styles.stepButton}
                  onPress={() => apply({ minute: wrap(parts.minute, 0, 59, MINUTE_STEP) })}
                  hitSlop={6}
                  accessibilityLabel="Five minutes later"
                >
                  <Plus size={16} color={BrandColors.primary} />
                </Pressable>
              </View>
            </View>

            <View style={styles.pickerRow}>
              <Text style={styles.pickerLabel}>AM or PM</Text>
              <View style={styles.meridiemGroup}>
                {(['AM', 'PM'] as Meridiem[]).map((option) => {
                  const isOn = parts.meridiem === option;
                  return (
                    <Pressable
                      key={option}
                      style={[styles.meridiemChip, isOn && styles.meridiemChipOn]}
                      onPress={() => apply({ meridiem: option })}
                    >
                      <Text style={[styles.meridiemText, isOn && styles.meridiemTextOn]}>
                        {option}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.footer}>
              {hasTime && (
                <Pressable
                  onPress={() => {
                    onChange('');
                    setOpen(false);
                  }}
                  hitSlop={8}
                  accessibilityRole="button"
                >
                  <Text style={styles.clearText}>No time</Text>
                </Pressable>
              )}
              <Pressable style={styles.doneButton} onPress={() => setOpen(false)}>
                <Text style={styles.doneText}>
                  {hasTime ? `Done · ${formatTime(value)}` : 'Done'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = themedStyles(() => ({
  // Matches DayField's tile exactly.
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: BrandColors.inputField,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  tileOpen: { borderColor: BrandColors.base50 },
  tileText: { flex: 1, gap: 2 },
  tileLabel: { fontFamily: 'PlusJakartaSans-Medium', fontSize: 12, color: BrandColors.secondary },
  tileValue: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: BrandColors.primary },
  pressed: { opacity: 0.7 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  prompt: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 15,
    color: BrandColors.heading,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.one,
    borderTopWidth: 1,
    borderTopColor: BrandColors.border,
    paddingTop: Spacing.two,
  },
  fieldPlaceholder: {
    color: BrandColors.secondary,
    fontFamily: 'PlusJakartaSans-Regular',
  },
  clearText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: BrandColors.info,
  },
  picker: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    backgroundColor: BrandColors.background,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  pickerLabel: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 13,
    color: BrandColors.primary,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: BrandColors.background,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 12,
    paddingHorizontal: Spacing.one,
    paddingVertical: Spacing.one,
  },
  stepButton: {
    width: 32,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  stepValue: {
    minWidth: 34,
    textAlign: 'center',
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 16,
    color: BrandColors.primary,
  },
  meridiemGroup: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 12,
    overflow: 'hidden',
  },
  meridiemChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    backgroundColor: BrandColors.background,
  },
  meridiemChipOn: {
    backgroundColor: BrandColors.base50,
  },
  meridiemText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 13,
    color: BrandColors.secondary,
  },
  meridiemTextOn: {
    fontFamily: 'PlusJakartaSans-Bold',
    color: BrandColors.onBrand,
  },
  doneButton: {
    marginLeft: 'auto',
    backgroundColor: BrandColors.base50,
    borderRadius: 12,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  doneText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    color: BrandColors.onBrand,
  },
}));
