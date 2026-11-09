import { BrandColors } from '@/constants/theme';
import { Linking, Text } from 'react-native';
import { themedStyles } from '@/constants/themed-styles';

const RATES_SITE = 'https://www.exchangerate-api.com';

/**
 * The credit ExchangeRate-API's free rates ask for wherever converted amounts
 * are shown. Small and quiet, but a real link.
 */
export default function RatesCredit({ align = 'left' }: { align?: 'left' | 'right' | 'center' }) {
  return (
    <Text
      style={[styles.credit, { textAlign: align }]}
      onPress={() => void Linking.openURL(RATES_SITE)}
      accessibilityRole="link"
      accessibilityLabel="Rates by Exchange Rate API, opens their website"
    >
      Rates By Exchange Rate API
    </Text>
  );
}

const styles = themedStyles(() => ({
  credit: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 10,
    color: BrandColors.secondary,
    textDecorationLine: 'underline',
  },
}));
