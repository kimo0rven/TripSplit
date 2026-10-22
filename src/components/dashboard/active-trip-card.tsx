import MemberFaces from '@/components/ui/member-faces';
import { TripIconBadge } from '@/components/ui/trip-icon';
import { BrandColors, Spacing } from '@/constants/theme';
import { Trip, TripMember } from '@/types/trips';
import { formatDay } from '@/utils/money';
import { ChevronRight, QrCode } from 'lucide-react-native';
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
  /** True when that trip's last date has passed. */
  isOver?: boolean;
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
  isOver,
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

  return (
    <>
      <Pressable
        style={styles.card}
        onPress={activeTrip ? onOpen : onManageTrips}
        accessibilityRole="button"
        accessibilityLabel={activeTrip ? `Open ${activeTrip.name}` : 'Create a trip'}
      >
        <View style={styles.cardLeft}>
          {/* The badge carries its own colour, so the trip looks the same here
              as it does on the trips list. */}
          <TripIconBadge name={activeTrip?.icon} colorKey={activeTrip?.iconColor} size={40} />
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {activeTrip ? activeTrip.name : 'No trip yet'}
            </Text>
            <View style={styles.cardMetaRow}>
              {members.length > 0 && activeTrip ? (
                <MemberFaces members={members} max={3} size={22} ringColor={BrandColors.base50} />
              ) : null}
              <Text style={styles.cardHint} numberOfLines={1}>
                {activeTrip
                  ? tripDate
                    ? isOver
                      ? `${tripDate} · finished`
                      : tripDate
                    : isOver
                      ? 'Trip finished'
                      : activeTrip.currency
                  : 'Create a trip to start splitting'}
              </Text>
            </View>
          </View>
        </View>
        {/* Its own button, so tapping the QR does not also open the trip. Only
            shown when there is a code to share. */}
        {onShowQr && !!activeTrip?.inviteCode && (
          <Pressable
            style={({ pressed }) => [styles.qrButton, pressed && styles.qrPressed]}
            onPress={onShowQr}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Show ${activeTrip.name}'s invite code and QR code`}
          >
            <QrCode size={17} color={BrandColors.primary} />
          </Pressable>
        )}

        <ChevronRight size={18} color={BrandColors.secondary} />
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
  cardTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 16,
    color: BrandColors.primary,
  },
  cardHint: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    color: BrandColors.primary,
    flexShrink: 1,
  },
  qrButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BrandColors.base200,
  },
  qrPressed: {
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
