import { BrandColors, Spacing } from '@/constants/theme';
import { niceCeiling, SettlePoint } from '@/utils/charts';
import { formatMoney } from '@/utils/money';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Polyline } from 'react-native-svg';

import { chartStyles, dayLabel, LegendDot, shortMoney, useChartWidth } from './chart-kit';

interface SettleChartProps {
  points: SettlePoint[];
  currency: string;
}

const HEIGHT = 130;
const AXIS = 40;
const PAD = 6;

/** Still owed between people against what has been paid back, day by day. */
export default function SettleChart({ points, currency }: SettleChartProps) {
  const { width, onLayout } = useChartWidth();
  if (!points.length || points.every((point) => point.outstanding === 0 && point.paidBack === 0)) {
    return <Text style={chartStyles.empty}>Nothing has needed settling yet.</Text>;
  }

  const top = niceCeiling(
    Math.max(...points.map((point) => Math.max(point.outstanding, point.paidBack))),
  );
  const plotWidth = Math.max(10, width - AXIS);
  const xOf = (index: number) =>
    points.length === 1
      ? plotWidth / 2
      : PAD + (index / (points.length - 1)) * (plotWidth - PAD * 2);
  const yOf = (value: number) => HEIGHT - (value / top) * (HEIGHT - PAD);
  const line = (key: 'outstanding' | 'paidBack') =>
    points.map((point, index) => `${xOf(index)},${yOf(point[key])}`).join(' ');
  const last = points[points.length - 1];

  return (
    <View style={styles.wrap}>
      <View style={styles.row} onLayout={onLayout}>
        <View style={[styles.axis, { height: HEIGHT }]}>
          <Text style={chartStyles.axis}>{shortMoney(top, currency)}</Text>
          <Text style={chartStyles.axis}>0</Text>
        </View>
        <Svg width={plotWidth} height={HEIGHT}>
          <Line
            x1={0}
            y1={HEIGHT - 0.5}
            x2={plotWidth}
            y2={HEIGHT - 0.5}
            stroke={BrandColors.border}
          />
          <Polyline
            points={line('outstanding')}
            fill="none"
            stroke={BrandColors.warning}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
          <Polyline
            points={line('paidBack')}
            fill="none"
            stroke={BrandColors.success}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
        </Svg>
      </View>
      <View style={[styles.xLabels, { marginLeft: AXIS }]}>
        <Text style={chartStyles.axis}>
          {dayLabel(points[0].day).month} {dayLabel(points[0].day).date}
        </Text>
        <Text style={chartStyles.axis}>
          {dayLabel(last.day).month} {dayLabel(last.day).date}
        </Text>
      </View>
      <View style={chartStyles.legend}>
        <LegendDot
          colour={BrandColors.warning}
          label={`Still owed · ${formatMoney(last.outstanding, currency)}`}
        />
        <LegendDot
          colour={BrandColors.success}
          label={`Paid back · ${formatMoney(last.paidBack, currency)}`}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  row: { flexDirection: 'row' },
  axis: { width: AXIS, justifyContent: 'space-between', paddingRight: 4 },
  xLabels: { flexDirection: 'row', justifyContent: 'space-between' },
});
