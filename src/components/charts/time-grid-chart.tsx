import { BrandColors, Spacing } from '@/constants/theme';
import { DAY_PARTS, TimeGrid } from '@/utils/charts';
import { formatLongDay, formatMoney } from '@/utils/money';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { chartStyles, dayLabel } from './chart-kit';

interface TimeGridChartProps {
  grid: TimeGrid;
  days: string[];
  currency: string;
}

const CELL = 30;

/**
 * When the money goes: a square for each part of each day, darker the more
 * was spent then. Scrolls sideways on a long trip; tapping a square says how much.
 */
export default function TimeGridChart({ grid, days, currency }: TimeGridChartProps) {
  const [picked, setPicked] = useState<{ day: number; part: number } | null>(null);
  if (!days.length || grid.max <= 0) {
    return (
      <Text style={chartStyles.empty}>
        Add a time to expenses to see whether the money goes in the morning or at night.
      </Text>
    );
  }

  // Which part of the day takes the most, over the whole trip.
  const byPart = DAY_PARTS.map((_, part) => grid.cells.reduce((sum, row) => sum + row[part], 0));
  const busiest = byPart.indexOf(Math.max(...byPart));

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.labels}>
          <View style={{ height: 30 }} />
          {DAY_PARTS.map((part) => (
            <Text key={part.key} style={[chartStyles.axis, styles.partLabel]}>
              {part.label}
            </Text>
          ))}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.columns}>
            {days.map((day, dayIndex) => {
              const label = dayLabel(day);
              return (
                <View key={day} style={styles.column}>
                  <View style={styles.head}>
                    <Text style={chartStyles.axis}>{label.weekday}</Text>
                    <Text style={styles.date}>{label.date}</Text>
                  </View>
                  {DAY_PARTS.map((part, partIndex) => {
                    const value = grid.cells[dayIndex][partIndex];
                    const isPicked = picked?.day === dayIndex && picked.part === partIndex;
                    return (
                      <Pressable
                        key={part.key}
                        onPress={() =>
                          setPicked(isPicked ? null : { day: dayIndex, part: partIndex })
                        }
                        style={[
                          styles.cell,
                          value > 0
                            ? {
                                backgroundColor: BrandColors.base50,
                                opacity: 0.2 + (value / grid.max) * 0.8,
                              }
                            : styles.cellEmpty,
                          isPicked && styles.cellPicked,
                        ]}
                        accessibilityLabel={`${formatLongDay(day)}, ${part.label}: ${formatMoney(value, currency)}`}
                      />
                    );
                  })}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
      <Text style={chartStyles.sub}>
        {picked
          ? `${formatLongDay(days[picked.day])}, ${DAY_PARTS[picked.part].label.toLowerCase()}: ${formatMoney(
              grid.cells[picked.day][picked.part],
              currency,
            )}`
          : `Most of the money goes in the ${DAY_PARTS[busiest].label.toLowerCase()}.`}
        {grid.untimed > 0
          ? ` ${grid.untimed} ${grid.untimed === 1 ? 'expense has' : 'expenses have'} no time, so ${grid.untimed === 1 ? "isn't" : "aren't"} shown.`
          : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  row: { flexDirection: 'row' },
  labels: { width: 66, gap: 4 },
  partLabel: { height: CELL, lineHeight: CELL },
  columns: { flexDirection: 'row', gap: 4 },
  column: { gap: 4, alignItems: 'center' },
  head: { height: 30, alignItems: 'center', justifyContent: 'flex-end' },
  date: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 11, color: BrandColors.primary },
  cell: { width: CELL, height: CELL, borderRadius: 6 },
  cellEmpty: { backgroundColor: BrandColors.inputField },
  cellPicked: { borderWidth: 2, borderColor: BrandColors.primary },
});
