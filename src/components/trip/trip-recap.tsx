import Avatar from '@/components/ui/avatar';
import { ProgressBar } from '@/components/ui/card';
import TripIcon from '@/components/ui/trip-icon';
import { findTripColor } from '@/constants/trip-colors';
import { BrandColors, Spacing } from '@/constants/theme';
import { Expense, Settlement, ItineraryItem } from '@/types/expenses';
import { Trip, TripMember } from '@/types/trips';
import { categoryLabel, computeTripTotals, simplifyDebts } from '@/utils/balance';
import { formatDay, formatMoney } from '@/utils/money';
import { shortName } from '@/utils/format';
import {
  ArrowRight,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  PieChart,
  Receipt,
  Users,
  Wallet,
} from 'lucide-react-native';
import { ReactNode, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface TripRecapProps {
  trip: Trip;
  members: TripMember[];
  expenses: Expense[];
  settlements: Settlement[];
  itinerary: ItineraryItem[];
  currency: string;
}

/** A tint per category, so the breakdown bar reads as a picture, not a list. */
const CATEGORY_COLORS: Record<string, string> = {
  food: '#FEBB1B',
  transport: '#4A90D9',
  stay: '#8E7CC3',
  activity: '#4CAF7D',
  shopping: '#E07A75',
  other: '#B0B4BA',
};

const categoryColor = (key: string): string => CATEGORY_COLORS[key] ?? CATEGORY_COLORS.other;

/** Anything under a cent is rounding noise, not money still owed. */
const isZero = (value: number): boolean => Math.abs(value) < 0.005;

/**
 * The story of a finished trip.
 *
 * A finished trip otherwise looks exactly like it did on day one - the expenses
 * stop changing and nothing says "that's it". This page answers the questions
 * people actually ask afterwards: what did we spend, where did it go, who put
 * in the most, what was the biggest single thing, and is everyone square.
 */
export default function TripRecap({
  trip,
  members,
  expenses,
  settlements,
  itinerary,
  currency,
}: TripRecapProps) {
  const recap = useMemo(() => {
    const memberIds = members.map((member) => member.id);
    const totals = computeTripTotals(memberIds, expenses, settlements);

    // What each person put into expenses. Read from the expenses directly, not
    // from the balances: a settlement also moves money, and counting it here
    // would make the person who paid everyone back look like the biggest spender.
    const paidForExpenses: Record<string, number> = {};
    expenses.forEach((expense) => {
      Object.entries(expense.paidBy ?? {}).forEach(([id, amount]) => {
        paidForExpenses[id] = (paidForExpenses[id] ?? 0) + amount;
      });
    });

    const crew = members
      .map((member) => {
        const balance = totals.balances.find((entry) => entry.memberId === member.id);
        return {
          member,
          paid: paidForExpenses[member.id] ?? 0,
          share: balance?.owed ?? 0,
          net: balance?.net ?? 0,
        };
      })
      .sort((a, b) => b.paid - a.paid);

    const topSpender = crew[0]?.paid > 0 ? crew[0] : null;
    const biggest = [...expenses].sort((a, b) => b.amount - a.amount)[0] ?? null;

    const dayCount = (() => {
      if (!trip.startDate || !trip.endDate) return null;
      const start = new Date(trip.startDate + 'T00:00:00');
      const end = new Date(trip.endDate + 'T00:00:00');
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
      const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
      return days > 0 ? days : null;
    })();

    // Where the money went, biggest slice first.
    const spendByCategory: Record<string, number> = {};
    expenses.forEach((expense) => {
      spendByCategory[expense.category] = (spendByCategory[expense.category] ?? 0) + expense.amount;
    });
    const categories = Object.entries(spendByCategory)
      .map(([key, amount]) => ({ key, amount }))
      .sort((a, b) => b.amount - a.amount);

    // The day that cost the most - usually a surprise, and worth naming.
    const spendByDay: Record<string, number> = {};
    expenses.forEach((expense) => {
      spendByDay[expense.spentOn] = (spendByDay[expense.spentOn] ?? 0) + expense.amount;
    });
    const priciestDay = Object.entries(spendByDay).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const priciestDayAmount = priciestDay ? spendByDay[priciestDay] : 0;
    // Only interesting when one day really did carry more than its share.
    const priciestDayMatters = expenses.length > 1 && priciestDay !== null;

    const outstanding = simplifyDebts(totals.balances);
    const unsettled = totals.balances
      .filter((balance) => balance.net > 0)
      .reduce((sum, balance) => sum + balance.net, 0);

    // Whoever covered the most more than their own share. Only people who
    // actually paid something count: going purely by paid minus share can hand
    // this to someone who paid nothing at all, if their share happened to be
    // negative. Nothing here is a judgement - it is the number people ask about.
    const mostGenerous =
      [...crew]
        .filter((person) => person.paid > 0 && person.paid > person.share)
        .sort((a, b) => b.paid - b.share - (a.paid - a.share))[0] ?? null;

    return {
      spent: totals.spent,
      count: expenses.length,
      average: expenses.length > 0 ? totals.spent / expenses.length : 0,
      perPerson: members.length > 0 ? totals.spent / members.length : 0,
      dayCount,
      people: members.length,
      planCount: itinerary.length,
      crew,
      topSpender,
      biggest,
      categories,
      priciestDay: priciestDayMatters ? priciestDay : null,
      priciestDayAmount,
      settledTotal: totals.settled,
      settledCount: settlements.filter((s) => !s.status || s.status === 'confirmed').length,
      outstanding,
      unsettled,
      balanced: isZero(unsettled),
      mostGenerous,
    };
  }, [members, expenses, settlements, itinerary, trip]);

  // Nothing was ever recorded, so there is no story to tell.
  if (recap.count === 0 && recap.planCount === 0) {
    return null;
  }

  const palette = findTripColor(trip.iconColor);
  const nameOf = (id: string): string =>
    members.find((member) => member.id === id)?.fullname.split(' ')[0] ?? 'Someone';

  return (
    <View style={styles.wrap}>
      {/* The trip wears its own colours, so the recap opens like the trip itself. */}
      <View style={[styles.banner, { backgroundColor: palette.background }]}>
        <View style={styles.bannerTop}>
          <View style={[styles.bannerIcon, { backgroundColor: palette.foreground }]}>
            <TripIcon name={trip.icon} size={20} color={palette.background} />
          </View>
          <Text style={[styles.bannerKicker, { color: palette.foreground }]}>Trip recap</Text>
        </View>

        <Text style={[styles.bannerTitle, { color: palette.foreground }]} numberOfLines={2}>
          {shortName(trip.name, 34)}
        </Text>

        <View style={styles.bannerMetaRow}>
          <CalendarDays size={12} color={palette.foreground} />
          <Text style={[styles.bannerMeta, { color: palette.foreground }]} numberOfLines={1}>
            {trip.startDate ? formatDay(trip.startDate) : 'No dates set'}
            {trip.endDate && trip.endDate !== trip.startDate ? ` – ${formatDay(trip.endDate)}` : ''}
          </Text>
        </View>

        <View style={styles.bannerMetaRow}>
          <Users size={12} color={palette.foreground} />
          <Text style={[styles.bannerMeta, { color: palette.foreground }]} numberOfLines={1}>
            {recap.dayCount ? `${recap.dayCount} ${recap.dayCount === 1 ? 'day' : 'days'} · ` : ''}
            {recap.people} {recap.people === 1 ? 'person' : 'people'}
          </Text>
        </View>
      </View>

      {/* The headline: one number, big. */}
      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Total spent</Text>
        <Text style={styles.totalValue}>{formatMoney(recap.spent, currency)}</Text>
        <Text style={styles.totalHint}>
          {recap.count} {recap.count === 1 ? 'expense' : 'expenses'}
          {recap.count > 0 ? ` · ${formatMoney(recap.average, currency)} average` : ''}
        </Text>
      </View>

      {/* Three figures side by side, so the shape of the trip is readable at a glance. */}
      <View style={styles.tileRow}>
        <Tile
          icon={<Receipt size={14} color={BrandColors.secondary} />}
          label="Expenses"
          value={String(recap.count)}
        />
        <Tile
          icon={<Wallet size={14} color={BrandColors.secondary} />}
          label="Per person"
          value={formatMoney(recap.perPerson, currency)}
        />
        <Tile
          icon={<CalendarRange size={14} color={BrandColors.secondary} />}
          label="Plans made"
          value={String(recap.planCount)}
        />
      </View>

      {/* Where the money actually went. */}
      {recap.categories.length > 0 && (
        <View style={styles.card}>
          <SectionHeading icon={<PieChart size={14} color={BrandColors.primary} />}>
            Where it went
          </SectionHeading>

          <View style={styles.stackTrack}>
            {recap.categories.map((category) => (
              <View
                key={category.key}
                style={{
                  flex: recap.spent > 0 ? category.amount / recap.spent : 0,
                  backgroundColor: categoryColor(category.key),
                }}
              />
            ))}
          </View>

          <View style={styles.legend}>
            {recap.categories.map((category) => {
              const share = recap.spent > 0 ? Math.round((category.amount / recap.spent) * 100) : 0;
              return (
                <View key={category.key} style={styles.legendRow}>
                  <View
                    style={[styles.legendDot, { backgroundColor: categoryColor(category.key) }]}
                  />
                  <Text style={styles.legendLabel}>{categoryLabel(category.key)}</Text>
                  <Text style={styles.legendPercent}>{share}%</Text>
                  <Text style={styles.legendAmount}>{formatMoney(category.amount, currency)}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Who paid in, and where each person ended up. */}
      {recap.crew.length > 0 && (
        <View style={styles.card}>
          <SectionHeading icon={<Users size={14} color={BrandColors.primary} />}>
            The crew
          </SectionHeading>

          {recap.crew.map((person) => (
            <View key={person.member.id} style={styles.crewRow}>
              <Avatar name={person.member.fullname} photoURL={person.member.photoURL} size={34} />
              <View style={styles.crewText}>
                <Text style={styles.crewName} numberOfLines={1}>
                  {person.member.fullname}
                </Text>
                <Text style={styles.crewPaid} numberOfLines={1}>
                  Paid {formatMoney(person.paid, currency)}
                </Text>
              </View>
              <Standing net={person.net} currency={currency} />
            </View>
          ))}
        </View>
      )}

      {/* The handful of facts people repeat afterwards. */}
      <View style={styles.card}>
        <SectionHeading icon={<Receipt size={14} color={BrandColors.primary} />}>
          Highlights
        </SectionHeading>

        {recap.biggest && (
          <FactRow
            label="Biggest expense"
            value={`${recap.biggest.title} · ${formatMoney(recap.biggest.amount, currency)}`}
          />
        )}
        {recap.priciestDay && (
          <FactRow
            label="Priciest day"
            value={`${formatDay(recap.priciestDay)} · ${formatMoney(
              recap.priciestDayAmount,
              currency,
            )}`}
          />
        )}
        {recap.topSpender && (
          <FactRow
            label="Paid the most"
            value={`${recap.topSpender.member.fullname.split(' ')[0]} · ${formatMoney(
              recap.topSpender.paid,
              currency,
            )}`}
          />
        )}
        {recap.mostGenerous && recap.people > 1 && (
          <FactRow
            label="Most upfront"
            value={`${recap.mostGenerous.member.fullname.split(' ')[0]} · ${formatMoney(
              Math.max(0, recap.mostGenerous.paid - recap.mostGenerous.share),
              currency,
            )} over their share`}
          />
        )}
        {recap.settledCount > 0 && (
          <FactRow
            label="Payments made"
            value={`${recap.settledCount} · ${formatMoney(recap.settledTotal, currency)}`}
          />
        )}
      </View>

      {/* The one thing worth acting on: who still owes whom. */}
      <View style={[styles.card, recap.balanced ? styles.cardGood : styles.cardWarn]}>
        <SectionHeading
          icon={
            <CheckCircle2
              size={14}
              color={recap.balanced ? BrandColors.success : BrandColors.warning}
            />
          }
          tint={recap.balanced ? BrandColors.success : BrandColors.warning}
        >
          {recap.balanced ? 'Everyone is square' : 'Still to settle'}
        </SectionHeading>

        {recap.balanced ? (
          <Text style={styles.settleGood}>
            All the money has been squared away. Nothing left to chase.
          </Text>
        ) : (
          <>
            <Text style={styles.settleLead}>
              {formatMoney(recap.unsettled, currency)} still owed between the group.
            </Text>

            <ProgressBar
              ratio={recap.spent > 0 ? recap.unsettled / recap.spent : 1}
              color={BrandColors.warning}
              height={6}
            />

            {recap.outstanding.map((edge, index) => (
              <View key={`${edge.from}-${edge.to}-${index}`} style={styles.transferRow}>
                <Avatar
                  name={members.find((member) => member.id === edge.from)?.fullname}
                  photoURL={members.find((member) => member.id === edge.from)?.photoURL}
                  size={24}
                />
                <Text style={styles.transferName} numberOfLines={1}>
                  {nameOf(edge.from)}
                </Text>
                <ArrowRight size={13} color={BrandColors.secondary} />
                <Avatar
                  name={members.find((member) => member.id === edge.to)?.fullname}
                  photoURL={members.find((member) => member.id === edge.to)?.photoURL}
                  size={24}
                />
                <Text style={styles.transferName} numberOfLines={1}>
                  {nameOf(edge.to)}
                </Text>
                <Text style={styles.transferAmount}>{formatMoney(edge.amount, currency)}</Text>
              </View>
            ))}
          </>
        )}
      </View>
    </View>
  );
}

/** A heading with a small picture, used at the top of every block. */
function SectionHeading({
  icon,
  children,
  tint = BrandColors.primary,
}: {
  icon: ReactNode;
  children: ReactNode;
  tint?: string;
}) {
  return (
    <View style={styles.sectionHeading}>
      {icon}
      <Text style={[styles.sectionHeadingText, { color: tint }]}>{children}</Text>
    </View>
  );
}

/** One figure in the row of three under the total. */
function Tile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <View style={styles.tile}>
      {icon}
      <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.tileLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** One labelled line in the highlights block. */
function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.factRow}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

/** Whether a person is owed money back, owes money, or is even. */
function Standing({ net, currency }: { net: number; currency: string }) {
  if (isZero(net)) {
    return <Text style={styles.standingEven}>Even</Text>;
  }

  const owed = net > 0;
  return (
    <View style={[styles.standingPill, owed ? styles.standingGood : styles.standingBad]}>
      <Text
        style={[styles.standingText, { color: owed ? BrandColors.success : BrandColors.error }]}
      >
        {owed ? 'gets back' : 'owes'} {formatMoney(Math.abs(net), currency)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.three },

  banner: {
    borderRadius: 20,
    padding: Spacing.four,
    gap: 6,
  },
  bannerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  bannerIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerKicker: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    opacity: 0.75,
  },
  bannerTitle: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 22,
    lineHeight: 28,
    marginTop: 2,
  },
  bannerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bannerMeta: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    opacity: 0.8,
  },

  totalCard: {
    backgroundColor: BrandColors.surfaceAlt,
    borderRadius: 20,
    padding: Spacing.four,
    gap: 2,
  },
  totalLabel: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: BrandColors.secondary,
  },
  totalValue: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 32,
    color: BrandColors.heading,
    letterSpacing: -0.5,
  },
  totalHint: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: BrandColors.secondary,
  },

  tileRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  tile: {
    flex: 1,
    backgroundColor: BrandColors.surfaceAlt,
    borderRadius: 14,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    gap: 3,
  },
  tileValue: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 15,
    color: BrandColors.heading,
  },
  tileLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    color: BrandColors.secondary,
  },

  card: {
    backgroundColor: BrandColors.background,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 18,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cardGood: {
    borderColor: BrandColors.successBg,
    backgroundColor: BrandColors.successBg,
  },
  cardWarn: {
    borderColor: BrandColors.warningBg,
    backgroundColor: BrandColors.warningBg,
  },

  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionHeadingText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    letterSpacing: 0.2,
  },

  stackTrack: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 99,
    overflow: 'hidden',
    backgroundColor: BrandColors.inputField,
    gap: 1.5,
  },
  legend: { gap: 6 },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    flex: 1,
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: BrandColors.primary,
  },
  legendPercent: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 11,
    color: BrandColors.secondary,
    minWidth: 30,
    textAlign: 'right',
  },
  legendAmount: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 12,
    color: BrandColors.primary,
    minWidth: 74,
    textAlign: 'right',
  },

  crewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: 5,
  },
  crewText: { flex: 1, gap: 1 },
  crewName: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 13,
    color: BrandColors.primary,
  },
  crewPaid: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    color: BrandColors.secondary,
  },
  standingEven: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 11,
    color: BrandColors.secondary,
  },
  standingPill: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: 99,
  },
  standingGood: { backgroundColor: BrandColors.successBg },
  standingBad: { backgroundColor: BrandColors.errorBg },
  standingText: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 11,
  },

  factRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
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

  settleLead: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: BrandColors.warning,
  },
  settleGood: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: BrandColors.success,
  },
  transferRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 2,
  },
  transferName: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: BrandColors.primary,
    maxWidth: 72,
  },
  transferAmount: {
    flex: 1,
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 12,
    color: BrandColors.primary,
    textAlign: 'right',
  },
});
