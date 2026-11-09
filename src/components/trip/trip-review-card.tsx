import { Card, HelperText, SectionTitle } from '@/components/ui/card';
import { BrandColors, Spacing } from '@/constants/theme';
import { Expense } from '@/types/expenses';
import { TripMember } from '@/types/trips';
import { categoryLabel } from '@/utils/balance';
import { yearInReview } from '@/utils/fun';
import { firstName, memberLookup } from '@/utils/memberLookup';
import { formatDay, formatMoney } from '@/utils/money';
import { Clapperboard, Sparkles } from 'lucide-react-native';
import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { themedStyles } from '@/constants/themed-styles';

interface TripReviewCardProps {
  members: TripMember[];
  /** The expenses to sum up: the whole trip, or the days a report is showing. */
  expenses: Expense[];
  currency: string;
  /** Extra lines under the usual ones, such as how much is settled. */
  extraFacts?: { label: string; value: string }[];
}

/**
 * The trip in one card: what was spent, by how many people, where most of it
 * went, who covered the most, and the busiest day.
 */
export default function TripReviewCard({
  members,
  expenses,
  currency,
  extraFacts = [],
}: TripReviewCardProps) {
  const review = useMemo(() => yearInReview(members, expenses), [members, expenses]);
  const lookup = useMemo(() => memberLookup(members), [members]);
  const nameOf = (id: string) => firstName(lookup.get(id)?.fullname, 'Someone who left');
  const money = (value: number) => formatMoney(value, currency);

  return (
    <>
      <SectionTitle>Trip in review</SectionTitle>

      {review.expenses === 0 ? (
        <Card style={styles.emptyCard}>
          <Clapperboard size={22} color={BrandColors.secondary} />
          <Text style={styles.emptyTitle}>Nothing to review yet</Text>
          <HelperText>The story writes itself once expenses are added.</HelperText>
        </Card>
      ) : (
        <Card style={styles.reviewCard}>
          <View style={styles.reviewTop}>
            <Sparkles size={16} color={BrandColors.base700} />
            <Text style={styles.reviewTitle}>
              {review.expenses} {review.expenses === 1 ? 'expense' : 'expenses'}, one trip
            </Text>
          </View>

          <Text style={styles.reviewBig}>{money(review.spent)}</Text>
          <Text style={styles.reviewHint}>spent by {review.people} people</Text>

          <View style={styles.reviewFacts}>
            {review.topCategory && (
              <Fact
                label="Most of it went to"
                value={`${categoryLabel(review.topCategory.key)} · ${money(review.topCategory.amount)}`}
              />
            )}
            {review.mostGenerous && (
              <Fact
                label="Covered the most"
                value={`${nameOf(review.mostGenerous.memberId)} · ${money(review.mostGenerous.amount)}`}
              />
            )}
            {review.busiestDay && (
              <Fact
                label="Busiest day"
                value={`${formatDay(review.busiestDay.day)} · ${money(review.busiestDay.amount)}`}
              />
            )}
            {extraFacts.map((fact) => (
              <Fact key={fact.label} label={fact.label} value={fact.value} />
            ))}
          </View>
        </Card>
      )}
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.factRow}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = themedStyles(() => ({
  emptyCard: { alignItems: 'center', gap: Spacing.one, paddingVertical: Spacing.four },
  emptyTitle: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: BrandColors.primary },
  reviewCard: {
    backgroundColor: BrandColors.infoBg,
    borderColor: BrandColors.infoBg,
    gap: Spacing.one,
  },
  reviewTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reviewTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: BrandColors.primary,
    opacity: 0.7,
  },
  reviewBig: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 30,
    color: BrandColors.primary,
    letterSpacing: -0.5,
  },
  reviewHint: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 12, color: BrandColors.secondary },
  reviewFacts: { gap: 4, marginTop: Spacing.one },
  factRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  factLabel: {
    flex: 1,
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: BrandColors.secondary,
  },
  factValue: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 12,
    color: BrandColors.primary,
    maxWidth: '62%',
    textAlign: 'right',
  },
}));
