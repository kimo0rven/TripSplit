import { ProgressBar } from '@/components/ui/card';
import TripIcon from '@/components/ui/trip-icon';
import { findTripColor } from '@/constants/trip-colors';
import { BrandColors, Spacing } from '@/constants/theme';
import { Trip } from '@/types/trips';
import { formatLongDay, formatMoney, formatMoneyShort, parseDayKey, todayKey } from '@/utils/money';
import { tripIsOver, tripStatus } from '@/utils/tripList';
import { CalendarDays, CheckCircle2, Clock3, PiggyBank, QrCode } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface TripHeroProps {
  trip: Trip;
  currency: string;
  /** Everything spent on this trip so far. */
  totalSpent: number;
  /** The part of `totalSpent` that falls to the person looking at it. */
  yourShare: number;
  /** The trip's budget, or 0 when none was set. */
  budget: number;
  /** Opens the sheet with the trip's invite code and QR. */
  onOpenQr?: () => void;
}

/**
 * "in 3 days", "Day 2 of 5", "Trip finished" - the one line under the name.
 *
 * It used to spell out the start date again, which the date row underneath
 * already shows in full, so the same date appeared twice on one small card.
 * Counting down to the start says something new instead.
 */
function statusLine(trip: Trip, today: string): string {
  const status = tripStatus(trip, today);
  if (status === null) return 'No dates set';

  if (status === 'upcoming') {
    const start = parseDayKey(trip.startDate ?? '');
    const now = parseDayKey(today);
    if (!start || !now) return 'Coming up';

    const days = Math.round((start.getTime() - now.getTime()) / 86_400_000);
    if (days <= 0) return 'Starts today';
    if (days === 1) return 'Starts tomorrow';
    return `Starts in ${days} days`;
  }

  if (status === 'past') return 'Trip finished';

  // Ongoing: which day of the trip it is.
  const start = parseDayKey(trip.startDate ?? '');
  const now = parseDayKey(today);
  if (!start || !now) return 'Happening now';

  const day = Math.round((now.getTime() - start.getTime()) / 86_400_000) + 1;
  const end = parseDayKey(trip.endDate || trip.startDate || '');
  const total = end ? Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1 : 1;
  return total > 1 ? `Day ${day} of ${total} · Happening now` : 'Happening today';
}

/**
 * The banner at the top of a trip: what it is, when it is, and how the money
 * is going.
 *
 * It replaces what used to be a bare title and a row of faces, which left the
 * top of the trip page looking like an empty form. Everything here is real data
 * the page already loads - nothing is decoration standing in for content.
 */
export default function TripHero({
  trip,
  currency,
  totalSpent,
  yourShare,
  budget,
  onOpenQr,
}: TripHeroProps) {
  const palette = findTripColor(trip.iconColor);
  const today = todayKey();
  const over = tripIsOver(trip, today);

  const spent = totalSpent;
  const ratio = budget > 0 ? spent / budget : 0;
  const left = budget - spent;

  const dateLine = trip.startDate
    ? trip.endDate && trip.endDate !== trip.startDate
      ? `${formatLongDay(trip.startDate)} – ${formatLongDay(trip.endDate)}`
      : formatLongDay(trip.startDate)
    : 'No dates set';

  return (
    <View style={[styles.card, { backgroundColor: palette.background }]}>
      {/* A soft wash of the trip's own colour, so each trip feels different
          without the text losing contrast. */}
      <View style={styles.topRow}>
        <View style={[styles.iconBox, { backgroundColor: palette.foreground }]}>
          <TripIcon name={trip.icon} size={22} color={palette.background} />
        </View>
        <View style={styles.titleBlock}>
          <Text style={[styles.name, { color: palette.foreground }]} numberOfLines={2}>
            {trip.name}
          </Text>
          <View style={styles.statusChip}>
            {over ? (
              <CheckCircle2 size={11} color={palette.foreground} />
            ) : (
              <Clock3 size={11} color={palette.foreground} />
            )}
            <Text style={[styles.statusText, { color: palette.foreground }]} numberOfLines={1}>
              {over ? 'Finished' : statusLine(trip, today)}
            </Text>
          </View>
        </View>

        {/* The invite code and QR live in a sheet, opened from here, so the
            sharing tools sit on the card they belong to instead of in a
            separate list further down the page. */}
        {onOpenQr && !!trip.inviteCode && (
          <Pressable
            style={({ pressed }) => [styles.qrButton, pressed && styles.qrPressed]}
            onPress={onOpenQr}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Show this trip's invite code and QR code"
          >
            <QrCode size={18} color={palette.foreground} />
          </Pressable>
        )}
      </View>

      <View style={styles.metaItem}>
        <CalendarDays size={13} color={palette.foreground} />
        <Text style={[styles.metaText, { color: palette.foreground }]} numberOfLines={1}>
          {dateLine}
        </Text>
      </View>

      {/* Spending against the budget, or just the total when no budget is set. */}
      <View style={styles.moneyBlock}>
        <View style={styles.moneyRow}>
          <View>
            <Text style={[styles.moneyLabel, { color: palette.foreground }]}>Spent so far</Text>
            <Text style={[styles.moneyValue, { color: palette.foreground }]}>
              {formatMoney(spent, currency)}
            </Text>
          </View>
          {/* This used to sit in its own yellow card further down the page,
              repeating the total the hero already shows. It reads best beside
              the total, on the right, where the eye already is. */}
          <View style={styles.shareSide}>
            <Text style={[styles.moneyLabel, { color: palette.foreground }]}>Your share</Text>
            <Text style={[styles.shareValue, { color: palette.foreground }]}>
              {formatMoney(yourShare, currency)}
            </Text>
          </View>
        </View>

        {budget > 0 ? (
          <>
            <ProgressBar
              ratio={ratio}
              color={over ? BrandColors.success : left < 0 ? BrandColors.error : palette.foreground}
              height={6}
            />
            {/* The budget figure moved here from the top row, which now belongs
                to "spent so far" and "your share". */}
            <View style={styles.budgetLine}>
              <Text style={[styles.budgetNote, { color: palette.foreground }]}>
                {Math.round(Math.min(ratio, 1) * 100)}% of {formatMoneyShort(budget, currency)}{' '}
                budget
              </Text>
              <Text style={[styles.budgetLeftText, { color: palette.foreground }]}>
                {left >= 0
                  ? `${formatMoneyShort(left, currency)} left`
                  : `${formatMoneyShort(Math.abs(left), currency)} over`}
              </Text>
            </View>
          </>
        ) : (
          <View style={styles.noBudget}>
            <PiggyBank size={12} color={palette.foreground} />
            <Text style={[styles.budgetNote, { color: palette.foreground }]}>
              No budget set for this trip
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    flex: 1,
    gap: Spacing.one,
  },
  qrButton: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    // A faint wash of the card's own ink, so the button reads as a control
    // without introducing a second colour onto the banner.
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  qrPressed: {
    opacity: 0.6,
  },
  name: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 20,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 11,
    opacity: 0.85,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    flexShrink: 1,
  },
  metaText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    opacity: 0.8,
  },
  moneyBlock: {
    gap: Spacing.two,
  },
  moneyRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  moneyLabel: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    opacity: 0.75,
  },
  moneyValue: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 24,
  },
  shareSide: {
    alignItems: 'flex-end',
  },
  shareValue: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 16,
  },
  budgetLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  budgetNote: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    opacity: 0.8,
    flexShrink: 1,
  },
  budgetLeftText: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 11,
    opacity: 0.9,
  },
  noBudget: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
});
