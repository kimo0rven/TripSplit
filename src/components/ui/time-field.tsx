import { BrandColors, Spacing } from '@/constants/theme';
import { formatTime } from '@/utils/money';
import { Clock, Minus, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
  /** Quick picks stay for the plans people make most often. */
  presets?: string[];
}

/**
 * A 12-hour time picker: hours and minutes are stepped up and down and a
 * single AM/PM toggle finishes it. It shows and reads in 12-hour form while
 * the trip data keeps 24-hour "HH:MM" underneath.
 */
export default function TimeField({ value, onChange, presets }: TimeFieldProps) {
  const [open, setOpen] = useState(false);
  const parts = toParts(value);
  const hasTime = /^\d{1,2}:\d{2}$/.test((value || '').trim());

  const apply = (next: Partial<TimeParts>) => {
    onChange(toValue({ ...parts, ...next }));
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.fieldRow}>
        <Pressable
          style={styles.field}
          onPress={() => setOpen((prev) => !prev)}
          accessibilityRole="button"
          accessibilityLabel={hasTime ? `Time ${formatTime(value)}` : 'Pick a time'}
        >
          <Clock size={16} color={BrandColors.secondary} />
          <Text style={[styles.fieldText, !hasTime && styles.fieldPlaceholder]}>
            {hasTime ? formatTime(value) : 'Pick a time'}
          </Text>
        </Pressable>

        {hasTime && (
          <Pressable onPress={() => onChange('')} hitSlop={8} style={styles.clearButton}>
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        )}
      </View>

      {!!presets?.length && (
        <View style={styles.presetRow}>
          {presets.map((preset) => {
            const isOn = hasTime && value === preset;
            return (
              <Pressable
                key={preset}
                style={[styles.presetChip, isOn && styles.presetChipOn]}
                onPress={() => onChange(isOn ? '' : preset)}
              >
                <Text style={[styles.presetText, isOn && styles.presetTextOn]}>
                  {formatTime(preset)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {open && (
        <View style={styles.picker}>
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

          <Pressable style={styles.doneButton} onPress={() => setOpen(false)}>
            <Text style={styles.doneText}>{hasTime ? `Done — ${formatTime(value)}` : 'Done'}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.two,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: BrandColors.inputField,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  fieldText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14,
    color: BrandColors.primary,
  },
  fieldPlaceholder: {
    color: BrandColors.secondary,
    fontFamily: 'PlusJakartaSans-Regular',
  },
  clearButton: {
    paddingHorizontal: Spacing.one,
  },
  clearText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: BrandColors.info,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  presetChip: {
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 20,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  presetChipOn: {
    backgroundColor: BrandColors.base50,
    borderColor: BrandColors.base50,
  },
  presetText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: BrandColors.secondary,
  },
  presetTextOn: {
    color: BrandColors.heading,
    fontFamily: 'PlusJakartaSans-Bold',
  },
  picker: {
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 14,
    backgroundColor: BrandColors.surfaceAlt,
    padding: Spacing.three,
    gap: Spacing.two,
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
    color: BrandColors.heading,
  },
  doneButton: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
    marginTop: Spacing.one,
    borderTopWidth: 1,
    borderTopColor: BrandColors.border,
  },
  doneText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    color: BrandColors.info,
  },
});
