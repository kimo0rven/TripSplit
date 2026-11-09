import Avatar from '@/components/ui/avatar';
import { AVATAR_COLORS } from '@/constants/avatar-colors';
import { BrandColors, Spacing } from '@/constants/theme';
import { TripMember } from '@/types/trips';
import { wheelLanding } from '@/utils/fun';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';
import { themedStyles } from '@/constants/themed-styles';

/** The whole wheel, rim included. */
const SIZE = 280;
const CENTER = SIZE / 2;
/** The dark rim with its lights. */
const RIM = 14;
/** The coloured face of the wheel, inside the rim. */
const FACE = CENTER - RIM;
const HUB = 64;
const LIGHTS = 24;
/** Faces on the slices only while they fit; past this, names alone. */
const MAX_FACES = 8;
/** A flick slower than this, in degrees per millisecond, just turns the wheel by hand. */
const FLICK = 0.25;

interface WheelProps {
  members: TripMember[];
  /** Called with the winner once the wheel has actually stopped. */
  onSettle: (member: TripMember) => void;
  /** Fires as the wheel leaves, so the parent can clear the last answer. */
  onSpinStart?: () => void;
  /** Blocks a second spin while the wheel is still turning. */
  spinning: boolean;
  setSpinning: (value: boolean) => void;
  /** Picks the winner. Passed in so a test can make the draw predictable. */
  draw: () => TripMember | null;
}

/** A point on a circle, with 0 degrees at the top and angles going clockwise. */
const pointAt = (radius: number, degrees: number) => {
  const radians = (degrees * Math.PI) / 180;
  return { x: CENTER + radius * Math.sin(radians), y: CENTER - radius * Math.cos(radians) };
};

/** One slice of the wheel, centred on `mid`. */
const slicePath = (mid: number, slice: number) => {
  const from = pointAt(FACE, mid - slice / 2);
  const to = pointAt(FACE, mid + slice / 2);
  const large = slice > 180 ? 1 : 0;
  return `M ${CENTER} ${CENTER} L ${from.x} ${from.y} A ${FACE} ${FACE} 0 ${large} 1 ${to.x} ${to.y} Z`;
};

/** Each slice's colours, so neighbours never match, the last and first included. */
const sliceColours = (count: number) =>
  Array.from({ length: count }, (_, index) => {
    let pick = index % AVATAR_COLORS.length;
    if (count > 1 && index === count - 1 && pick === 0) pick = 1;
    return AVATAR_COLORS[pick];
  });

/** The clock, read only while a finger is on the wheel. */
const nowMs = () => Date.now();

/** The angle of a touch around the wheel's centre, 0 at the top, clockwise. */
const touchAngle = (x: number, y: number) =>
  (Math.atan2(x - CENTER, -(y - CENTER)) * 180) / Math.PI;

/**
 * A prize wheel: a slice per person, a rim of lights, pegs that tick past the
 * pointer, and a slow, heavy stop. Tap the hub or the button to spin, or flick
 * the wheel with a finger either way.
 *
 * The winner is drawn before the wheel moves, so the animation is honest: it
 * turns to the person already picked, stopping somewhere inside their slice,
 * instead of reading whoever happens to be under the pointer.
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
  const pointerTilt = useSharedValue(0);
  const [landedId, setLandedId] = useState<string | null>(null);
  const count = members.length;
  const slice = count > 0 ? 360 / count : 360;
  const colours = useMemo(() => sliceColours(count), [count]);

  // A trip can lose someone while this screen is open; the highlight goes with them.
  const landed = members.find((member) => member.id === landedId) ?? null;

  const settle = useCallback(
    (winner: TripMember) => {
      setSpinning(false);
      setLandedId(winner.id);
      onSettle(winner);
    },
    [onSettle, setSpinning],
  );

  /** Draws a winner and turns the wheel to them. */
  const spin = useCallback(
    (options: { direction?: 1 | -1; speed?: number } = {}) => {
      if (spinning || count === 0) return;
      const winner = draw();
      if (!winner) return;

      const index = Math.max(
        0,
        members.findIndex((member) => member.id === winner.id),
      );
      const direction = options.direction ?? 1;
      // A harder flick spins longer, as a real wheel would.
      const turns = Math.min(8, Math.max(4, Math.round(4 + (options.speed ?? 0) * 3)));
      const from = rotation.get();
      const target = wheelLanding(from, index * slice, slice, {
        turns,
        direction,
        offset: Math.random() * 0.8 - 0.4,
      });

      onSpinStart?.();
      setLandedId(null);
      setSpinning(true);

      if (reduceMotion) {
        rotation.set(target);
        settle(winner);
        return;
      }

      const run = withTiming(
        target,
        // Fast off the mark, then a long, heavy slow-down into the last slice.
        { duration: 3600 + turns * 260, easing: Easing.bezier(0.12, 0.65, 0.12, 1) },
        (finished) => {
          if (finished) runOnJS(settle)(winner);
        },
      );
      // A button spin winds back a little first; a flick is already moving.
      rotation.set(
        options.speed
          ? run
          : withSequence(
              withTiming(from - direction * 12, {
                duration: 220,
                easing: Easing.out(Easing.quad),
              }),
              run,
            ),
      );
    },
    [
      count,
      draw,
      members,
      onSpinStart,
      reduceMotion,
      rotation,
      setSpinning,
      settle,
      slice,
      spinning,
    ],
  );

  // The pointer flicks back each time a peg passes it, faster as the wheel runs faster.
  useAnimatedReaction(
    () => {
      const at = (((-rotation.value + slice / 2) % 360) + 360) % 360;
      return { peg: Math.floor(at / slice), turn: rotation.value };
    },
    (now, before) => {
      if (!before || now.peg === before.peg || count < 2) return;
      const forward = now.turn > before.turn ? 1 : -1;
      pointerTilt.value = withSequence(
        withTiming(forward * -24, { duration: 35 }),
        withSpring(0, { damping: 9, stiffness: 320 }),
      );
    },
    [slice, count],
  );

  /* Turning the wheel by hand: it follows the finger, and a quick flick spins
     it for real. Built on PanResponder so it needs no gesture setup at the root. */
  const drag = useRef({ start: 0, from: 0, lastAngle: 0, lastTime: 0, speed: 0 });
  /** Where the wheel sits on the screen, so a touch anywhere on it reads as an angle. */
  const boxRef = useRef<View>(null);
  const origin = useRef({ x: 0, y: 0 });
  const measure = () =>
    boxRef.current?.measure((_x, _y, _w, _h, pageX, pageY) => {
      origin.current = { x: pageX, y: pageY };
    });
  const angleOf = (event: { nativeEvent: { pageX: number; pageY: number } }) =>
    touchAngle(
      event.nativeEvent.pageX - origin.current.x,
      event.nativeEvent.pageY - origin.current.y,
    );
  const spinRef = useRef(spin);
  const spinningRef = useRef(spinning);
  // Kept in step after each render; the React Compiler forbids writing refs while rendering.
  useEffect(() => {
    spinRef.current = spin;
    spinningRef.current = spinning;
  });

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: () => {
          // The page may have scrolled since the last touch.
          measure();
          return false;
        },
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          !spinningRef.current && Math.abs(gesture.dx) + Math.abs(gesture.dy) > 8,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => {
          const angle = angleOf(event);
          drag.current = {
            start: angle,
            from: rotation.get(),
            lastAngle: angle,
            lastTime: nowMs(),
            speed: 0,
          };
        },
        onPanResponderMove: (event) => {
          const angle = angleOf(event);
          const state = drag.current;
          // Unwrapped, so crossing the bottom of the circle does not jump a turn.
          let step = angle - state.lastAngle;
          if (step > 180) step -= 360;
          if (step < -180) step += 360;
          const now = nowMs();
          const elapsed = Math.max(1, now - state.lastTime);
          state.speed = state.speed * 0.5 + (step / elapsed) * 0.5;
          state.lastAngle = angle;
          state.lastTime = now;
          state.from += step;
          rotation.set(state.from);
        },
        onPanResponderRelease: () => {
          const speed = drag.current.speed;
          if (Math.abs(speed) >= FLICK) {
            spinRef.current({ direction: speed > 0 ? 1 : -1, speed: Math.abs(speed) });
          }
        },
      }),
    [rotation],
  );

  const wheelStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));
  const pointerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${pointerTilt.value}deg` }],
  }));

  const canSpin = count > 0 && !spinning;
  const showFaces = count <= MAX_FACES;
  const nameSize = count <= 4 ? 13 : count <= 8 ? 11 : 9;

  return (
    <View style={styles.wrap}>
      <View style={styles.stage}>
        <View
          ref={boxRef}
          onLayout={measure}
          style={styles.wheelBox}
          {...pan.panHandlers}
          accessible
          accessibilityLabel="Wheel of who pays next. Flick it, or use the spin button."
        >
          <Animated.View style={[styles.wheel, wheelStyle]}>
            <Svg width={SIZE} height={SIZE}>
              {/* The rim, with its ring of lights. */}
              <Circle cx={CENTER} cy={CENTER} r={CENTER - 1} fill={BrandColors.primary} />
              {Array.from({ length: LIGHTS }, (_, index) => {
                const dot = pointAt(CENTER - RIM / 2 - 1, (360 / LIGHTS) * index);
                return (
                  <Circle
                    key={`light-${index}`}
                    cx={dot.x}
                    cy={dot.y}
                    r={2.6}
                    fill={index % 2 === 0 ? BrandColors.base400 : '#FFF6D6'}
                  />
                );
              })}

              {count === 1 ? (
                <Circle cx={CENTER} cy={CENTER} r={FACE} fill={colours[0].background} />
              ) : (
                members.map((member, index) => (
                  <Path
                    key={member.id}
                    d={slicePath(index * slice, slice)}
                    fill={colours[index].background}
                    fillOpacity={landed && landed.id !== member.id ? 0.35 : 1}
                    stroke={BrandColors.background}
                    strokeWidth={2}
                  />
                ))
              )}

              {/* Names, written across each slice near the rim. */}
              {members.map((member, index) => {
                const name = (member.fullname.split(' ')[0] || 'Member').slice(0, 10);
                return (
                  <G
                    key={`name-${member.id}`}
                    rotation={index * slice}
                    origin={`${CENTER}, ${CENTER}`}
                  >
                    <SvgText
                      x={CENTER}
                      y={CENTER - FACE + 22}
                      fill={colours[index].foreground}
                      fillOpacity={landed && landed.id !== member.id ? 0.4 : 1}
                      fontSize={nameSize}
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {name}
                    </SvgText>
                  </G>
                );
              })}

              {/* Pegs on the borders: what the pointer clicks against. */}
              {count > 1 &&
                members.map((member, index) => {
                  const peg = pointAt(FACE - 3, index * slice + slice / 2);
                  return (
                    <Circle
                      key={`peg-${member.id}`}
                      cx={peg.x}
                      cy={peg.y}
                      r={3.2}
                      fill={BrandColors.background}
                      stroke={BrandColors.primary}
                      strokeWidth={1.2}
                    />
                  );
                })}
            </Svg>

            {/* Faces sit in their slices and turn with the wheel. */}
            {showFaces &&
              members.map((member, index) => (
                <View
                  key={`face-${member.id}`}
                  pointerEvents="none"
                  style={[
                    styles.face,
                    {
                      transform: [{ rotate: `${index * slice}deg` }, { translateY: -FACE * 0.55 }],
                      opacity: landed && landed.id !== member.id ? 0.45 : 1,
                    },
                  ]}
                >
                  <Avatar
                    name={member.fullname}
                    size={count <= 4 ? 40 : 30}
                    photoURL={member.photoURL}
                  />
                </View>
              ))}
          </Animated.View>

          {/* The hub stays still while the wheel turns under it; tapping it spins. */}
          <Pressable
            style={({ pressed }) => [styles.hub, pressed && canSpin && styles.pressed]}
            onPress={() => spin()}
            disabled={!canSpin}
            accessibilityRole="button"
            accessibilityLabel="Spin"
          >
            {landed && !spinning ? (
              <Avatar name={landed.fullname} size={HUB - 14} photoURL={landed.photoURL} />
            ) : (
              <Text style={styles.hubText}>{spinning ? '' : 'SPIN'}</Text>
            )}
          </Pressable>
        </View>

        {/* The pointer, pinned at the top, swinging from its pin. */}
        <Animated.View style={[styles.pointer, pointerStyle]} pointerEvents="none">
          <Svg width={34} height={46}>
            <Path
              d="M17 44 L4 14 A14 14 0 1 1 30 14 Z"
              fill={BrandColors.base50}
              stroke={BrandColors.onBrand}
              strokeWidth={2}
            />
            <Circle cx={17} cy={14} r={5} fill={BrandColors.onBrand} />
          </Svg>
        </Animated.View>
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.spinButton,
          !canSpin && styles.spinButtonOff,
          pressed && canSpin && styles.pressed,
        ]}
        onPress={() => spin()}
        disabled={!canSpin}
        accessibilityRole="button"
        accessibilityLabel="Spin the wheel to pick who pays next"
        accessibilityState={{ disabled: !canSpin }}
      >
        <Text style={styles.spinText}>
          {spinning ? 'Spinning…' : landed ? 'Spin again' : 'Spin the wheel'}
        </Text>
      </Pressable>
      {count > 1 && !spinning && (
        <Text style={styles.hint}>Or flick the wheel with your finger.</Text>
      )}
    </View>
  );
}

const styles = themedStyles(() => ({
  wrap: { alignItems: 'center', gap: Spacing.three },
  stage: { width: SIZE, height: SIZE + 18, alignItems: 'center' },
  wheelBox: {
    position: 'absolute',
    top: 18,
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheel: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    // A soft drop shadow, so the wheel sits on the card instead of in it.
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    borderRadius: SIZE / 2,
  },
  face: {
    position: 'absolute',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: BrandColors.background,
  },
  hub: {
    position: 'absolute',
    width: HUB,
    height: HUB,
    borderRadius: HUB / 2,
    backgroundColor: BrandColors.base50,
    borderWidth: 4,
    borderColor: BrandColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 8,
  },
  hubText: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 13,
    letterSpacing: 1,
    color: BrandColors.onBrand,
  },
  pointer: {
    position: 'absolute',
    top: 0,
    width: 34,
    height: 46,
    // Swings from the pin at the top, like a real flapper.
    transformOrigin: [17, 14, 0],
    zIndex: 2,
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
  spinButtonOff: { backgroundColor: BrandColors.inputField },
  pressed: { opacity: 0.85 },
  spinText: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: BrandColors.onBrand },
  hint: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: BrandColors.secondary,
    marginTop: -Spacing.two,
  },
}));
