import { BrandColors, Spacing } from '@/constants/theme';
import { fetchExpenses } from '@/services/Firebase/expenseService';
import { fetchSettlements } from '@/services/Firebase/settlementService';
import { fetchUserTrips } from '@/services/Firebase/tripService';
import { useCombinedTotal } from '@/services/currency/useCombinedTotal';
import { computeBalances } from '@/utils/balance';
import { formatMoney } from '@/utils/money';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Line {
  currency: string;
  owed: number;
  owe: number;
}

interface AllTripsSummaryProps {
  userId: string;
  /** Changes whenever the active trip's numbers change, so the summary refreshes. */
  refreshKey: string;
  embedded?: boolean;
  /** Render just the text, to sit beside another label. */
  inline?: boolean;
}

/** What you are owed and what you owe across every trip, one line per currency. */
export default function AllTripsSummary({ userId, refreshKey, embedded, inline }: AllTripsSummaryProps) {
  const [lines, setLines] = useState<Line[] | null>(null);

  useEffect(() => {
    if (!userId) return;
    let active = true;

    (async () => {
      const trips = await fetchUserTrips(userId);
      const byCurrency: Record<string, Line> = {};

      await Promise.all(
        trips.map(async (trip) => {
          const [expenses, settlements] = await Promise.all([
            fetchExpenses(trip.id),
            fetchSettlements(trip.id),
          ]);
          const mine = computeBalances(Object.keys(trip.members ?? {}), expenses, settlements).find(
            (balance) => balance.memberId === userId,
          );
          if (!mine) return;
          const line = (byCurrency[trip.currency] ??= {
            currency: trip.currency,
            owed: 0,
            owe: 0,
          });
          if (mine.net > 0) line.owed += mine.net;
          else line.owe += -mine.net;
        }),
      );

      if (active) setLines(Object.values(byCurrency));
    })().catch((error) => console.error('Failed to load the all-trips summary:', error));

    return () => {
      active = false;
    };
  }, [userId, refreshKey]);

  const owedTotal = useCombinedTotal(
    userId,
    (lines ?? []).map((l) => ({ currency: l.currency, amount: l.owed })),
  );
  const oweTotal = useCombinedTotal(
    userId,
    (lines ?? []).map((l) => ({ currency: l.currency, amount: l.owe })),
  );

  if (!lines || lines.length === 0) return null;

  const parts = (line: Line) =>
    [
      line.owed > 0 && 'owed ' + formatMoney(line.owed, line.currency),
      line.owe > 0 && 'owe ' + formatMoney(line.owe, line.currency),
    ]
      .filter(Boolean)
      .join(' · ');

  const text =
    owedTotal && oweTotal
      ? [
          owedTotal.total > 0 && 'owed ≈ ' + formatMoney(owedTotal.total, owedTotal.currency),
          oweTotal.total > 0 && 'owe ≈ ' + formatMoney(oweTotal.total, oweTotal.currency),
        ]
          .filter(Boolean)
          .join(' · ')
      : lines.map(parts).filter(Boolean).join('  |  ');

  if (!text) return null;

  if (inline) {
    return (
      <Text style={styles.inline} numberOfLines={1}>
        All trips: {text}
      </Text>
    );
  }

  return (
    <View style={[styles.card, embedded && styles.embedded]}>
      <Text style={styles.label} numberOfLines={2}>
        <Text style={styles.title}>All trips: </Text>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  inline: {
    flexShrink: 1,
    textAlign: 'right',
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 11,
    color: BrandColors.secondary,
  },
  embedded: {
    borderWidth: 0,
    borderRadius: 0,
    paddingHorizontal: 0,
    paddingBottom: 0,
    paddingTop: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: BrandColors.border,
  },
  card: {
    backgroundColor: BrandColors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  title: {
    fontFamily: 'PlusJakartaSans-Bold',
    color: BrandColors.primary,
  },
  row: { flexDirection: 'row', gap: Spacing.three },
  combined: { borderTopWidth: 1, borderTopColor: BrandColors.border, paddingTop: Spacing.two },
  cell: { flex: 1, gap: 2 },
  label: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: BrandColors.secondary,
  },
  value: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 16 },
});
