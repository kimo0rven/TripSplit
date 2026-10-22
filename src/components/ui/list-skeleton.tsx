import { BrandColors, Spacing } from '@/constants/theme';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

interface ListSkeletonProps {
  rows?: number;
  rowHeight?: number;
}

/** Pulsing grey rows shown in place of a list while it loads. */
export default function ListSkeleton({ rows = 4, rowHeight = 64 }: ListSkeletonProps) {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.wrap} accessibilityRole="progressbar" accessibilityLabel="Loading">
      {Array.from({ length: rows }).map((_, index) => (
        <Animated.View key={index} style={[styles.row, { height: rowHeight, opacity: pulse }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two, width: '100%' },
  row: { backgroundColor: BrandColors.border, borderRadius: 14 },
});
