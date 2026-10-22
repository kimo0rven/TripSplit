import BackButton from '@/components/Button/back-button';
import { BrandColors, MaxContentWidth, Spacing } from '@/constants/theme';
import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface TripScreenHeaderProps {
  title: string;
  onBack: () => void;
  subtitle?: string;
  /** Shown just before the title, such as the trip's own icon. */
  leading?: ReactNode;
  right?: ReactNode;
}

/** Back arrow plus a centred title, matching the rest of the app's screens. */
export default function TripScreenHeader({
  title,
  onBack,
  subtitle,
  leading,
  right,
}: TripScreenHeaderProps) {
  return (
    <View style={styles.outer}>
      <View style={styles.header}>
        <View style={styles.backWrapper}>
          <BackButton onPress={onBack} />
        </View>
        <View style={styles.titleRow}>
          {leading ? <View style={styles.leading}>{leading}</View> : null}
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>
        {right ? <View style={styles.rightWrapper}>{right}</View> : null}
      </View>
      {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  // A real row: the title takes whatever the back arrow and the action buttons
  // leave, so a long trip name shortens instead of sliding under them.
  header: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  backWrapper: {
    marginLeft: -Spacing.two,
  },
  rightWrapper: {
    flexShrink: 0,
  },
  titleRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  leading: {
    // The leading content is usually a coloured trip badge, which paints its
    // own square, so this wrapper only reserves the space.
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 20,
    color: BrandColors.primary,
    flexShrink: 1,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: BrandColors.secondary,
    textAlign: 'center',
    marginTop: Spacing.one,
  },
});
