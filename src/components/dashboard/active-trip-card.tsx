import MemberFaces from '@/components/ui/member-faces';
import { TripIconBadge } from '@/components/ui/trip-icon';
import { BrandColors, Spacing } from '@/constants/theme';
import { Trip, TripMember } from '@/types/trips';
import { formatDay, todayKey } from '@/utils/money';
import { shortName } from '@/utils/format';
import { tripCountdown } from '@/utils/fun';
import { ChevronRight, Luggage, QrCode } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { themedStyles } from '@/constants/themed-styles';

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

  const qrShown = !!onShowQr && !!activeTrip?.inviteCode;

  const noTrip = !activeTrip;
  const kicker = noTrip
    ? hasTrips
      ? 'No trip on the dashboard'
      : 'Start here'
    : showCountdown
      ? 'Coming up'
      : 'Active trip';
  const when = !activeTrip ? '' : showCountdown && countdown ? countdown.label : (tripDate ?? '');

  return (
    <View style={styles.wrap}>
      <Pressable
        style={({ pressed }) => [
          styles.hero,
          noTrip && styles.heroEmpty,
          pressed && styles.pressed,
        ]}
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
        {/* Two soft circles in the corner, the same as the profile banner. */}
        <View style={[styles.blobBig, noTrip && styles.blobDim]} />
        <View style={[styles.blobSmall, noTrip && styles.blobDim]} />

        <View style={styles.top}>
          {/* The badge carries the trip's own colour, so it looks the same
              here as on the trips list. With no trip a plain chip holds the space. */}
          <View style={[styles.iconRing, noTrip && styles.iconRingEmpty]}>
            {activeTrip ? (
              <TripIconBadge name={activeTrip.icon} colorKey={activeTrip.iconColor} size={44} />
            ) : (
              <View style={styles.emptyBadge}>
                <Luggage size={22} color={BrandColors.disabled} strokeWidth={2} />
              </View>
            )}
          </View>
          <View style={styles.titleBlock}>
            <Text style={[styles.kicker, noTrip && styles.textEmpty]}>{kicker}</Text>
            <Text style={[styles.title, noTrip && styles.titleEmpty]} numberOfLines={1}>
              {activeTrip ? shortName(activeTrip.name) : 'No Trip'}
            </Text>
          </View>
          {/* Room for the QR button, which floats above the card. */}
          {qrShown && <View style={styles.actionSpace} />}
        </View>

        <View style={[styles.strip, noTrip && styles.stripEmpty]}>
          {activeTrip ? (
            <>
              {!!when && (
                <View style={styles.whenPill}>
                  <Text style={styles.whenText} numberOfLines={1}>
                    {when}
                  </Text>
                </View>
              )}
              <View style={styles.stripFill}>
                {members.length > 0 ? (
                  <MemberFaces members={members} max={4} size={24} ringColor={BrandColors.base50} />
                ) : (
                  <Text style={styles.stripText}>{activeTrip.currency}</Text>
                )}
              </View>
              <Text style={styles.openText}>Open</Text>
              <ChevronRight size={16} color={BrandColors.onBrand} />
            </>
          ) : (
            <>
              <Text
                style={[styles.stripText, styles.textEmpty, styles.stripFill]}
                numberOfLines={1}
              >
                {emptyHint}
              </Text>
              <ChevronRight size={16} color={BrandColors.disabled} />
            </>
          )}
        </View>
      </Pressable>

      {/* Its own button beside the card, not inside it, so tapping it does not
          also open the trip (and the web does not get a button in a button). */}
      {qrShown && (
        <Pressable
          style={({ pressed }) => [styles.qrButton, pressed && styles.pressed]}
          onPress={onShowQr}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Show ${activeTrip!.name}'s invite code and QR code`}
        >
          <QrCode size={18} color={BrandColors.onBrand} />
        </Pressable>
      )}
    </View>
  );
}

const styles = themedStyles(() => ({
  wrap: { position: 'relative' },
  pressed: { opacity: 0.85 },
  hero: {
    backgroundColor: BrandColors.base50,
    borderRadius: 24,
    padding: Spacing.four,
    gap: Spacing.three,
    overflow: 'hidden',
  },
  /* No trip yet: a quiet grey card, so an empty dashboard reads as idle. */
  heroEmpty: { backgroundColor: BrandColors.inputField },
  blobBig: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    right: -55,
    top: -75,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  blobSmall: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    right: 70,
    bottom: -40,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  blobDim: { backgroundColor: 'rgba(255,255,255,0.05)' },
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  iconRing: { padding: 3, borderRadius: 16, backgroundColor: '#FFFFFF' },
  iconRingEmpty: { backgroundColor: BrandColors.border },
  emptyBadge: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BrandColors.background,
  },
  titleBlock: { flex: 1, gap: 1 },
  kicker: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: BrandColors.onBrand,
    opacity: 0.7,
  },
  title: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 22,
    color: BrandColors.onBrand,
  },
  titleEmpty: { color: BrandColors.primary },
  textEmpty: { color: BrandColors.secondary, opacity: 1 },
  actionSpace: { width: 36, height: 36 },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    minHeight: 44,
  },
  stripEmpty: { backgroundColor: BrandColors.background },
  stripFill: { flex: 1 },
  whenPill: {
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    flexShrink: 1,
  },
  whenText: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 11, color: BrandColors.onBrand },
  stripText: { fontFamily: 'PlusJakartaSans-Medium', fontSize: 12, color: BrandColors.onBrand },
  openText: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 12, color: BrandColors.onBrand },
  qrButton: {
    position: 'absolute',
    top: Spacing.four + 6,
    right: Spacing.four,
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.55)',
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
}));
