import BottomSheet from '@/components/ui/bottom-sheet';
import MemberFaces from '@/components/ui/member-faces';
import NextPlanCard from '@/components/trip/next-plan-card';
import { Card, SectionTitle } from '@/components/ui/card';
import EmptyState from '@/components/ui/empty-state';
import { BrandColors, Spacing } from '@/constants/theme';
import { groupByDay } from '@/services/Firebase/itineraryService';
import { ItineraryItem } from '@/types/expenses';
import { TripMember } from '@/types/trips';
import { mapUrlFor, nextPlan, planTiming } from '@/utils/itinerary';
import { formatDay, formatTime } from '@/utils/money';
import {
  CalendarDays,
  Clock,
  History,
  MapPin,
  Navigation,
  Pencil,
  Trash2,
  Users,
} from 'lucide-react-native';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

/** Where the dot's centre sits, measured from the top of a row. */
const DOT_CENTRE = 25;
const DOT_SIZE = 9;

interface ItineraryTabProps {
  items: ItineraryItem[];
  currentUserId: string;
  onDelete: (item: ItineraryItem) => void;
  /** Set for the trip owner, who may change anyone's plan. */
  isOwner?: boolean;
  onEdit?: (item: ItineraryItem) => void;
  /** Everyone in the trip, so a plan can show who is coming. */
  members?: TripMember[];
}

export default function ItineraryTab({
  items,
  currentUserId,
  onDelete,
  isOwner = false,
  onEdit,
  members = [],
}: ItineraryTabProps) {
  const router = useRouter();
  const groups = groupByDay(items);
  // Anyone in the trip may change a plan, the same way anyone may delete one:
  // the itinerary is shared, so whoever notices a wrong time can fix it.
  const canEdit = !!onEdit;
  const canDelete = (item: ItineraryItem) =>
    isOwner || (item.createdBy === currentUserId && !!onDelete);
  const [openId, setOpenId] = useState<string | null>(null);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const open = items.find((item) => item.id === openId) ?? null;

  // The soonest plan still ahead, shown above the list. Read once per render
  // rather than on a timer: coming back to the tab re-reads the clock, which
  // is when it actually matters.
  const upcoming = nextPlan(items);
  const now = new Date();

  return (
    <View style={styles.wrap}>
      {!!upcoming && (
        <NextPlanCard item={upcoming} members={members} onOpen={() => setOpenId(upcoming.id)} />
      )}

      <SectionTitle>Shared itinerary</SectionTitle>

      {groups.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No plans yet"
          message="Tap the + button to add the first stop of the trip. Everyone in the trip sees the same plan."
        />
      ) : (
        <View style={styles.groups}>
          {groups.map((group) => (
            <View key={group.day} style={styles.group}>
              <View style={styles.dayHeader}>
                <Text style={styles.dayLabel}>{formatDay(group.day)}</Text>
              </View>

              <View style={styles.timeline}>
                {group.items.map((item, index) => (
                  <View key={item.id} style={styles.itemRow}>
                    {/* Two segments, both anchored to the dot's centre: the one
                        above reaches the previous dot and the one below reaches
                        the next, so the line never breaks between two stops. */}
                    <View style={styles.timelineColumn}>
                      {index > 0 && <View style={styles.lineUp} />}
                      {index < group.items.length - 1 && <View style={styles.lineDown} />}
                      <View
                        style={[
                          styles.dot,
                          planTiming(item, now).state === 'past' && styles.dotPast,
                        ]}
                      />
                    </View>

                    <Pressable
                      style={[
                        styles.itemPress,
                        planTiming(item, now).state === 'past' && styles.done,
                      ]}
                      onPress={() => setOpenId(item.id)}
                      accessibilityRole="button"
                    >
                      <Card style={styles.itemCard}>
                        <View style={styles.itemTop}>
                          <Text style={styles.itemTitle} numberOfLines={2}>
                            {item.title}
                          </Text>
                          {canDelete(item) && (
                            <Pressable onPress={() => onDelete(item)} hitSlop={8}>
                              <Trash2 size={14} color={BrandColors.secondary} />
                            </Pressable>
                          )}
                        </View>

                        <View style={styles.metaRow}>
                          {!!item.time && (
                            <View style={styles.metaChip}>
                              <Clock size={11} color={BrandColors.secondary} />
                              <Text style={styles.metaText}>
                                {formatTime(item.time)}
                                {item.endTime ? ` – ${formatTime(item.endTime)}` : ''}
                              </Text>
                            </View>
                          )}
                          {!!item.location && (
                            <Pressable
                              style={styles.metaChip}
                              onPress={(event) => {
                                // The row itself opens the plan, so the map is
                                // its own tap target.
                                event.stopPropagation();
                                const url = mapUrlFor(item.location || '');
                                if (url) Linking.openURL(url).catch(() => {});
                              }}
                              hitSlop={6}
                              accessibilityRole="button"
                              accessibilityLabel={`Open ${item.location} in a map`}
                            >
                              <MapPin size={11} color={BrandColors.secondary} />
                              <Text style={styles.metaLink} numberOfLines={1}>
                                {item.location}
                              </Text>
                            </Pressable>
                          )}
                        </View>

                        {!!item.notes && <Text style={styles.notes}>{item.notes}</Text>}

                        {/* Faces only when a plan is for some of the trip rather
                            than all of it - an untagged plan is everyone, and
                            showing everyone on every row says nothing. */}
                        {!!item.attendeeIds?.length && members.length > 0 && (
                          <View style={styles.attendees}>
                            <MemberFaces
                              members={members.filter((member) =>
                                item.attendeeIds?.includes(member.id),
                              )}
                              size={20}
                              max={4}
                            />
                          </View>
                        )}
                      </Card>
                    </Pressable>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      )}
      <BottomSheet visible={!!open} title="Plan details" onClose={() => setOpenId(null)}>
        {open && (
          <ScrollView
            contentContainerStyle={styles.detailBody}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.detailTitle}>{open.title}</Text>

            <Card style={styles.detailCard}>
              <View style={styles.detailRow}>
                <CalendarDays size={15} color={BrandColors.secondary} />
                <Text style={styles.detailText}>{formatDay(open.day)}</Text>
              </View>
              {!!open.time && (
                <View style={styles.detailRow}>
                  <Clock size={15} color={BrandColors.secondary} />
                  <Text style={styles.detailText}>
                    {formatTime(open.time)}
                    {open.endTime ? ` – ${formatTime(open.endTime)}` : ''}
                  </Text>
                </View>
              )}
              {!!open.location && (
                <View style={styles.detailRow}>
                  <MapPin size={15} color={BrandColors.secondary} />
                  <Text style={styles.detailText}>{open.location}</Text>
                  {!!mapUrlFor(open.location) && (
                    <Pressable
                      onPress={() =>
                        Linking.openURL(mapUrlFor(open.location || '')).catch(() => {})
                      }
                      hitSlop={8}
                      style={styles.mapLink}
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${open.location} in a map`}
                    >
                      <Navigation size={13} color={BrandColors.info} />
                      <Text style={styles.mapLinkText}>Map</Text>
                    </Pressable>
                  )}
                </View>
              )}
              {members.length > 0 && (
                <View style={styles.detailRow}>
                  <Users size={15} color={BrandColors.secondary} />
                  <View style={styles.attendeeBody}>
                    <MemberFaces
                      members={
                        open.attendeeIds?.length
                          ? members.filter((member) => open.attendeeIds?.includes(member.id))
                          : members
                      }
                      size={24}
                      max={5}
                    />
                    <Text style={styles.detailText}>
                      {open.attendeeIds?.length
                        ? `${open.attendeeIds.length} coming`
                        : 'Everyone is coming'}
                    </Text>
                  </View>
                </View>
              )}
            </Card>

            {!!open.notes && (
              <>
                <Text style={styles.detailLabel}>Description</Text>
                <Text style={styles.detailNotes}>{open.notes}</Text>
              </>
            )}

            {!!open.photoUrls?.length && (
              <>
                <Text style={styles.detailLabel}>Photos</Text>
                <View style={styles.photoGrid}>
                  {open.photoUrls.map((url) => (
                    <Pressable key={url} onPress={() => setViewerUri(url)}>
                      <Image source={{ uri: url }} style={styles.gridPhoto} contentFit="cover" />
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            {/* Every edit to a plan is logged, so a plan that changed twice
                keeps a readable trail on its own page. */}
            {!!open.history?.length && (
              <Pressable
                style={styles.logLink}
                onPress={() =>
                  router.push({
                    pathname: '/edit-log',
                    params: {
                      title: open.title,
                      subtitle: formatDay(open.day),
                      history: JSON.stringify(open.history),
                    },
                  } as any)
                }
                accessibilityRole="link"
                accessibilityLabel="Open the edit log"
              >
                <History size={15} color={BrandColors.info} />
                <Text style={styles.logLinkText}>
                  Edit log ({open.history.length} {open.history.length === 1 ? 'change' : 'changes'}
                  )
                </Text>
              </Pressable>
            )}

            {canEdit && (
              <Pressable
                style={styles.editButton}
                onPress={() => {
                  setOpenId(null);
                  onEdit(open);
                }}
              >
                <Pencil size={14} color={BrandColors.primary} />
                <Text style={styles.editText}>Edit plan</Text>
              </Pressable>
            )}

            {canDelete(open) && (
              <Pressable
                style={styles.deleteButton}
                onPress={() => {
                  setOpenId(null);
                  onDelete(open);
                }}
              >
                <Trash2 size={14} color={BrandColors.error} />
                <Text style={styles.deleteText}>Delete plan</Text>
              </Pressable>
            )}
          </ScrollView>
        )}
      </BottomSheet>

      <Modal
        visible={!!viewerUri}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerUri(null)}
      >
        <Pressable style={styles.viewer} onPress={() => setViewerUri(null)}>
          {viewerUri && (
            <Image source={{ uri: viewerUri }} style={styles.viewerImage} contentFit="contain" />
          )}
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.three,
  },
  groups: {
    gap: Spacing.four,
  },
  group: {
    gap: Spacing.two,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayLabel: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    color: BrandColors.primary,
  },
  timeline: {
    gap: 0,
  },
  itemRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  timelineColumn: {
    width: 14,
    alignItems: 'center',
    // The dot and both segments are placed from this column's top edge, so a
    // row's height never changes where the line sits.
    position: 'relative',
  },
  dot: {
    position: 'absolute',
    top: DOT_CENTRE - DOT_SIZE / 2,
    // Centred in the 14pt column, so the dot sits in line with the segments.
    left: (14 - DOT_SIZE) / 2,
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: BrandColors.base50,
  },
  lineUp: {
    position: 'absolute',
    top: 0,
    height: DOT_CENTRE,
    left: (14 - 2) / 2,
    width: 2,
    backgroundColor: BrandColors.border,
  },
  lineDown: {
    position: 'absolute',
    top: DOT_CENTRE,
    // Reaches one gap past this row, under the next card's margin, so the line
    // reads as one piece instead of breaking between two stops.
    bottom: -Spacing.two,
    left: (14 - 2) / 2,
    width: 2,
    backgroundColor: BrandColors.border,
  },
  itemPress: {
    flex: 1,
  },
  detailBody: { gap: Spacing.three, paddingBottom: Spacing.four },
  detailTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 20,
    color: BrandColors.primary,
  },
  detailCard: { gap: Spacing.two },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  detailText: {
    flex: 1,
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14,
    color: BrandColors.primary,
  },
  detailLabel: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 13,
    color: BrandColors.secondary,
  },
  detailNotes: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 21,
    color: BrandColors.primary,
  },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  gridPhoto: { width: 100, height: 100, borderRadius: 10, backgroundColor: BrandColors.border },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: 12,
    backgroundColor: BrandColors.base50,
  },
  editText: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: BrandColors.primary },
  logLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  logLinkText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 13,
    color: BrandColors.info,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  deleteText: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: BrandColors.error },
  viewer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerImage: { width: '100%', height: '100%' },
  itemCard: {
    flex: 1,
    marginBottom: Spacing.two,
    gap: Spacing.two,
  },
  itemTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  itemTitle: {
    flex: 1,
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    color: BrandColors.primary,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  attendees: {
    marginTop: Spacing.one,
  },
  done: {
    // A plan whose time has passed stays readable but steps back, so the eye
    // lands on what is still to come.
    opacity: 0.55,
  },
  dotPast: {
    backgroundColor: BrandColors.border,
  },
  mapLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: 8,
    backgroundColor: BrandColors.infoBg,
  },
  mapLinkText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 11,
    color: BrandColors.info,
  },
  attendeeBody: {
    flex: 1,
    gap: Spacing.one,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    maxWidth: '80%',
  },
  metaText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    color: BrandColors.secondary,
  },
  metaLink: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 11,
    color: BrandColors.info,
    textDecorationLine: 'underline',
  },
  notes: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: BrandColors.primary,
    lineHeight: 17,
  },
});
