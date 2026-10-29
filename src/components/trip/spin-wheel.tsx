import Avatar from '@/components/ui/avatar';
import { BrandColors, Spacing } from '@/constants/theme';
import { TripMember } from '@/types/trips';
import { spinTargetRotation, wheelAngleFor } from '@/utils/fun';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

/** The ring's diameter. Wide enough for a name under each face on a small phone. */
const RING_SIZE = 236;

/** How long the run forward lasts, before it eases into the landing. */
const SPIN_MS = 2600;

/** The gap between the ring and the pointer, so the pointer never covers a face. */
const POINTER_HEIGHT = 18;

interface WheelProps {
  members: TripMember[];
  /** Called with the winner once the ring has actually stopped. */
  onSettle: (member: TripMember) => void;
  /** Fires as the ring leaves, so the parent can clear the last answer. */
  onSpinStart?: () => void;
  /** Blocks a second spin while the ring is still turning. */
  spinning: boolean;
  setSpinning: (value: boolean) => void;
  /** Picks the winner. Passed in so a test can make the draw predictable. */
  draw: () => TripMember | null;
}

/**
 * A real spinning wheel: a ring of faces that turns, slows down, and stops with
 * somebody under the pointer.
 *
 * The winner is decided before the ring moves, so the animation is honest - it
 * turns to the person who was already picked rather than reading whoever
 * happens to be under the pointer when it stops. The waiting is what makes it
 * feel like a draw instead of a number appearing.
 */
export default function SpinWheel({
  members,
  onSettle,
  onSpinStart,
  spinning,
  setSpinning,
  draw,
}: WheelProps) {
  const reduceMotion = useReducedMotion();
  const rotation = useSharedValue(0);
  /** The total turn so far, kept off the render path: only the maths needs it. */
  const turnedRef = useRef(0);
  const [landedId, setLandedId] = useState<string | null>(null);

  // A trip can lose someone while this screen is open. Deriving the winner from
  // the current list drops the highlight the moment that person is gone.
  const landed = members.find((member) => member.id === landedId) ?? null;

  /* Runs on the JS thread: the animation's own callback runs on the UI thread
     and cannot touch React state from there. Leaving the screen mid-spin
     cancels the animation, and a cancelled run reports `finished: false`, so
     nobody is ever announced after the wheel is gone. */
  const settle = useCallback(
    (winner: TripMember) => {
      setSpinning(false);
      setLandedId(winner.id);
      onSettle(winner);
    },
    [onSettle, setSpinning],
  );

  const spin = useCallback(() => {
    if (spinning || members.length === 0) return;

    const winner = draw();
    if (!winner) return;

    const index = members.findIndex((member) => member.id === winner.id);
    const target = spinTargetRotation(
      turnedRef.current,
      wheelAngleFor(Math.max(0, index), members.length),
    );

    onSpinStart?.();
    setLandedId(null);
    setSpinning(true);
    turnedRef.current = target;

    // Nothing to animate if the phone is set to reduce motion - just show the
    // answer, which is what that setting is asking for.
    if (reduceMotion) {
      rotation.set(target);
      settle(winner);
      return;
    }

    // The whole turn, including the small pull back at the start, in one jump
    // so the ring has a single final value to land on.
    rotation.set(
      withSequence(
        withTiming(target - 14, { duration: 180, easing: Easing.out(Easing.quad) }),
        withTiming(target, { duration: SPIN_MS, easing: Easing.out(Easing.cubic) }, (finished) => {
          // Announce only once the ring is still, so the name lands with it.
          if (finished) runOnJS(settle)(winner);
        }),
      ),
    );
  }, [draw, members, onSpinStart, reduceMotion, rotation, setSpinning, settle, spinning]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const canSpin = members.length > 0 && !spinning;

  return (
    <View style={styles.wrap}>
      <View style={styles.stage}>
        <View style={styles.pointer} />

        <Animated.View style={[styles.ring, ringStyle]}>
          <View style={styles.disc} />

          {members.map((member, index) => {
            const angle = wheelAngleFor(index, members.length);
            const isWinner = member.id === landed?.id;
            return (
              <View
                key={member.id}
                style={[
                  styles.slot,
                  { transform: [{ rotate: `${angle}deg` }, { translateY: -RING_SIZE / 2 + 34 }] },
                ]}
                pointerEvents="none"
              >
                {/* Turned back so the face and name stay upright as the ring
                    turns underneath them. */}
                <View style={{ transform: [{ rotate: `${-angle}deg` }] }}>
                  <View
                    style={[
                      styles.face,
                      isWinner && { borderColor: BrandColors.base500, borderWidth: 2.5 },
                    ]}
                  >
                    <Avatar name={member.fullname} size={38} photoURL={member.photoURL} />
                  </View>
                  <Text style={[styles.slotName, isWinner && styles.slotNameOn]} numberOfLines={1}>
                    {member.fullname.split(' ')[0]}
                  </Text>
                </View>
              </View>
            );
          })}
        </Animated.View>

        <View style={styles.hub}>
          <Text style={styles.hubText} numberOfLines={1}>
            {spinning ? '...' : landed ? 'Pays' : 'Spin'}
          </Text>
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.spinButton,
          !canSpin && styles.spinButtonOff,
          pressed && canSpin && styles.pressed,
        ]}
        onPress={spin}
        disabled={!canSpin}
        accessibilityRole="button"
        accessibilityLabel="Spin the wheel to pick who pays next"
        accessibilityState={{ disabled: !canSpin }}
      >
        <Text style={styles.spinText}>
          {spinning ? 'Spinning' : landed ? 'Spin again' : 'Spin the wheel'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: Spacing.three,
  },
  stage: {
    width: RING_SIZE,
    height: RING_SIZE + POINTER_HEIGHT,
    alignItems: 'center',
  },
  /* A downward arrow sitting on the rim, so the winner is readable at a glance. */
  pointer: {
    width: 0,
    height: 0,
    marginBottom: -1,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderTopWidth: 13,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: BrandColors.base500,
  },
  ring: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disc: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: RING_SIZE / 2,
    backgroundColor: BrandColors.background,
    borderWidth: 3,
    borderColor: BrandColors.base200,
  },
  slot: {
    position: 'absolute',
    alignItems: 'center',
  },
  face: {
    borderRadius: 24,
    padding: 2,
    backgroundColor: BrandColors.background,
  },
  slotName: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 10,
    color: BrandColors.secondary,
    textAlign: 'center',
    marginTop: 2,
    maxWidth: 64,
  },
  slotNameOn: {
    fontFamily: 'PlusJakartaSans-Bold',
    color: BrandColors.primary,
  },
  hub: {
    position: 'absolute',
    top: POINTER_HEIGHT + RING_SIZE / 2 - 26,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: BrandColors.base50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hubText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 11,
    color: BrandColors.primary,
  },
  spinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BrandColors.base50,
    borderRadius: 12,
    paddingVertical: Spacing.three,
    alignSelf: 'stretch',
  },
  spinButtonOff: {
    backgroundColor: BrandColors.inputField,
  },
  pressed: {
    opacity: 0.85,
  },
  spinText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    color: BrandColors.primary,
  },
});
