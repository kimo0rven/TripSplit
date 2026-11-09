import { BrandColors, Spacing } from '@/constants/theme';
import { BudgetLine, niceCeiling } from '@/utils/charts';
import { formatMoney } from '@/utils/money';
import { Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { chartStyles, dayLabel, LegendDot, shortMoney, useChartWidth } from './chart-kit';
import { themedStyles } from '@/constants/themed-styles';

interface BudgetChartProps {
  line: BudgetLine;
  /** Every day of the trip, so the forecast reaches the last one. */
  days: string[];
  budget: number;
  currency: string;
}

const HEIGHT = 150;
const AXIS = 40;
const PAD = 8;

/**
 * Spending climbing day by day against the budget, with a dotted line to
 * where the trip ends up at the pace so far.
 */
export default function BudgetChart({ line, days, budget, currency }: BudgetChartProps) {
  const { width, onLayout } = useChartWidth();
  if (!days.length || !line.spent.length) {
    return <Text style={chartStyles.empty}>Spending shows here once the trip has dates.</Text>;
  }

  const last = line.spent[line.spent.length - 1];
  const top = niceCeiling(Math.max(budget, line.forecast ?? 0, last.total) * 1.05);
  const plotWidth = Math.max(10, width - AXIS);
  const xOf = (index: number) =>
    days.length === 1 ? plotWidth / 2 : PAD + (index / (days.length - 1)) * (plotWidth - PAD * 2);
  const yOf = (value: number) => HEIGHT - (value / top) * (HEIGHT - PAD);
  const points = line.spent.map((point, index) => `${xOf(index)},${yOf(point.total)}`).join(' ');
  const lastX = xOf(line.spent.length - 1);
  const over = budget > 0 && (line.forecast ?? last.total) > budget;
  const colour = over ? BrandColors.error : BrandColors.info;

  return (
    <View style={styles.wrap}>
      <View style={styles.row} onLayout={onLayout}>
        <View style={[styles.axis, { height: HEIGHT }]}>
          <Text style={chartStyles.axis}>{shortMoney(top, currency)}</Text>
          <Text style={chartStyles.axis}>{shortMoney(top / 2, currency)}</Text>
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
          <Line
            x1={0}
            y1={yOf(top / 2)}
            x2={plotWidth}
            y2={yOf(top / 2)}
            stroke={BrandColors.inputField}
          />
          {budget > 0 && (
            <Line
              x1={0}
              y1={yOf(budget)}
              x2={plotWidth}
              y2={yOf(budget)}
              stroke={BrandColors.base700}
              strokeWidth={1.5}
              strokeDasharray="6 4"
            />
          )}
          {line.forecast !== null && (
            <Line
              x1={lastX}
              y1={yOf(last.total)}
              x2={xOf(days.length - 1)}
              y2={yOf(line.forecast)}
              stroke={colour}
              strokeWidth={2}
              strokeDasharray="2 4"
              strokeLinecap="round"
            />
          )}
          <Polyline
            points={points}
            fill="none"
            stroke={colour}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
          <Circle cx={lastX} cy={yOf(last.total)} r={4} fill={colour} />
        </Svg>
      </View>
      <View style={[styles.xLabels, { marginLeft: AXIS }]}>
        <Text style={chartStyles.axis}>
          {dayLabel(days[0]).month} {dayLabel(days[0]).date}
        </Text>
        <Text style={chartStyles.axis}>
          {dayLabel(days[days.length - 1]).month} {dayLabel(days[days.length - 1]).date}
        </Text>
      </View>

      <View style={chartStyles.legend}>
        <LegendDot colour={colour} label={`Spent · ${formatMoney(last.total, currency)}`} />
        {budget > 0 && (
          <LegendDot
            colour={BrandColors.base700}
            label={`Budget · ${formatMoney(budget, currency)}`}
            dashed
          />
        )}
        {line.forecast !== null && (
          <LegendDot
            colour={colour}
            label={`At this pace · ${formatMoney(line.forecast, currency)}`}
            dashed
          />
        )}
      </View>
      <Text style={[chartStyles.sub, over && styles.warn]}>
        {line.forecast === null
          ? budget > 0
            ? last.total > budget
              ? `${formatMoney(last.total - budget, currency)} over the budget.`
              : `${formatMoney(budget - last.total, currency)} under the budget.`
            : `About ${formatMoney(line.pacePerDay, currency)} a day.`
          : budget > 0
            ? over
              ? `At ${formatMoney(line.pacePerDay, currency)} a day, the trip goes ${formatMoney(line.forecast - budget, currency)} over budget.`
              : `At ${formatMoney(line.pacePerDay, currency)} a day, the trip stays ${formatMoney(budget - line.forecast, currency)} under budget.`
            : `About ${formatMoney(line.pacePerDay, currency)} a day so far. Set a budget in trip settings to compare.`}
      </Text>
    </View>
  );
}

const styles = themedStyles(() => ({
  wrap: { gap: Spacing.two },
  row: { flexDirection: 'row' },
  axis: { width: AXIS, justifyContent: 'space-between', paddingRight: 4 },
  xLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  warn: { color: BrandColors.error },
}));
