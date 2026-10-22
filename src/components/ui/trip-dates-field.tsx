import DateCalendar from '@/components/ui/date-calendar';
import { BrandColors, Spacing } from '@/constants/theme';
import { formatDay, todayKey } from '@/utils/money';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface TripDatesFieldProps {
  /** YYYY-MM-DD, or '' when not set. */
  startDate: string;
  endDate: string;
  onChange: (dates: { startDate: string; endDate: string }) => void;
}

/** When the trip happens. The start is required; no end means a one-day event. */
export default function TripDatesField({ startDate, endDate, onChange }: TripDatesFieldProps) {
  const [open, setOpen] = useState<'start' | 'end' | null>(null);

  const field = (kind: 'start' | 'end', label: string, value: string, disabled = false) => (
    <View style={[styles.field, open === kind && styles.fieldOpen, disabled && styles.disabled]}>
      <Pressable
        style={styles.fieldMain}
        disabled={disabled}
        onPress={() => setOpen(open === kind ? null : kind)}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.value, !value && styles.placeholder]} numberOfLines={1}>
          {value ? formatDay(value) : kind === 'start' ? 'Required' : 'Not set'}
        </Text>
      </Pressable>
      {!!value && kind === 'end' && (
        <Pressable
          hitSlop={8}
          onPress={() => {
            onChange({ startDate, endDate: '' });
            setOpen(null);
          }}
          accessibilityRole="button"
          accessibilityLabel={'Clear ' + label.toLowerCase()}
        >
          <X size={16} color={BrandColors.secondary} />
        </Pressable>
      )}
    </View>
  );

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Event date</Text>
      <View style={styles.row}>
        {field('start', 'Starts', startDate)}
        {field('end', 'Ends', endDate, !startDate)}
      </View>
      {open === 'start' && (
        <DateCalendar
          value={startDate || todayKey()}
          onChange={(day) => {
            onChange({ startDate: day, endDate: endDate && endDate < day ? '' : endDate });
            setOpen(null);
          }}
        />
      )}
      {open === 'end' && !!startDate && (
        <DateCalendar
          value={endDate || startDate}
          minDay={startDate}
          onChange={(day) => {
            onChange({ startDate, endDate: day });
            setOpen(null);
          }}
        />
      )}
      <Text style={styles.hint}>
        Required. It tells upcoming, ongoing and past trips apart. Leave the end empty for a one-day
        event.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  title: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: BrandColors.primary },
  row: { flexDirection: 'row', gap: Spacing.two },
  fieldMain: { flex: 1, gap: 2 },
  disabled: { opacity: 0.5 },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: BrandColors.inputField,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  fieldOpen: { borderColor: BrandColors.base50 },
  label: { fontFamily: 'PlusJakartaSans-Medium', fontSize: 14, color: BrandColors.secondary },
  value: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: BrandColors.primary },
  placeholder: { fontFamily: 'PlusJakartaSans-Regular', color: BrandColors.secondary },
  hint: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 12, color: BrandColors.secondary },
});
