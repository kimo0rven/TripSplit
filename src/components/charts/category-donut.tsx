import { BrandColors, Spacing } from '@/constants/theme';
import { colourFor, DonutSlice, OTHER_COLOUR, OTHER_KEY } from '@/utils/charts';
import { formatMoney } from '@/utils/money';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { chartStyles } from './chart-kit';
import { themedStyles } from '@/constants/themed-styles';

interface CategoryDonutProps {
  slices: DonutSlice[];
  top: string[];
  total: number;
  currency: string;
  labelOf: (key: string) => string;
}

const SIZE = 150;
const R = SIZE / 2;
const THICK = 24;

const arc = (start: number, end: number) => {
  // Angles in turns (0..1), clockwise from the top.
  const point = (turn: number, radius: number) => {
    const a = turn * 2 * Math.PI;
    return [R + radius * Math.sin(a), R - radius * Math.cos(a)];
  };
  const outer = R - 1;
  const inner = R - THICK;
  const sweep = Math.min(end - start, 0.9999);
  const large = sweep > 0.5 ? 1 : 0;
  const [x1, y1] = point(start, outer);
  const [x2, y2] = point(start + sweep, outer);
  const [x3, y3] = point(start + sweep, inner);
  const [x4, y4] = point(start, inner);
  return `M ${x1} ${y1} A ${outer} ${outer} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${inner} ${inner} 0 ${large} 0 ${x4} ${y4} Z`;
};

/** Where the money went, as a ring. Tapping a slice or its name puts it in the middle. */
export default function CategoryDonut({
  slices,
  top,
  total,
  currency,
  labelOf,
}: CategoryDonutProps) {
  const [picked, setPicked] = useState<string | null>(null);
  if (!slices.length) return <Text style={chartStyles.empty}>No expenses in this range yet.</Text>;

  const name = (key: string) => (key === OTHER_KEY ? 'Other' : labelOf(key));
  const colour = (key: string) => (key === OTHER_KEY ? OTHER_COLOUR : colourFor(key, top));
  const chosen = slices.find((slice) => slice.key === picked) ?? null;
  // Where each slice starts: the sum of the slices before it.
  const starts = slices.map((_, index) =>
    slices.slice(0, index).reduce((sum, slice) => sum + slice.fraction, 0),
  );

  return (
    <View style={styles.row}>
      <View style={styles.ring}>
        <Svg width={SIZE} height={SIZE}>
          {slices.map((slice, index) => {
            const path = arc(starts[index], starts[index] + slice.fraction);
            return (
              <Path
                key={slice.key}
                d={path}
                fill={colour(slice.key)}
                opacity={picked && picked !== slice.key ? 0.3 : 1}
                stroke={BrandColors.background}
                strokeWidth={slices.length > 1 ? 2 : 0}
                onPress={() => setPicked(picked === slice.key ? null : slice.key)}
              />
            );
          })}
        </Svg>
        <View style={styles.centre} pointerEvents="none">
          <Text style={styles.centreValue} numberOfLines={1}>
            {chosen ? `${Math.round(chosen.fraction * 100)}%` : formatMoney(total, currency)}
          </Text>
          <Text style={chartStyles.sub} numberOfLines={1}>
            {chosen ? name(chosen.key) : 'in all'}
          </Text>
        </View>
      </View>

      <View style={styles.legend}>
        {slices.map((slice) => (
          <Pressable
            key={slice.key}
            style={[styles.legendRow, picked && picked !== slice.key && styles.dim]}
            onPress={() => setPicked(picked === slice.key ? null : slice.key)}
            accessibilityRole="button"
          >
            <View style={[styles.dot, { backgroundColor: colour(slice.key) }]} />
            <Text style={styles.legendName} numberOfLines={1}>
              {name(slice.key)}
            </Text>
            <View style={styles.legendNumbers}>
              <Text style={styles.legendPercent}>{Math.round(slice.fraction * 100)}%</Text>
              <Text style={chartStyles.axis}>{formatMoney(slice.amount, currency)}</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = themedStyles(() => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  ring: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  centre: { position: 'absolute', alignItems: 'center', maxWidth: SIZE - THICK * 2 - 8 },
  centreValue: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 15,
    color: BrandColors.primary,
  },
  legend: { flex: 1, gap: Spacing.two },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dim: { opacity: 0.4 },
  dot: { width: 10, height: 10, borderRadius: 3 },
  legendName: {
    flex: 1,
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: BrandColors.primary,
  },
  legendNumbers: { alignItems: 'flex-end' },
  legendPercent: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 12, color: BrandColors.primary },
}));
