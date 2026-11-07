import { BrandColors, Spacing } from '@/constants/theme';
import { colourFor, DayBar, niceCeiling, OTHER_KEY } from '@/utils/charts';
import { formatLongDay, formatMoney } from '@/utils/money';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { chartStyles, dayLabel, LegendDot, shortMoney, useChartWidth } from './chart-kit';

interface DailyBarsChartProps {
  bars: DayBar[];
  top: string[];
  currency: string;
  /** The category's name, e.g. "Food". */
  labelOf: (key: string) => string;
  today: string;
}

const PLOT_HEIGHT = 150;
const MIN_BAR = 22;
const GAP = 8;
const AXIS_WIDTH = 40;

/**
 * One bar per day of the trip, stacked by category. When the days don't fit
 * across the screen the bars scroll sideways; tapping a bar shows that day.
 */
export default function DailyBarsChart({
  bars,
  top,
  currency,
  labelOf,
  today,
}: DailyBarsChartProps) {
  const { width, onLayout } = useChartWidth();
  const [picked, setPicked] = useState<string | null>(null);

  if (!bars.length) {
    return <Text style={chartStyles.empty}>Add trip dates or expenses to see each day.</Text>;
  }

  const ceiling = niceCeiling(Math.max(...bars.map((bar) => bar.total)));
  const room = width - AXIS_WIDTH;
  const fits = bars.length * (MIN_BAR + GAP) <= room;
  // Bars share the width when they fit; otherwise they keep a readable size and scroll.
  const barWidth = fits ? Math.min(44, room / bars.length - GAP) : MIN_BAR;
  const chosen = bars.find((bar) => bar.day === picked) ?? null;
  const name = (key: string) => (key === OTHER_KEY ? 'Other' : labelOf(key));

  return (
    <View style={styles.wrap}>
      <View style={styles.plotRow} onLayout={onLayout}>
        {/* The scale stays put while the bars scroll. */}
        <View style={[styles.axis, { height: PLOT_HEIGHT }]}>
          <Text style={chartStyles.axis}>{shortMoney(ceiling, currency)}</Text>
          <Text style={chartStyles.axis}>{shortMoney(ceiling / 2, currency)}</Text>
          <Text style={chartStyles.axis}>0</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={!fits}
          scrollEnabled={!fits}
          contentContainerStyle={styles.scroll}
        >
          <View>
            <View style={[styles.grid, { height: PLOT_HEIGHT }]} pointerEvents="none">
              <View style={styles.gridLine} />
              <View style={styles.gridLine} />
              <View style={[styles.gridLine, styles.baseLine]} />
            </View>
            <View style={styles.bars}>
              {bars.map((bar) => {
                const label = dayLabel(bar.day);
                const isPicked = bar.day === picked;
                const isToday = bar.day === today;
                return (
                  <Pressable
                    key={bar.day}
                    onPress={() => setPicked(isPicked ? null : bar.day)}
                    style={[styles.column, { width: barWidth + GAP }]}
                    accessibilityRole="button"
                    accessibilityLabel={`${formatLongDay(bar.day)}: ${formatMoney(bar.total, currency)}`}
                  >
                    <View style={[styles.track, { height: PLOT_HEIGHT, width: barWidth }]}>
                      {/* Stacked from the bottom: biggest category lowest. */}
                      {bar.parts.map((part, index) => (
                        <View
                          key={part.key}
                          style={[
                            {
                              height: (part.amount / ceiling) * PLOT_HEIGHT,
                              backgroundColor:
                                part.key === OTHER_KEY ? '#B8B8B8' : colourFor(part.key, top),
                              opacity: picked && !isPicked ? 0.35 : 1,
                            },
                            index === bar.parts.length - 1 && styles.barTop,
                          ]}
                        />
                      ))}
                    </View>
                    <Text style={[styles.dayText, isToday && styles.today]}>{label.weekday}</Text>
                    <Text style={[styles.dateText, isToday && styles.today]}>{label.date}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </View>

      <View style={chartStyles.legend}>
        {top.map((key) => (
          <LegendDot key={key} colour={colourFor(key, top)} label={name(key)} />
        ))}
        {bars.some((bar) => bar.parts.some((part) => part.key === OTHER_KEY)) && (
          <LegendDot colour="#B8B8B8" label="Other" />
        )}
      </View>

      {chosen ? (
        <View style={styles.detail}>
          <View style={styles.detailTop}>
            <Text style={chartStyles.title}>{formatLongDay(chosen.day)}</Text>
            <Text style={chartStyles.title}>{formatMoney(chosen.total, currency)}</Text>
          </View>
          {chosen.parts.length === 0 ? (
            <Text style={chartStyles.sub}>Nothing spent this day.</Text>
          ) : (
            chosen.parts.map((part) => (
              <View key={part.key} style={styles.detailRow}>
                <LegendDot
                  colour={part.key === OTHER_KEY ? '#B8B8B8' : colourFor(part.key, top)}
                  label={name(part.key)}
                />
                <Text style={chartStyles.sub}>{formatMoney(part.amount, currency)}</Text>
              </View>
            ))
          )}
        </View>
      ) : (
        <Text style={chartStyles.sub}>
          Tap a day to see where the money went{fits ? '' : '. Swipe for more days'}.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.three },
  plotRow: { flexDirection: 'row' },
  axis: { width: AXIS_WIDTH, justifyContent: 'space-between', paddingRight: 4 },
  scroll: { paddingRight: Spacing.one },
  grid: { position: 'absolute', left: 0, right: 0, top: 0, justifyContent: 'space-between' },
  gridLine: { height: 1, backgroundColor: BrandColors.inputField },
  baseLine: { backgroundColor: BrandColors.border },
  bars: { flexDirection: 'row', alignItems: 'flex-start' },
  column: { alignItems: 'center' },
  // Filled from the bottom up: the first part sits on the base line.
  track: { justifyContent: 'flex-start', flexDirection: 'column-reverse' },
  barTop: { borderTopLeftRadius: 5, borderTopRightRadius: 5 },
  dayText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 9,
    color: BrandColors.secondary,
    marginTop: 4,
  },
  dateText: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 11, color: BrandColors.primary },
  today: { color: BrandColors.info },
  detail: {
    gap: Spacing.two,
    backgroundColor: BrandColors.inputField,
    borderRadius: 12,
    padding: Spacing.three,
  },
  detailTop: { flexDirection: 'row', justifyContent: 'space-between' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
