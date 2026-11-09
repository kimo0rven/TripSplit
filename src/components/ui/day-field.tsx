import DateCalendar from '@/components/ui/date-calendar';
import { BrandColors, Spacing } from '@/constants/theme';
import { formatDay, todayKey } from '@/utils/money';
import { CalendarDays } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { themedStyles } from '@/constants/themed-styles';

interface DayFieldProps {
  label: string;
  /** YYYY-MM-DD, or '' when not picked. */
  value: string;
  onChange: (day: string) => void;
  /** Days outside these can't be picked, e.g. outside the trip. */
  minDay?: string;
  maxDay?: string;
  placeholder?: string;
}

/**
 * One day, shown as a tile. Tapping it opens a calendar as a pop-up; picking a
 * day or tapping anywhere outside closes it, so the calendar never takes up
 * the page while it is not being used.
 */
export default function DayField({
  label,
  value,
  onChange,
  minDay,
  maxDay,
  placeholder = 'Pick a day',
}: DayFieldProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.tile, open && styles.tileOpen, pressed && styles.pressed]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? formatDay(value) : placeholder}. Change`}
      >
        <View style={styles.text}>
          <Text style={styles.label}>{label}</Text>
          <Text style={[styles.value, !value && styles.placeholder]} numberOfLines={1}>
            {value ? formatDay(value) : placeholder}
          </Text>
        </View>
        <CalendarDays size={16} color={BrandColors.secondary} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
      >
        {/* The dimmed backdrop and the card are siblings: on the web a pressable
            is a <button>, and the calendar's buttons can't sit inside another. */}
        <View style={styles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Close the calendar"
          />
          <View style={styles.card}>
            <Text style={styles.prompt}>{label}</Text>
            <DateCalendar
              value={value || minDay || todayKey()}
              minDay={minDay}
              maxDay={maxDay}
              onChange={(day) => {
                onChange(day);
                setOpen(false);
              }}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = themedStyles(() => ({
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
  text: { flex: 1, gap: 2 },
  label: { fontFamily: 'PlusJakartaSans-Medium', fontSize: 12, color: BrandColors.secondary },
  value: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: BrandColors.primary },
  placeholder: { fontFamily: 'PlusJakartaSans-Regular', color: BrandColors.secondary },
  pressed: { opacity: 0.7 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    gap: Spacing.three,
    backgroundColor: BrandColors.background,
    borderRadius: 20,
    padding: Spacing.three,
  },
  prompt: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 15,
    color: BrandColors.heading,
    textAlign: 'center',
  },
}));
