import { BrandColors, Spacing } from '@/constants/theme';
import { parseDayKey } from '@/utils/money';
import { useState } from 'react';
import { LayoutChangeEvent, Text, View } from 'react-native';
import { themedStyles } from '@/constants/themed-styles';

/** The width a chart has to draw in, once it has been laid out. */
export function useChartWidth(initial = 300) {
  const [width, setWidth] = useState(initial);
  const onLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    if (next > 0 && next !== width) setWidth(next);
  };
  return { width, onLayout };
}

/** "Sat" and "1" for a day key, for labels under a bar or column. */
export const dayLabel = (day: string) => {
  const date = parseDayKey(day);
  if (!date) return { weekday: '', date: day };
  return {
    weekday: date.toLocaleDateString('en-US', { weekday: 'short' }),
    date: String(date.getDate()),
    month: date.toLocaleDateString('en-US', { month: 'short' }),
  };
};

/** Short money for axis labels: ₱1.2k, ₱15k, ₱1.5M. */
export const shortMoney = (value: number, currency: string) => {
  const symbol = currency === 'PHP' ? '₱' : '';
  const suffix = symbol ? '' : ` ${currency}`;
  const abs = Math.abs(value);
  const text =
    abs >= 1_000_000
      ? `${Number((value / 1_000_000).toFixed(1))}M`
      : abs >= 1000
        ? `${Number((value / 1000).toFixed(1))}k`
        : `${Math.round(value)}`;
  return `${symbol}${text}${suffix}`;
};

export function LegendDot({
  colour,
  label,
  dashed,
}: {
  colour: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <View style={styles.legendItem}>
      <View
        style={[
          dashed ? styles.legendLine : styles.legendDot,
          dashed ? { borderColor: colour } : { backgroundColor: colour },
        ]}
      />
      <Text style={styles.legendText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export const chartStyles = themedStyles(() => ({
  card: {
    gap: Spacing.three,
    backgroundColor: BrandColors.background,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 15,
    padding: Spacing.three,
  },
  title: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: BrandColors.primary },
  sub: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 12, color: BrandColors.secondary },
  axis: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 10, color: BrandColors.secondary },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  empty: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: BrandColors.secondary,
    textAlign: 'center',
    paddingVertical: Spacing.four,
  },
}));

const styles = themedStyles(() => ({
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%' },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  legendLine: { width: 14, height: 0, borderTopWidth: 2, borderStyle: 'dashed' },
  legendText: { fontFamily: 'PlusJakartaSans-Medium', fontSize: 11, color: BrandColors.primary },
}));
