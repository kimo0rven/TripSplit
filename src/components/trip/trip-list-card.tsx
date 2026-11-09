import MemberFaces from '@/components/ui/member-faces';
import TripIcon from '@/components/ui/trip-icon';
import { findTripColor } from '@/constants/trip-colors';
import { BrandColors, Spacing, isDarkTheme } from '@/constants/theme';
import type { Trip, TripMember } from '@/types/trips';
import { shortName } from '@/utils/format';
import { formatMoney } from '@/utils/money';
import { tripTimeLabel, type TripSummary } from '@/utils/tripList';
import {
  Archive,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MoreHorizontal,
  Star,
} from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { themedStyles } from '@/constants/themed-styles';

interface TripListCardProps {
  trip: Trip;
  members: TripMember[];
  /** Filled in a moment after the list appears; undefined until then. */
  summary?: TripSummary;
  /** The trip the dashboard shows. */
  isActive: boolean;
  isArchived: boolean;
  /** The trip's dates as text, or when it was made if it has none. */
  dateText: string;
  today: string;
  onOpen: () => void;
  onMore: () => void;
}

/**
 * One trip in the Trips list, built to answer at a glance what people open
 * the list for: which trip, when it is, and where the money stands for them.
 *
 *   [icon]  Baguio Weekend                ⋯
 *           ◷ Starts in 3 days · Nov 10 – Nov 12, 2026
 *   ─────────────────────────────────────────
 *   ₱12,340 spent · You're owed ₱450      (faces)
 */
export default function TripListCard({
  trip,
  members,
  summary,
  isActive,
  isArchived,
  dateText,
  today,
  onOpen,
  onMore,
}: TripListCardProps) {
  const palette = findTripColor(trip.iconColor);
  // The trip colour's dark ink is unreadable on a dark card; there its soft
  // light shade is used instead.
  const accent = isDarkTheme() ? palette.background : palette.foreground;
  const currency = trip.currency || 'PHP';
  const when = tripTimeLabel(trip, today);
  const finished = when === 'Finished';

  const net = summary?.myNet ?? 0;
  const standing = !summary
    ? null
    : !summary.hasExpenses
      ? { text: 'No expenses yet', color: BrandColors.secondary }
      : Math.abs(net) < 0.01
        ? { text: 'You are settled', color: BrandColors.success, settled: true }
        : net > 0
          ? { text: `You're owed ${formatMoney(net, currency)}`, color: BrandColors.success }
          : { text: `You owe ${formatMoney(-net, currency)}`, color: BrandColors.error };

  // The card and its ⋯ button are siblings, not one inside the other: on the
  // web every pressable is a <button>, and a button inside a button is invalid.
  return (
    <View style={[styles.wrap, isArchived && styles.cardArchived]}>
      <Pressable
        style={({ pressed }) => [
          styles.card,
          isActive && styles.cardActive,
          pressed && styles.pressed,
        ]}
        onPress={onOpen}
        onLongPress={onMore}
        accessibilityRole="button"
        accessibilityLabel={`${trip.name}${when ? `, ${when}` : ''}${standing ? `, ${standing.text}` : ''}`}
      >
        <View style={styles.top}>
          <View style={[styles.icon, { backgroundColor: palette.background }]}>
            <TripIcon name={trip.icon} size={22} color={palette.foreground} />
          </View>

          <View style={styles.titleBlock}>
            {(isActive || isArchived) && (
              <View style={styles.tags}>
                {isActive && (
                  <View style={[styles.tag, styles.tagActive]}>
                    <Star size={10} color={BrandColors.onBrand} fill={BrandColors.onBrand} />
                    <Text style={[styles.tagText, styles.tagTextActive]}>On dashboard</Text>
                  </View>
                )}
                {isArchived && (
                  <View style={styles.tag}>
                    <Archive size={10} color={BrandColors.secondary} />
                    <Text style={styles.tagText}>Archived</Text>
                  </View>
                )}
              </View>
            )}
            <Text style={styles.name} numberOfLines={1}>
              {shortName(trip.name)}
            </Text>
            <View style={styles.whenRow}>
              {when ? (
                <>
                  {finished ? (
                    <CheckCircle2 size={12} color={BrandColors.secondary} />
                  ) : (
                    <Clock3 size={12} color={accent} />
                  )}
                  <Text style={[styles.when, !finished && { color: accent }]} numberOfLines={1}>
                    {when}
                  </Text>
                  <Text style={styles.dot}>·</Text>
                </>
              ) : (
                <CalendarDays size={12} color={BrandColors.secondary} />
              )}
              <Text style={styles.date} numberOfLines={1}>
                {dateText}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.bottom}>
          <View style={styles.money}>
            {summary ? (
              <>
                <Text style={styles.spent} numberOfLines={1}>
                  {summary.hasExpenses ? `${formatMoney(summary.spent ?? 0, currency)} spent` : ''}
                </Text>
                {!!standing && (
                  <View style={styles.standingRow}>
                    {'settled' in standing && standing.settled && (
                      <CheckCircle2 size={12} color={BrandColors.success} />
                    )}
                    <Text style={[styles.standing, { color: standing.color }]} numberOfLines={1}>
                      {standing.text}
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.placeholder} />
            )}
          </View>
          <MemberFaces members={members} size={26} max={4} ringColor={BrandColors.background} />
        </View>
      </Pressable>

      <Pressable
        onPress={onMore}
        hitSlop={10}
        style={styles.more}
        accessibilityRole="button"
        accessibilityLabel={`More actions for ${trip.name}`}
      >
        <MoreHorizontal size={18} color={BrandColors.secondary} />
      </Pressable>
    </View>
  );
}

const styles = themedStyles(() => ({
  wrap: {
    position: 'relative',
  },
  card: {
    backgroundColor: BrandColors.background,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  cardActive: {
    borderColor: BrandColors.base50,
    borderWidth: 2,
  },
  cardArchived: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.85,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 3,
    // Room for the ⋯ button that floats over the card's top-right corner.
    paddingRight: 28,
  },
  tags: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: BrandColors.inputField,
  },
  tagActive: {
    backgroundColor: BrandColors.base50,
  },
  tagText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 10,
    color: BrandColors.secondary,
  },
  tagTextActive: {
    color: BrandColors.onBrand,
  },
  name: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 16,
    color: BrandColors.heading,
  },
  whenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 0,
  },
  when: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 12,
    color: BrandColors.secondary,
    flexShrink: 0,
  },
  dot: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: BrandColors.secondary,
  },
  date: {
    flexShrink: 1,
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: BrandColors.secondary,
  },
  more: {
    position: 'absolute',
    top: Spacing.three,
    right: Spacing.three,
    padding: 2,
  },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingTop: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: BrandColors.border,
  },
  money: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  spent: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    color: BrandColors.primary,
  },
  standingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  standing: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
  },
  placeholder: {
    height: 14,
    width: '55%',
    borderRadius: 7,
    backgroundColor: BrandColors.inputField,
  },
}));
