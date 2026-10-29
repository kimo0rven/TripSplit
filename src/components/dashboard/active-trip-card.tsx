import MemberFaces from '@/components/ui/member-faces';
import { TripIconBadge } from '@/components/ui/trip-icon';
import { BrandColors, Spacing } from '@/constants/theme';
import { Trip, TripMember } from '@/types/trips';
import { formatDay, todayKey } from '@/utils/money';
import { shortName } from '@/utils/format';
import { tripCountdown } from '@/utils/fun';
import { ChevronRight, Luggage, QrCode } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

/**
 * Members as a list, owner first, then whoever joined earliest.
 * The database hands them back as an unordered map, so without this sort the
 * faces would shuffle around between visits.
 */
function sortedMembers(trip: Trip | null): TripMember[] {
  return Object.values(trip?.members ?? {}).sort((a, b) => {
    if (a.role === 'owner' && b.role !== 'owner') return -1;
    if (b.role === 'owner' && a.role !== 'owner') return 1;
    return (a.joinedAt ?? '').localeCompare(b.joinedAt ?? '');
  });
}

interface TripPickerProps {
  /** The trip the dashboard is showing right now, if there is one. */
  activeTrip: Trip | null;
  /**
   * How many trips exist in total. When there are some but none is active, the
   * card says so instead of suggesting a first trip be created.
   */
  tripCount?: number;
  /** Opens the active trip's page. */
  onOpen: () => void;
  /** Opens the trips list, where a new trip can be made. */
  onManageTrips: () => void;
  /** Opens the sheet holding this trip's invite code and QR code. */
  onShowQr?: () => void;
}

/** The card at the top of the dashboard: tap it to open the active trip. */
export function ActiveTripCard({
  activeTrip,
  tripCount = 0,
  onOpen,
  onManageTrips,
  onShowQr,
}: TripPickerProps) {
  const members = sortedMembers(activeTrip);

  /* The trips list and the hero both date a trip with the same helper, so the
     card speaks the same language as the rest of the app. */
  const tripDate = activeTrip?.startDate
    ? formatDay(activeTrip.startDate)
    : activeTrip?.endDate
      ? formatDay(activeTrip.endDate)
      : null;

  /* A trip that has not started yet is really a countdown, not a date. The
     number that matters is how long until it does. */
  const countdown = activeTrip
    ? tripCountdown(activeTrip.startDate, activeTrip.endDate, todayKey())
    : null;
  const showCountdown = !!countdown && countdown.phase === 'soon';

  /* Two different empty cards: nothing made yet, or a trip taken off the
     dashboard on purpose. The second one must not tell the person to create a
     trip they already have. */
  const hasTrips = tripCount > 0;
  const emptyHint = hasTrips ? 'Pick a trip to show it here' : 'Create a trip to start splitting';

  return (
    <>
      <Pressable
        style={[styles.card, !activeTrip && styles.cardNoTrip]}
        onPress={activeTrip ? onOpen : onManageTrips}
        accessibilityRole="button"
        accessibilityLabel={
          activeTrip
            ? `Open ${activeTrip.name}`
            : hasTrips
              ? 'No trip on the dashboard - pick one'
              : 'No trip yet - create one'
        }
      >
        <View style={styles.cardLeft}>
          {/* The badge carries its own colour, so the trip looks the same here
              as it does on the trips list. With no trip there is no colour to
              carry, so a plain dark chip holds the space instead. */}
          {activeTrip ? (
            <TripIconBadge name={activeTrip.icon} colorKey={activeTrip.iconColor} size={40} />
          ) : (
            <View style={styles.emptyBadge}>
              <Luggage size={20} color={BrandColors.disabled} strokeWidth={2} />
            </View>
          )}
          <View style={styles.cardBody}>
            {/* The date sits above the name, not beside the faces. With a big
                group the face row pushed it to a sliver, which made it
                unreadable exactly when the trip was busiest. */}
            {activeTrip && (
              <Text style={styles.cardDate} numberOfLines={1}>
                {showCountdown && countdown
                  ? `${countdown.label} · ${tripDate ?? activeTrip.currency}`
                  : tripDate
                    ? tripDate
                    : activeTrip.currency}
              </Text>
            )}
            <Text
              style={[styles.cardTitle, !activeTrip && styles.cardTitleNoTrip]}
              numberOfLines={1}
            >
              {activeTrip ? shortName(activeTrip.name) : 'No Trip'}
            </Text>
            <View style={styles.cardMetaRow}>
              {members.length > 0 && activeTrip ? (
                <MemberFaces members={members} max={3} size={22} ringColor={BrandColors.base50} />
              ) : (
                <Text
                  style={[styles.cardHint, !activeTrip && styles.cardHintNoTrip]}
                  numberOfLines={1}
                >
                  {emptyHint}
                </Text>
              )}
            </View>
          </View>
        </View>
        {/* Its own button, so tapping it does not also open the trip. */}
        {onShowQr && !!activeTrip?.inviteCode && (
          <Pressable
            style={({ pressed }) => [styles.cardAction, pressed && styles.cardActionPressed]}
            onPress={onShowQr}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Show ${activeTrip.name}'s invite code and QR code`}
          >
            <QrCode size={17} color={BrandColors.primary} />
          </Pressable>
        )}

        <ChevronRight size={18} color={activeTrip ? BrandColors.secondary : BrandColors.disabled} />
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: BrandColors.base50,
    borderRadius: 16,
    padding: Spacing.three,
  },
  /* No trip yet: a dark grey card, so an empty dashboard reads as idle rather
     than looking like a trip is waiting. */
  cardNoTrip: {
    backgroundColor: BrandColors.primary,
  },
  emptyBadge: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    flex: 1,
  },
  cardBody: {
    flex: 1,
    gap: 1,
  },
  cardDate: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 11,
    letterSpacing: 0.2,
    color: BrandColors.secondary,
  },
  cardTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 16,
    color: BrandColors.primary,
  },
  cardTitleNoTrip: {
    color: BrandColors.background,
  },
  cardHint: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    color: BrandColors.primary,
    flexShrink: 1,
  },
  cardHintNoTrip: {
    color: BrandColors.disabled,
  },
  cardAction: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BrandColors.base200,
  },
  cardActionPressed: {
    opacity: 0.6,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: 2,
  },
  list: {
    gap: Spacing.two,
    paddingBottom: Spacing.three,
  },
  empty: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13,
    lineHeight: 20,
    color: BrandColors.secondary,
    paddingVertical: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 14,
    padding: Spacing.two,
  },
  rowOn: {
    borderColor: BrandColors.base50,
    backgroundColor: BrandColors.base200,
  },
  rowBody: {
    flex: 1,
    gap: 1,
  },
  rowTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    color: BrandColors.primary,
  },
  rowMeta: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    color: BrandColors.secondary,
  },
  manageRow: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
  },
  manageText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 13,
    color: BrandColors.info,
  },
});
