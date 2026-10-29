import { BrandColors, Spacing } from '@/constants/theme';
import { useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

export type TabSliderItem<K extends string> = { key: K; label: string };

type Props<K extends string> = {
  items: readonly TabSliderItem<K>[];
  value: K;
  onChange: (key: K) => void;
};

/** Padding inside the track, and the space between two labels. */
const TRACK_PADDING = 3;
const LABEL_GAP = 2;

/** How long the pill takes to glide to the next label. */
const SLIDE_MS = 260;

/**
 * A segmented switcher whose highlight pill slides to the chosen label instead
 * of jumping. The pill is positioned from the measured width of the track, so
 * it stays correct on any screen size and on web.
 */
export default function TabSlider<K extends string>({ items, value, onChange }: Props<K>) {
  const [trackWidth, setTrackWidth] = useState(0);

  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.key === value),
  );

  // One width per label, with the gaps between them taken off the total.
  const labelWidth =
    trackWidth > 0 ? (trackWidth - LABEL_GAP * (items.length - 1)) / items.length : 0;

  const position = useSharedValue(0);
  const pillWidth = useSharedValue(0);

  // Follow the chosen tab. On the first measure this also snaps the pill into
  // place with no animation, so it does not slide in from the left on open.
  useEffect(() => {
    if (labelWidth <= 0) return;
    const x = activeIndex * (labelWidth + LABEL_GAP);
    const settled = pillWidth.value > 0;
    position.value = settled
      ? withTiming(x, { duration: SLIDE_MS, easing: Easing.out(Easing.cubic) })
      : x;
    pillWidth.value = settled
      ? withTiming(labelWidth, { duration: SLIDE_MS, easing: Easing.out(Easing.cubic) })
      : labelWidth;
  }, [activeIndex, labelWidth, pillWidth, position]);

  const pillStyle = useAnimatedStyle(() => ({
    width: pillWidth.value,
    transform: [{ translateX: position.value }],
  }));

  const onLayout = (event: LayoutChangeEvent) => {
    const inner = event.nativeEvent.layout.width - TRACK_PADDING * 2;
    if (inner > 0 && Math.abs(inner - trackWidth) > 0.5) setTrackWidth(inner);
  };

  return (
    <View style={styles.track} onLayout={onLayout}>
      {labelWidth > 0 && <Animated.View style={[styles.pill, pillStyle]} />}

      {items.map((item, index) => (
        <TabLabel
          key={item.key}
          label={item.label}
          isActive={item.key === value}
          index={index}
          activeIndex={activeIndex}
          onPress={() => onChange(item.key)}
        />
      ))}
    </View>
  );
}

function TabLabel({
  label,
  isActive,
  index,
  activeIndex,
  onPress,
}: {
  label: string;
  isActive: boolean;
  index: number;
  activeIndex: number;
  onPress: () => void;
}) {
  // 1 when this label is the chosen one, 0 otherwise, faded between so the
  // text colour changes with the pill rather than snapping ahead of it.
  const highlight = useSharedValue(isActive ? 1 : 0);

  useEffect(() => {
    highlight.value = withTiming(index === activeIndex ? 1 : 0, { duration: SLIDE_MS });
  }, [activeIndex, highlight, index]);

  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(highlight.value, [0, 1], [BrandColors.secondary, BrandColors.primary]),
  }));

  const weightStyle = isActive ? styles.labelOn : styles.labelOff;

  return (
    <Pressable
      style={styles.label}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={label}
    >
      <Animated.Text style={[weightStyle, labelStyle]} numberOfLines={1}>
        {label}
      </Animated.Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: BrandColors.surfaceAlt,
    borderRadius: 12,
    padding: TRACK_PADDING,
    gap: LABEL_GAP,
  },
  pill: {
    position: 'absolute',
    top: TRACK_PADDING,
    left: TRACK_PADDING,
    bottom: TRACK_PADDING,
    borderRadius: 10,
    backgroundColor: BrandColors.base50,
  },
  label: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.two,
    borderRadius: 10,
  },
  // The colour fades with the pill. The font weight cannot be animated, so it
  // swaps at the tap - which reads as the label landing under the pill.
  labelOff: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
  },
  labelOn: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 12,
  },
});
