import BottomSheet from '@/components/ui/bottom-sheet';
import ConfirmSheet from '@/components/ui/confirm-sheet';
import { TextfieldLeftIcon } from '@/components/ui/text-input-field';
import EmptyState from '@/components/ui/empty-state';
import ErrorState from '@/components/ui/error-state';
import ListSkeleton from '@/components/ui/list-skeleton';
import PrimaryButton from '@/components/Button/primary-button';
import NavBar from '@/components/Navbar/Nav';
import MemberFaces from '@/components/ui/member-faces';
import PageHeader from '@/components/ui/page-header';
import { TripIconBadge } from '@/components/ui/trip-icon';
import { BrandColors, Spacing } from '@/constants/theme';
import { useActiveTrip } from '@/hooks/use-active-trip';
import { useAuth } from '@/services/Firebase/useAuth';
import {
  fetchArchivedTrips,
  loadTripSummaries,
  setTripArchived,
} from '@/services/Firebase/tripListService';
import { leaveTrip } from '@/services/Firebase/tripService';
import { fetchDelivery, setTripMuted } from '@/services/notifications/inbox';
import { Trip } from '@/types/trips';
import { shortName } from '@/utils/format';
import { formatDay, todayKey } from '@/utils/money';
import {
  TripFilter,
  TripSort,
  TripSummary,
  filterTrips,
  pinActiveTrip,
  sortTrips,
  tripIsOver,
  tripStatus,
} from '@/utils/tripList';
import { useRouter } from 'expo-router';
import {
  Archive,
  ArrowUpDown,
  Bell,
  BellOff,
  Check,
  LogOut,
  MoreHorizontal,
  Search,
  Star,
  StarOff,
  Ticket,
  Users,
} from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

/**
 * When the trip was made, as "Aug 14 2025 - 2:35 PM".
 * Days are padded to two digits so a column of these lines up neatly.
 */
function formatTripDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours();
  // Midnight and noon are both 12 in a 12-hour clock, not 0.
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const suffix = hours < 12 ? 'AM' : 'PM';

  return `${month} ${day} ${year} - ${hour12}:${minutes} ${suffix}`;
}

const STATUS_LABEL = { upcoming: 'Upcoming', ongoing: 'Ongoing', past: 'Finished' } as const;

/** The filter chips above the list, in the order they are shown. */
const CHIPS: { value: TripFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
  { value: 'created', label: 'Created' },
  { value: 'joined', label: 'Joined' },
];

const SORTS = [
  { value: 'recent', label: 'Recent' },
  { value: 'date', label: 'Trip date' },
  { value: 'newest', label: 'Newest' },
  { value: 'name', label: 'Name' },
  { value: 'spent', label: 'Most spent' },
];

/** The trip's own dates when it has them, otherwise when it was made. */
function tripDates(trip: Trip) {
  if (!trip.startDate) return formatTripDate(trip.createdAt);
  return trip.endDate && trip.endDate !== trip.startDate
    ? formatDay(trip.startDate) + ' – ' + formatDay(trip.endDate)
    : formatDay(trip.startDate);
}

export default function TripsScreen() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const uid = currentUser?.uid ?? '';

  // The same hook the dashboard uses, so "active" here is exactly the trip the
  // dashboard and the quick actions work on.
  const { trips, activeTrip, loading, error, selectTrip, clearTrip, reload } = useActiveTrip(uid);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<TripFilter>('all');
  const [sort, setSort] = useState<TripSort>('recent');
  const [summaries, setSummaries] = useState<Record<string, TripSummary>>({});
  const [archived, setArchived] = useState<Record<string, boolean>>({});
  const [muted, setMuted] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [menuTrip, setMenuTrip] = useState<Trip | null>(null);
  const [leaveTarget, setLeaveTarget] = useState<Trip | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState('');

  // Status and the settled badge need a look inside each trip, so they fill in
  // after the list itself has appeared.
  useEffect(() => {
    if (!uid || trips.length === 0) return;
    let active = true;
    loadTripSummaries(trips).then((result) => active && setSummaries(result));
    fetchArchivedTrips(uid)
      .then((result) => active && setArchived(result))
      .catch((err) => console.warn('Could not load archived trips:', err));
    fetchDelivery(uid)
      .then((result) => active && setMuted(result.mutedTrips))
      .catch((err) => console.warn('Could not load muted trips:', err));
    return () => {
      active = false;
    };
  }, [uid, trips]);

  const today = todayKey();
  const activeId = activeTrip?.id ?? '';
  const visible = useMemo(
    () =>
      // The active trip is pinned to the top, above whatever the sort chose.
      pinActiveTrip(
        sortTrips(
          filterTrips(trips, { filter, query, archived, summaries, today, uid }),
          sort,
          summaries,
        ),
        activeId,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trips, filter, query, archived, summaries, sort, activeId],
  );
  const archivedCount = trips.filter((trip) => archived[trip.id]).length;

  const onRefresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  const toggleArchive = (trip: Trip) => {
    const next = !archived[trip.id];
    setArchived((prev) => ({ ...prev, [trip.id]: next }));
    setTripArchived(uid, trip.id, next).catch((err) => {
      console.warn('Could not archive the trip:', err);
      setArchived((prev) => ({ ...prev, [trip.id]: !next }));
    });
  };

  const toggleMute = (trip: Trip) => {
    const next = !muted[trip.id];
    setMuted((prev) => ({ ...prev, [trip.id]: next }));
    setTripMuted(uid, trip.id, next).catch((err) => {
      console.warn('Could not change the mute setting:', err);
      setMuted((prev) => ({ ...prev, [trip.id]: !next }));
    });
  };

  const confirmLeave = async () => {
    if (!leaveTarget || leaving) return;
    setLeaving(true);
    setLeaveError('');
    try {
      await leaveTrip(leaveTarget.id, uid);
      setLeaveTarget(null);
      reload();
    } catch (err: any) {
      console.error('Failed to leave trip:', err);
      setLeaveError(err?.message || 'Could not leave this trip. Please try again.');
    } finally {
      setLeaving(false);
    }
  };

  /**
   * Members as a list, owner first, then whoever joined earliest.
   * The database hands them back as an unordered map, so without this sort the
   * faces would shuffle around between visits.
   */
  const memberList = (trip: Trip) =>
    Object.values(trip.members ?? {}).sort((a, b) => {
      if (a.role === 'owner' && b.role !== 'owner') return -1;
      if (b.role === 'owner' && a.role !== 'owner') return 1;
      return (a.joinedAt ?? '').localeCompare(b.joinedAt ?? '');
    });

  const menuActions = menuTrip
    ? [
        // A finished trip is not offered as the dashboard trip: that card is
        // for money you are still splitting.
        ...(menuTrip.id !== activeTrip?.id && !tripIsOver(menuTrip, today)
          ? [
              {
                key: 'dash',
                label: 'Show on dashboard',
                icon: Star,
                run: () => selectTrip(menuTrip.id),
              },
            ]
          : []),
        // The way out for a trip that is still months away: the dashboard can
        // be left empty, and that answer is remembered across reloads.
        ...(menuTrip.id === activeTrip?.id
          ? [
              {
                key: 'undash',
                label: 'Remove from dashboard',
                icon: StarOff,
                run: () => clearTrip(),
              },
            ]
          : []),
        {
          key: 'mute',
          label: muted[menuTrip.id] ? 'Unmute notifications' : 'Mute notifications',
          icon: muted[menuTrip.id] ? Bell : BellOff,
          run: () => toggleMute(menuTrip),
        },
        {
          key: 'archive',
          label: archived[menuTrip.id] ? 'Unarchive' : 'Archive',
          icon: Archive,
          run: () => toggleArchive(menuTrip),
        },
        {
          key: 'leave',
          label: 'Leave trip',
          icon: LogOut,
          danger: true,
          run: () => {
            setLeaveError('');
            setLeaveTarget(menuTrip);
          },
        },
      ]
    : [];

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.container}>
          <PageHeader title="Trips" />

          <View style={styles.actions}>
            <View style={styles.createWrap}>
              <PrimaryButton
                title="Create a trip"
                onPress={() => router.push('/trips/create' as any)}
                buttonColor={BrandColors.base50}
                textColor={BrandColors.primary}
                borderColor={BrandColors.base50}
                borderWidth={0}
              />
            </View>
            <Pressable style={styles.joinButton} onPress={() => router.push('/trips/join' as any)}>
              <Ticket size={16} color={BrandColors.info} />
              <Text style={styles.joinText}>Join</Text>
            </Pressable>
          </View>

          {trips.length > 0 && (
            <View style={styles.chipRow}>
              {CHIPS.map((chip) => {
                const isOn = chip.value === filter;
                return (
                  <Pressable
                    key={chip.value}
                    style={[styles.chip, isOn && styles.chipOn]}
                    onPress={() => setFilter(chip.value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isOn }}
                  >
                    <Text style={[styles.chipText, isOn && styles.chipTextOn]} numberOfLines={1}>
                      {chip.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {trips.length > 1 && (
            <View style={styles.controls}>
              <TextfieldLeftIcon
                title=""
                placeholder="Search trips"
                value={query}
                onChangeText={setQuery}
                leftIcon={Search}
              />
              <View style={styles.sortRow}>
                {archivedCount > 0 && (
                  <Pressable
                    style={styles.sortButton}
                    hitSlop={8}
                    onPress={() => setFilter(filter === 'archived' ? 'all' : 'archived')}
                    accessibilityRole="button"
                  >
                    <Archive size={14} color={BrandColors.secondary} />
                    <Text style={styles.controlLabel}>
                      {filter === 'archived' ? 'Back to trips' : 'Archived (' + archivedCount + ')'}
                    </Text>
                  </Pressable>
                )}
                <Pressable
                  style={[styles.sortButton, styles.sortRight]}
                  hitSlop={8}
                  onPress={() => {
                    const at = SORTS.findIndex((option) => option.value === sort);
                    setSort(SORTS[(at + 1) % SORTS.length].value as TripSort);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Change sort order"
                >
                  <ArrowUpDown size={14} color={BrandColors.secondary} />
                  <Text style={styles.controlLabel}>
                    Sort: {SORTS.find((option) => option.value === sort)?.label}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {loading ? (
            <ListSkeleton rows={3} rowHeight={96} />
          ) : error ? (
            <ErrorState message={error} />
          ) : trips.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No trips yet"
              message="Create a trip for your next getaway, then invite friends to split expenses with you."
            />
          ) : visible.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No trips found"
              message={
                filter === 'created'
                  ? 'You have not created a trip yet.'
                  : filter === 'joined'
                    ? 'You have not joined anyone else\u2019s trip yet.'
                    : filter === 'past'
                      ? 'No trips have finished yet.'
                      : filter === 'upcoming'
                        ? 'No trips are coming up yet.'
                        : 'Nothing matches your search and filter. Try a different one.'
              }
            />
          ) : (
            <View style={styles.tripList}>
              {visible.map((trip) => {
                const isActive = trip.id === activeTrip?.id;
                const members = memberList(trip);
                const summary = summaries[trip.id];
                const status = tripStatus(trip, today);

                return (
                  <Pressable
                    key={trip.id}
                    style={({ pressed }) => [
                      styles.tripCard,
                      isActive && styles.tripCardActive,
                      pressed && styles.tripCardPressed,
                    ]}
                    onPress={() => router.push(`/trips/${trip.id}` as any)}
                    onLongPress={() => setMenuTrip(trip)}
                  >
                    {/* Left group: icon, name, when it started. Right group:
                        the actions and the faces. */}
                    <View style={styles.tripRow}>
                      <TripIconBadge name={trip.icon} colorKey={trip.iconColor} size={38} />

                      <View style={styles.tripInfo}>
                        <Text style={styles.tripName} numberOfLines={1}>
                          {shortName(trip.name)}
                        </Text>
                        <View style={styles.badgeRow}>
                          {isActive && (
                            <View style={styles.activeBadge}>
                              <Check size={11} color={BrandColors.primary} strokeWidth={3} />
                              <Text style={styles.activeBadgeText}>Active</Text>
                            </View>
                          )}
                          {summary?.settled && (
                            <View style={[styles.badge, styles.settledBadge]}>
                              <Text style={[styles.badgeText, { color: BrandColors.success }]}>
                                Settled up
                              </Text>
                            </View>
                          )}
                          {!!status && (
                            <View
                              style={[styles.badge, status === 'ongoing' && styles.ongoingBadge]}
                            >
                              <Text
                                style={[
                                  styles.badgeText,
                                  status === 'ongoing' && styles.ongoingBadgeText,
                                ]}
                              >
                                {STATUS_LABEL[status]}
                              </Text>
                            </View>
                          )}
                          {!!archived[trip.id] && (
                            <View style={styles.badge}>
                              <Text style={styles.badgeText}>Archived</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.tripDate} numberOfLines={1}>
                          {tripDates(trip)}
                        </Text>
                      </View>

                      <View style={styles.tripSide}>
                        <View style={styles.iconRow}>
                          {!isActive && !tripIsOver(trip, today) && (
                            <Pressable
                              hitSlop={8}
                              onPress={() => selectTrip(trip.id)}
                              accessibilityRole="button"
                              accessibilityLabel={'Show ' + trip.name + ' on the dashboard'}
                            >
                              <Star size={18} color={BrandColors.secondary} />
                            </Pressable>
                          )}
                          <Pressable
                            hitSlop={8}
                            onPress={() => setMenuTrip(trip)}
                            accessibilityRole="button"
                            accessibilityLabel={'More actions for ' + trip.name}
                          >
                            <MoreHorizontal size={18} color={BrandColors.secondary} />
                          </Pressable>
                        </View>
                        <MemberFaces
                          members={members}
                          size={24}
                          ringColor={BrandColors.background}
                        />
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
      <NavBar />

      <BottomSheet
        visible={!!menuTrip}
        title={menuTrip?.name ?? ''}
        onClose={() => setMenuTrip(null)}
      >
        <View style={styles.menu}>
          {menuActions.map((action) => (
            <Pressable
              key={action.key}
              style={styles.menuRow}
              onPress={() => {
                setMenuTrip(null);
                action.run();
              }}
            >
              <action.icon
                size={20}
                color={
                  'danger' in action && action.danger ? BrandColors.error : BrandColors.primary
                }
              />
              <Text
                style={[
                  styles.menuText,
                  'danger' in action && action.danger && { color: BrandColors.error },
                ]}
              >
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </BottomSheet>

      <ConfirmSheet
        visible={!!leaveTarget}
        icon="leave"
        title="Leave this trip?"
        message="You will be removed from this trip and will no longer see its expenses. If you own it, the person who joined first becomes the owner."
        confirmLabel="Leave trip"
        cancelLabel="Stay"
        busy={leaving}
        onConfirm={confirmLeave}
        onCancel={() => {
          if (!leaving) setLeaveTarget(null);
        }}
      >
        {!!leaveError && <Text style={styles.leaveError}>{leaveError}</Text>}
      </ConfirmSheet>
    </>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    // flexGrow lets the white panel fill the screen even when the list is
    // short, so the grey page never shows below the content.
    flexGrow: 1,
    backgroundColor: BrandColors.background,
    paddingBottom: 100,
  },
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    backgroundColor: BrandColors.background,
    paddingTop: 40,
    paddingHorizontal: 25,
    gap: Spacing.three,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Spacing.two,
  },
  createWrap: {
    flex: 1,
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  joinText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    lineHeight: 18,
    includeFontPadding: false,
    color: BrandColors.info,
  },
  controls: {
    gap: Spacing.two,
  },
  chipRow: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  chip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.two,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  chipOn: {
    backgroundColor: BrandColors.base200,
    borderColor: BrandColors.base200,
  },
  chipText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 11,
    color: BrandColors.secondary,
  },
  chipTextOn: {
    color: BrandColors.primary,
    fontFamily: 'PlusJakartaSans-Bold',
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sortRight: {
    marginLeft: 'auto',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  controlLabel: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: BrandColors.secondary,
  },
  tripSide: {
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.one,
  },
  badge: {
    // A grey pill, not the near-white surfaceAlt it used to be: that sat on a
    // white card and read as nothing at all.
    backgroundColor: BrandColors.inputField,
    borderRadius: 20,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  // Ongoing is the status worth spotting at a glance, so it wears the theme's
  // info blue instead of the neutral grey - and blue never collides with the
  // amber "Active" chip that sits right beside it.
  ongoingBadge: {
    backgroundColor: BrandColors.infoBg,
  },
  ongoingBadgeText: {
    color: BrandColors.info,
  },
  settledBadge: {
    backgroundColor: '#E6F6EC',
  },
  badgeText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 10,
    letterSpacing: 0.3,
    color: BrandColors.secondary,
  },
  menu: {
    gap: Spacing.one,
    paddingBottom: Spacing.three,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  menuText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 15,
    color: BrandColors.primary,
  },
  leaveError: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13,
    color: BrandColors.error,
    textAlign: 'center',
  },
  tripList: {
    gap: Spacing.three,
  },
  tripCard: {
    backgroundColor: BrandColors.background,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 15,
    padding: Spacing.three,
  },
  tripCardActive: {
    borderWidth: 1,
    borderColor: BrandColors.base200,
    backgroundColor: BrandColors.base200,
  },
  tripCardPressed: {
    opacity: 0.75,
  },
  tripRow: {
    flexDirection: 'row',
    // Centres the icon, the text block and the faces on one line.
    alignItems: 'center',
    gap: Spacing.three,
  },
  tripInfo: {
    flex: 1,
    gap: 2,
  },
  tripName: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 16,
    color: BrandColors.primary,
    flexShrink: 1,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: BrandColors.base50,
    borderRadius: 20,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  activeBadgeText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 10,
    letterSpacing: 0.3,
    color: BrandColors.primary,
  },
  tripDate: {
    // The light weight keeps the date quiet, so the trip name stays the
    // thing your eye lands on first.
    fontFamily: 'PlusJakartaSans-Light',
    fontSize: 11,
    lineHeight: 14,
    includeFontPadding: false,
    color: BrandColors.secondary,
  },
});
