import { BrandColors, Spacing } from '@/constants/theme';
import { Bell, BellOff, Settings, Star, UserPlus } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

interface TripHeaderActionsProps {
  /** Whether to show the dashboard star at all. */
  showStar: boolean;
  isActiveTrip: boolean;
  onMarkActive: () => void;
  isOwner: boolean;
  onSettings: () => void;
  showInvite: boolean;
  onInvite: () => void;
  muted: boolean;
  onToggleMute: () => void;
}

/**
 * The small round buttons in a trip's header. A hollow star means "tap to use
 * this trip on the dashboard"; filled, it only says the dashboard already shows
 * it. Settings are the owner's job, and the invite icon hides once someone else
 * has joined.
 */
export default function TripHeaderActions({
  showStar,
  isActiveTrip,
  onMarkActive,
  isOwner,
  onSettings,
  showInvite,
  onInvite,
  muted,
  onToggleMute,
}: TripHeaderActionsProps) {
  return (
    <View style={styles.headerActions}>
      {showStar &&
        (isActiveTrip ? (
          <View
            style={styles.headerAction}
            accessibilityLabel="This trip is the one on your dashboard"
          >
            <Star size={16} color={BrandColors.primary} fill={BrandColors.primary} />
          </View>
        ) : (
          <Pressable
            style={styles.headerAction}
            onPress={onMarkActive}
            accessibilityRole="button"
            accessibilityLabel="Use this trip on the dashboard"
          >
            <Star size={16} color={BrandColors.primary} />
          </Pressable>
        ))}
      <Pressable
        style={styles.headerAction}
        onPress={onToggleMute}
        accessibilityRole="button"
        accessibilityLabel={muted ? 'Unmute notifications for this trip' : 'Mute notifications for this trip'}
      >
        {muted ? (
          <BellOff size={16} color={BrandColors.secondary} />
        ) : (
          <Bell size={16} color={BrandColors.primary} />
        )}
      </Pressable>
      {isOwner && (
        <Pressable
          style={styles.headerAction}
          onPress={onSettings}
          accessibilityRole="button"
          accessibilityLabel="Trip settings"
        >
          <Settings size={16} color={BrandColors.primary} />
        </Pressable>
      )}
      {showInvite && (
        <Pressable
          style={styles.headerAction}
          onPress={onInvite}
          accessibilityRole="button"
          accessibilityLabel="Invite people to this trip"
        >
          <UserPlus size={16} color={BrandColors.primary} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  headerAction: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: BrandColors.base200,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
