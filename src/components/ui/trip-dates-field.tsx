import DateCalendar from '@/components/ui/date-calendar';
import { BrandColors, Spacing } from '@/constants/theme';
import { pickDay, rangeLength } from '@/utils/dateRange';
import { formatDay, todayKey } from '@/utils/money';
import { CalendarDays } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

interface TripDatesFieldProps {
  /** YYYY-MM-DD, or '' when not set. */
  startDate: string;
  endDate: string;
  onChange: (dates: { startDate: string; endDate: string }) => void;
}

/** How long the finished range stays on screen before the calendar closes. */
const CLOSE_AFTER_MS = 350;

/**
 * When the trip happens. Tapping Starts or Ends opens one calendar as a
 * pop-up: from Starts, the first tap is the start and the next the end, with
 * the days between highlighted; from Ends, the tap is the end. Picking the end
 * closes it, and so does tapping anywhere outside it. No end = a one-day trip.
 */
export default function TripDatesField({ startDate, endDate, onChange }: TripDatesFieldProps) {
  /** Which end the next tap picks, or null while the calendar is closed. */
  const [picking, setPicking] = useState<'start' | 'end' | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  const range = { start: startDate, end: endDate };
  const days = rangeLength(range);

  const open = (which: 'start' | 'end') => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setPicking(which === 'end' && !startDate ? 'start' : which);
  };
  const close = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setPicking(null);
  };

  const onDay = (day: string) => {
    if (!picking) return;
    const result = pickDay(range, day, picking);
    onChange({ startDate: result.range.start, endDate: result.range.end });
    if (result.done) {
      // A moment to see the highlighted range before the calendar goes.
      closeTimer.current = setTimeout(() => setPicking(null), CLOSE_AFTER_MS);
    } else {
      setPicking('end');
    }
  };

  const tile = (kind: 'start' | 'end', label: string, value: string, empty: string) => (
    <Pressable
      style={({ pressed }) => [
        styles.tile,
        picking === kind && styles.tileActive,
        pressed && styles.pressed,
      ]}
      onPress={() => open(kind)}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value ? formatDay(value) : empty}. Change`}
    >
      <View style={styles.tileText}>
        <Text style={styles.tileLabel}>{label}</Text>
        <Text style={[styles.tileValue, !value && styles.tilePlaceholder]} numberOfLines={1}>
          {value ? formatDay(value) : empty}
        </Text>
      </View>
      <CalendarDays size={16} color={BrandColors.secondary} />
    </Pressable>
  );

  const prompt =
    picking === 'start'
      ? 'Tap the first day of the trip.'
      : startDate && !endDate
        ? 'Now tap the last day, or tap the first day again for a one-day trip.'
        : 'Tap the last day of the trip.';

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Trip dates</Text>

      <View style={styles.row}>
        {tile('start', 'Starts', startDate, 'Pick a day')}
        {tile('end', 'Ends', endDate, startDate ? 'Same day' : 'Pick a day')}
      </View>

      <Text style={styles.hint}>
        {startDate
          ? days > 1
            ? `${days} days.`
            : 'A one-day trip. Tap Ends to add a last day.'
          : 'Required. Tap Starts to pick the trip’s dates.'}
      </Text>

      {/* The calendar floats above the page; tapping anywhere outside it closes it. */}
      <Modal
        visible={picking !== null}
        transparent
        animationType="fade"
        onRequestClose={close}
        statusBarTranslucent
      >
        {/* The dimmed backdrop and the card are siblings: on the web a pressable
            is a <button>, and the calendar's buttons can't sit inside another. */}
        <View style={styles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Close the calendar"
          />
          <View style={styles.card}>
            <Text style={styles.prompt}>{prompt}</Text>
            <DateCalendar value={startDate || todayKey()} range={range} onChange={onDay} />
            <View style={styles.footer}>
              {!!startDate && (
                <Pressable
                  onPress={() => {
                    onChange({ startDate: '', endDate: '' });
                    setPicking('start');
                  }}
                  hitSlop={8}
                  accessibilityRole="button"
                >
                  <Text style={styles.clear}>Clear dates</Text>
                </Pressable>
              )}
              <Pressable onPress={close} hitSlop={8} accessibilityRole="button" style={styles.done}>
                <Text style={styles.doneText}>Done</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  title: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: BrandColors.primary },
  row: { flexDirection: 'row', gap: Spacing.two },
  tile: {
    flex: 1,
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
  tileActive: { borderColor: BrandColors.base50 },
  tileText: { flex: 1, gap: 2 },
  tileLabel: { fontFamily: 'PlusJakartaSans-Medium', fontSize: 12, color: BrandColors.secondary },
  tileValue: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: BrandColors.primary },
  tilePlaceholder: { fontFamily: 'PlusJakartaSans-Regular', color: BrandColors.secondary },
  hint: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 12, color: BrandColors.secondary },
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
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  clear: { fontFamily: 'PlusJakartaSans-Medium', fontSize: 13, color: BrandColors.info },
  done: {
    marginLeft: 'auto',
    backgroundColor: BrandColors.base50,
    borderRadius: 12,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  doneText: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: BrandColors.heading },
});
