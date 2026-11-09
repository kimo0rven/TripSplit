import { BrandColors, Spacing } from '@/constants/theme';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { themedStyles } from '@/constants/themed-styles';

/**
 * Where the app lands when PayMongo's return page opens it.
 *
 * The settle sheet that started the payment is still open underneath, and it
 * is the one that confirms and records the payment. So this screen does
 * nothing but step straight back to it. On Android the return link arrives as
 * an ordinary app link and pushes this route; going anywhere else here would
 * unmount the sheet in the middle of confirming.
 */
export default function PayMongoReturn() {
  useEffect(() => {
    const timer = setTimeout(() => {
      if (router.canGoBack()) router.back();
      else router.replace('/trips');
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.screen}>
      <ActivityIndicator color={BrandColors.base50} />
      <Text style={styles.text}>Finishing your payment…</Text>
    </View>
  );
}

const styles = themedStyles(() => ({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.five,
    backgroundColor: BrandColors.background,
  },
  text: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 13,
    color: BrandColors.secondary,
  },
}));
