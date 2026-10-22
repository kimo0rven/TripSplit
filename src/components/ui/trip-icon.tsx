import { findTripIcon } from '@/constants/trip-icons';
import { findTripColor } from '@/constants/trip-colors';
import { BrandColors } from '@/constants/theme';
import { StyleSheet, View } from 'react-native';

interface TripIconProps {
  /** The icon key saved on the trip. Missing or unknown uses the default. */
  name?: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

/** Draws a trip's chosen icon, so every card uses the same lookup. */
export default function TripIcon({
  name,
  size = 22,
  color = BrandColors.primary,
  strokeWidth = 2,
}: TripIconProps) {
  const { Icon } = findTripIcon(name);
  return <Icon size={size} color={color} strokeWidth={strokeWidth} />;
}

interface TripIconBadgeProps {
  /** The icon key saved on the trip. */
  name?: string;
  /** The colour key saved on the trip. Missing or unknown uses amber. */
  colorKey?: string;
  /** The width and height of the square. */
  size?: number;
  /** The size of the icon inside it. Defaults to just under half the square. */
  iconSize?: number;
  /** Corner rounding. Defaults to a third of the square. */
  radius?: number;
}

/**
 * The icon in its coloured square - what a trip looks like in a list.
 *
 * Every surface that shows a trip uses this, so a trip keeps the same picture
 * and the same colour on the dashboard, the trips list, and the trip header.
 */
export function TripIconBadge({ name, colorKey, size = 40, iconSize, radius }: TripIconBadgeProps) {
  const { Icon } = findTripIcon(name);
  const palette = findTripColor(colorKey);

  return (
    <View
      style={[
        styles.badge,
        {
          width: size,
          height: size,
          borderRadius: radius ?? Math.round(size / 3),
          backgroundColor: palette.background,
        },
      ]}
    >
      <Icon size={iconSize ?? Math.round(size * 0.5)} color={palette.foreground} strokeWidth={2} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
