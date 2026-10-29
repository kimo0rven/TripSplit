import { BrandColors, Spacing } from '@/constants/theme';
import { Bell, BellOff, Ellipsis, Settings, Star, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

interface TripHeaderActionsProps {
  /** Whether to show the dashboard star at all. */
  showStar: boolean;
  isActiveTrip: boolean;
  onMarkActive: () => void;
  /** Takes the trip off the dashboard; shown when it is already the one there. */
  onClearActive: () => void;
  isOwner: boolean;
  onSettings: () => void;
  muted: boolean;
  onToggleMute: () => void;
}

/** One round button, and the space between two of them. */
const BUTTON = 34;
const GAP = Spacing.two;

/** How long the buttons take to slide out and back. */
const SLIDE_MS = 220;

/**
 * A trip's header tools, folded behind a single round button so the corner stays
 * quiet. Tapping it slides the real buttons out to the left; the button turns
 * into a cross, and tapping again puts them away. Using one of the buttons
 * leaves the row open with the cross still showing, so the owner can reach a
 * second tool without opening it again. A hollow star means "tap to use this
 * trip on the dashboard"; filled, tapping it takes the trip back off, which is
 * how a trip still months away waits without claiming the dashboard.
 * Settings sit last, right beside the cross. Inviting lives on the trip card's
 * QR button and the members sheet, so it is not repeated here.
 */
export default function TripHeaderActions({
  showStar,
  isActiveTrip,
  onMarkActive,
  onClearActive,
  isOwner,
  onSettings,
  muted,
  onToggleMute,
}: TripHeaderActionsProps) {
  const [open, setOpen] = useState(false);

  // 0 hidden, 1 fully out. The width, the fade and the small slide all follow
  // it, so the row grows leftwards from behind the trigger.
  const progress = useSharedValue(0);

  const count = (showStar ? 1 : 0) + 1 + (isOwner ? 1 : 0);

  // The buttons alone, then the gap that separates them from the trigger.
  const rowWidth = count * BUTTON + (count - 1) * GAP;
  const wrapperWidth = rowWidth + GAP;

  const slide = (next: boolean) => {
    setOpen(next);
    progress.value = withTiming(next ? 1 : 0, {
      duration: SLIDE_MS,
      easing: Easing.out(Easing.cubic),
    });
  };

  const revealStyle = useAnimatedStyle(() => ({
    width: progress.value * wrapperWidth,
    opacity: progress.value,
    transform: [{ translateX: (1 - progress.value) * 10 }],
  }));

  return (
    <View style={styles.headerActions}>
      <Animated.View
        // A collapsed row must not swallow taps, and must stay out of the way
        // of a screen reader.
        style={[styles.reveal, revealStyle, !open && styles.revealHidden]}
        accessibilityElementsHidden={!open}
        importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
      >
        <View style={[styles.revealRow, { width: rowWidth }]}>
          {showStar &&
            (isActiveTrip ? (
              <Pressable
                style={styles.headerAction}
                onPress={onClearActive}
                accessibilityRole="button"
                accessibilityLabel="Remove this trip from the dashboard"
              >
                <Star size={16} color={BrandColors.primary} fill={BrandColors.primary} />
              </Pressable>
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
            accessibilityLabel={
              muted ? 'Unmute notifications for this trip' : 'Mute notifications for this trip'
            }
          >
            {muted ? (
              <BellOff size={16} color={BrandColors.secondary} />
            ) : (
              <Bell size={16} color={BrandColors.primary} />
            )}
          </Pressable>
          {/* Last in the row, so settings end up nearest the cross. */}
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
        </View>
      </Animated.View>

      <Pressable
        style={styles.headerAction}
        onPress={() => slide(!open)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={open ? 'Hide trip actions' : 'Show trip actions'}
      >
        {open ? (
          <X size={16} color={BrandColors.primary} />
        ) : (
          <Ellipsis size={16} color={BrandColors.primary} />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Clips the row as it grows, so the buttons come out from under the trigger
  // rather than appearing all at once.
  reveal: {
    height: BUTTON,
    overflow: 'hidden',
  },
  // Kept off the touch layer and the accessibility tree while it has no width.
  revealHidden: {
    pointerEvents: 'none',
  },
  // Offset by one gap from the clipping box's right edge, which is what leaves
  // the same gap between the last button and the cross as the buttons have
  // between each other.
  revealRow: {
    position: 'absolute',
    right: GAP,
    top: 0,
    height: BUTTON,
    flexDirection: 'row',
    alignItems: 'center',
    gap: GAP,
  },
  headerAction: {
    width: BUTTON,
    height: BUTTON,
    borderRadius: BUTTON / 2,
    backgroundColor: BrandColors.base200,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
