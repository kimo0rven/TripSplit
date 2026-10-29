import Avatar from '@/components/ui/avatar';
import { BrandColors, Spacing } from '@/constants/theme';
import { ItineraryItem } from '@/types/expenses';
import { TripMember } from '@/types/trips';
import { formatDay, formatTime } from '@/utils/money';
import { mapUrlFor, planTiming, runningFor, startsIn } from '@/utils/itinerary';
import { ArrowRight, Clock, MapPin, Navigation } from 'lucide-react-native';
import * as Linking from 'expo-linking';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface NextPlanCardProps {
  item: ItineraryItem;
  members: TripMember[];
  onOpen: () => void;
}

/** How many faces fit before the rest become a count. */
const MAX_FACES = 4;

/**
 * The plan someone opening the tab actually wants: the next one, or the one
 * running right now.
 *
 * The list below already holds every plan in order; this is a shortcut past
 * the reading, on the day itself when what matters is "what is next".
 */
export default function NextPlanCard({ item, members, onOpen }: NextPlanCardProps) {
  const timing = planTiming(item);
  const when =
    timing.state === 'now'
      ? runningFor(timing.endsInMinutes)
      : timing.state === 'past'
        ? 'Finished'
        : startsIn(timing.startsInMinutes);
  const running = timing.state === 'now';

  // No attendee list means the whole trip is coming.
  const coming = item.attendeeIds?.length
    ? members.filter((member) => item.attendeeIds?.includes(member.id))
    : members;
  const faces = coming.slice(0, MAX_FACES);
  const extra = coming.length - faces.length;

  const places = mapUrlFor(item.location || '');

  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      accessibilityRole="button"
      accessibilityLabel={`${running ? 'Happening now' : 'Next'}: ${item.title}, ${when}`}
    >
      <View style={styles.tagRow}>
        <View style={[styles.tag, running && styles.tagNow]}>
          <Text style={[styles.tagText, running && styles.tagTextNow]}>
            {running ? 'HAPPENING NOW' : 'NEXT'}
          </Text>
        </View>
        <Text style={styles.when}>{when}</Text>
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {item.title}
      </Text>

      <View style={styles.metaRow}>
        <Clock size={12} color={BrandColors.secondary} />
        <Text style={styles.metaText}>
          {formatDay(item.day)}
          {item.time ? ` · ${formatTime(item.time)}` : ''}
          {item.endTime ? ` – ${formatTime(item.endTime)}` : ''}
        </Text>
      </View>

      {!!item.location && (
        <View style={styles.placeRow}>
          <View style={styles.placeLeft}>
            <MapPin size={12} color={BrandColors.secondary} />
            <Text style={styles.metaText} numberOfLines={1}>
              {item.location}
            </Text>
          </View>
          {!!places && (
            // The card itself opens the plan, so the map is its own control.
            <Pressable
              onPress={(event) => {
                event.stopPropagation();
                Linking.openURL(places).catch(() => {});
              }}
              hitSlop={8}
              style={styles.mapButton}
              accessibilityRole="button"
              accessibilityLabel={`Open ${item.location} in a map`}
            >
              <Navigation size={12} color={BrandColors.info} />
              <Text style={styles.mapText}>Map</Text>
            </Pressable>
          )}
        </View>
      )}

      <View style={styles.footer}>
        <View style={styles.faces}>
          {faces.map((member, index) => (
            <View key={member.id} style={[styles.faceRing, index > 0 && styles.faceOverlap]}>
              <Avatar name={member.fullname} size={22} photoURL={member.photoURL} />
            </View>
          ))}
          {extra > 0 && <Text style={styles.extra}>+{extra}</Text>}
        </View>
        <View style={styles.openRow}>
          <Text style={styles.openText}>Open plan</Text>
          <ArrowRight size={13} color={BrandColors.primary} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: 16,
    backgroundColor: BrandColors.background,
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  cardPressed: {
    backgroundColor: BrandColors.surfaceAlt,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: BrandColors.base200,
  },
  tagNow: {
    backgroundColor: BrandColors.successBg,
  },
  tagText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 10,
    letterSpacing: 0.5,
    color: BrandColors.primary,
  },
  tagTextNow: {
    color: BrandColors.success,
  },
  when: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 11,
    color: BrandColors.secondary,
  },
  title: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 16,
    color: BrandColors.primary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  placeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    flex: 1,
  },
  metaText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: BrandColors.secondary,
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: 8,
    backgroundColor: BrandColors.infoBg,
  },
  mapText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 11,
    color: BrandColors.info,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.one,
  },
  faces: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  faceRing: {
    borderRadius: 13,
    borderWidth: 2,
    borderColor: BrandColors.background,
  },
  faceOverlap: {
    marginLeft: -8,
  },
  extra: {
    marginLeft: Spacing.one,
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 11,
    color: BrandColors.secondary,
  },
  openRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  openText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 12,
    color: BrandColors.primary,
  },
});
