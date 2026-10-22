import { BrandColors, Spacing } from '@/constants/theme';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

/** Grey pulsing blocks shown while the dashboard loads. */
export default function DashboardSkeleton() {
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
    <View style={styles.wrap}>
      {[72, 88, 56, 120].map((height, index) => (
        <Animated.View key={index} style={[styles.block, { height, opacity: pulse }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.three },
  block: { backgroundColor: BrandColors.border, borderRadius: 16 },
});
