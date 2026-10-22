import { BrandColors, Spacing } from '@/constants/theme';
import { formatDay, isValidDayKey, parseDayKey, todayKey } from '@/utils/money';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** Sunday first, the way wall calendars are printed here. */
const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const CELL_WIDTH = `${100 / 7}%`;

/** How many years either side of today the year list reaches. */
const YEAR_REACH = 10;

interface DateCalendarProps {
  /** Any day as YYYY-MM-DD. */
  value: string;
  onChange: (day: string) => void;
  /** Earliest day that can be picked, as YYYY-MM-DD. */
  minDay?: string;
  /** Latest day that can be picked, as YYYY-MM-DD. */
  maxDay?: string;
}

/** Pads a month and day to two digits and joins them into YYYY-MM-DD. */
const toDayKey = (year: number, monthIndex: number, dayOfMonth: number): string => {
  const month = `${monthIndex + 1}`.padStart(2, '0');
  const day = `${dayOfMonth}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * A month grid for picking a day, so nobody has to tap an arrow twenty times.
 *
 * Days are compared as YYYY-MM-DD strings: because the format is fixed width,
 * plain string comparison already puts them in date order.
 */
export default function DateCalendar({ value, onChange, minDay, maxDay }: DateCalendarProps) {
  const selectedKey = isValidDayKey(value) ? value : todayKey();
  const today = todayKey();

  const [cursor, setCursor] = useState(() => {
    const date = parseDayKey(selectedKey) ?? new Date();
    return { year: date.getFullYear(), month: date.getMonth() };
  });

  /** True while the year list is open instead of the day grid. */
  const [pickingYear, setPickingYear] = useState(false);

  // Follow the selection when it changes from outside, but leave the month
  // alone while the user is only paging through the calendar.
  useEffect(() => {
    const date = parseDayKey(selectedKey);
    if (!date) return;
    setCursor((prev) =>
      prev.year === date.getFullYear() && prev.month === date.getMonth()
        ? prev
        : { year: date.getFullYear(), month: date.getMonth() },
    );
  }, [selectedKey]);

  const cells = useMemo(() => {
    const firstOfMonth = new Date(cursor.year, cursor.month, 1, 12, 0, 0, 0);
    const leadingBlanks = firstOfMonth.getDay();
    // Day 0 of the next month is the last day of this one.
    const daysInMonth = new Date(cursor.year, cursor.month + 1, 0, 12).getDate();

    const list: (string | null)[] = [];
    for (let i = 0; i < leadingBlanks; i += 1) list.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      list.push(toDayKey(cursor.year, cursor.month, day));
    }
    while (list.length % 7 !== 0) list.push(null);
    return list;
  }, [cursor]);

  const rows = useMemo(() => {
    const chunks: (string | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) chunks.push(cells.slice(i, i + 7));
    return chunks;
  }, [cells]);

  const shiftMonth = (delta: number) => {
    const next = new Date(cursor.year, cursor.month + delta, 1, 12);
    setCursor({ year: next.getFullYear(), month: next.getMonth() });
  };

  /**
   * Every year the calendar offers, widest range first.
   *
   * It always includes the year already on screen, so opening the list never
   * hides the place you came from.
   */
  const years = useMemo(() => {
    const thisYear = new Date().getFullYear();
    const first = Math.min(thisYear - YEAR_REACH, cursor.year);
    const last = Math.max(thisYear + YEAR_REACH, cursor.year);
    const list: number[] = [];
    for (let year = first; year <= last; year += 1) list.push(year);
    return list;
  }, [cursor.year]);

  const pickYear = (year: number) => {
    setPickingYear(false);
    setCursor((prev) => ({ ...prev, year }));
  };

  const isOutOfRange = (key: string): boolean => {
    if (minDay && key < minDay) return true;
    if (maxDay && key > maxDay) return true;
    return false;
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Pressable onPress={() => shiftMonth(-1)} hitSlop={8} style={styles.navButton}>
          <ChevronLeft size={18} color={BrandColors.primary} />
        </Pressable>

        {/* The month doubles as the button that opens the year list, so a date
            years away is two taps rather than a run of thirty. */}
        <Pressable
          onPress={() => setPickingYear((open) => !open)}
          hitSlop={8}
          style={styles.monthButton}
          accessibilityRole="button"
          accessibilityLabel="Choose a year"
        >
          <Text style={styles.monthLabel}>
            {MONTH_NAMES[cursor.month]} {cursor.year}
          </Text>
          <ChevronDown size={15} color={BrandColors.primary} />
        </Pressable>

        <Pressable onPress={() => shiftMonth(1)} hitSlop={8} style={styles.navButton}>
          <ChevronRight size={18} color={BrandColors.primary} />
        </Pressable>
      </View>

      {pickingYear ? (
        <View style={styles.yearGrid}>
          {years.map((year) => {
            const isCurrent = year === cursor.year;
            return (
              <Pressable
                key={year}
                style={[styles.yearCell, isCurrent && styles.yearCellOn]}
                onPress={() => pickYear(year)}
                accessibilityRole="button"
                accessibilityState={{ selected: isCurrent }}
              >
                <Text style={[styles.yearText, isCurrent && styles.yearTextOn]}>{year}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <>
          <View style={styles.weekRow}>
            {WEEKDAY_LABELS.map((label, index) => (
              <Text key={`${label}-${index}`} style={styles.weekday}>
                {label}
              </Text>
            ))}
          </View>

          {rows.map((row, rowIndex) => (
            <View key={`row-${rowIndex}`} style={styles.dayRow}>
              {row.map((key, columnIndex) => {
                if (!key) {
                  return <View key={`blank-${rowIndex}-${columnIndex}`} style={styles.dayCell} />;
                }

                const isSelected = key === selectedKey;
                const isToday = key === today;
                const disabled = isOutOfRange(key);

                return (
                  <Pressable
                    key={key}
                    disabled={disabled}
                    onPress={() => onChange(key)}
                    style={styles.dayCell}
                    accessibilityRole="button"
                    accessibilityLabel={formatDay(key)}
                    accessibilityState={{ selected: isSelected, disabled }}
                  >
                    <View
                      style={[
                        styles.dayCircle,
                        isToday && !isSelected && styles.dayCircleToday,
                        isSelected && styles.dayCircleSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          isToday && !isSelected && styles.dayTextToday,
                          isSelected && styles.dayTextSelected,
                          disabled && styles.dayTextDisabled,
                        ]}
                      >
                        {Number(key.slice(-2))}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}

          <View style={styles.footer}>
            <Text style={styles.selectedLabel}>{formatDay(selectedKey)}</Text>
            {!isOutOfRange(today) && (
              <Pressable onPress={() => onChange(today)} hitSlop={8}>
                <Text style={styles.todayAction}>Jump to today</Text>
              </Pressable>
            )}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 14,
    backgroundColor: BrandColors.surfaceAlt,
    paddingBottom: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.two,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
  },
  navButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  monthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: 10,
  },
  monthLabel: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    color: BrandColors.primary,
  },
  yearGrid: {
    // Laid out as a grid rather than a scrolling list: a list inside the sheet's
    // own scroll area does not scroll on phones, which hid most of the years.
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.two,
    paddingBottom: Spacing.two,
    gap: Spacing.one,
  },
  yearCell: {
    width: '23%',
    paddingVertical: Spacing.two,
    borderRadius: 10,
    alignItems: 'center',
  },
  yearCellOn: {
    backgroundColor: BrandColors.base50,
  },
  yearText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14,
    color: BrandColors.primary,
  },
  yearTextOn: {
    fontFamily: 'PlusJakartaSans-Bold',
    color: BrandColors.heading,
  },
  weekRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.one,
  },
  weekday: {
    width: CELL_WIDTH,
    textAlign: 'center',
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 11,
    color: BrandColors.secondary,
    paddingVertical: Spacing.one,
  },
  dayRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.one,
  },
  dayCell: {
    width: CELL_WIDTH,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleToday: {
    borderWidth: 1,
    borderColor: BrandColors.base50,
  },
  dayCircleSelected: {
    backgroundColor: BrandColors.base50,
  },
  dayText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 13,
    color: BrandColors.primary,
  },
  dayTextToday: {
    color: BrandColors.base700,
    fontFamily: 'PlusJakartaSans-Bold',
  },
  dayTextSelected: {
    fontFamily: 'PlusJakartaSans-Bold',
    color: BrandColors.heading,
  },
  dayTextDisabled: {
    color: BrandColors.disabled,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: BrandColors.border,
    marginTop: Spacing.one,
  },
  selectedLabel: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 12,
    color: BrandColors.primary,
  },
  todayAction: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: BrandColors.info,
  },
});
