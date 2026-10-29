import MemberFaces from '@/components/ui/member-faces';
import { BrandColors, Spacing } from '@/constants/theme';
import { TripMember } from '@/types/trips';
import { formatMoney } from '@/utils/money';
import { ChevronRight, Crown, QrCode } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface TripOverviewProps {
  members: TripMember[];
  isOwner: boolean;
  /** True while the trip is just you: the invite prompt has not done its job yet. */
  showInvite: boolean;
  onOpenMembers: () => void;
  onOpenInvite: () => void;
  /** Net per member, so each face can carry a figure. */
  netByMember?: Record<string, number>;
  currency?: string;
}

/**
 * Who is on the trip, and how the money sits for each of them.
 *
 * This used to be a single line of text - "3 members · you own this trip" -
 * which gave the busiest part of a shared trip almost nothing to look at. Then
 * it grew cards for each person, which took too much room above the expenses.
 *
 * Now it is one compact row: faces first, each person's balance beside them,
 * and the whole thing is about the height of two lines of text. Tapping it opens
 * the full list, which is where the detail already lives.
 */
export default function TripOverview({
  members,
  isOwner,
  showInvite,
  onOpenMembers,
  onOpenInvite,
  netByMember = {},
  currency = 'PHP',
}: TripOverviewProps) {
  // Biggest movement first, so whoever is furthest from even is easy to find.
  const ranked = [...members].sort(
    (a, b) => Math.abs(netByMember[b.id] ?? 0) - Math.abs(netByMember[a.id] ?? 0),
  );

  /**
   * The face row is the summary; the names are the detail.
   *
   * A line naming whoever is furthest from even answers "who owes what" in one
   * glance, without the four separate cards that used to fill the top of the
   * page. When everyone is level it says so, which is the answer most of the
   * time.
   */
  const standout = ranked.find((member) => Math.abs(netByMember[member.id] ?? 0) >= 0.01);
  const allSettled = !standout;

  const summary = useMemo(() => {
    if (members.length === 1) {
      return 'Just you so far';
    }
    if (allSettled) {
      return 'Everyone is settled up';
    }
    const name = standout?.fullname?.split(' ')[0] || 'Someone';
    const net = netByMember[standout!.id] ?? 0;
    return net > 0
      ? `${name} gets ${formatMoney(net, currency)}`
      : `${name} owes ${formatMoney(-net, currency)}`;
  }, [members.length, allSettled, standout, netByMember, currency]);

  return (
    <View style={styles.wrap}>
      <Pressable
        style={({ pressed }) => [styles.memberStrip, pressed && styles.pressed]}
        onPress={onOpenMembers}
        accessibilityRole="button"
        accessibilityLabel="Show the members of this trip"
      >
        <MemberFaces members={members} max={4} size={30} />

        <View style={styles.stripBody}>
          <Text style={styles.stripTitle} numberOfLines={1}>
            {members.length} {members.length === 1 ? 'member' : 'members'}
          </Text>
          <Text style={[styles.stripSub, !allSettled && styles.stripSubActive]} numberOfLines={1}>
            {summary}
          </Text>
        </View>

        {isOwner && <Crown size={12} color={BrandColors.base700} />}
        <ChevronRight size={16} color={BrandColors.secondary} />
      </Pressable>

      {/* The invite code and its QR live in a sheet, opened from here. Only
          shown while this trip is just you: once another person joins, the
          prompt has done its job. */}
      {showInvite && (
        <Pressable
          style={styles.inviteButton}
          onPress={onOpenInvite}
          accessibilityRole="button"
          accessibilityLabel="Invite people to this trip"
        >
          <View style={styles.inviteIcon}>
            <QrCode size={18} color={BrandColors.primary} />
          </View>
          <View style={styles.inviteBody}>
            <Text style={styles.inviteTitle}>Invite people</Text>
            <Text style={styles.inviteSub}>Show the invite code and QR</Text>
          </View>
          <ChevronRight size={18} color={BrandColors.secondary} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.two,
  },
  memberStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: BrandColors.surfaceAlt,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 16,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
  stripBody: {
    flex: 1,
    gap: 1,
  },
  stripTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 12,
    color: BrandColors.primary,
  },
  stripSub: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    color: BrandColors.secondary,
  },
  stripSubActive: {
    color: BrandColors.primary,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: BrandColors.surfaceAlt,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 16,
    padding: Spacing.three,
  },
  inviteIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: BrandColors.base200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteBody: {
    flex: 1,
    gap: Spacing.half,
  },
  inviteTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    color: BrandColors.primary,
  },
  inviteSub: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: BrandColors.secondary,
  },
});
