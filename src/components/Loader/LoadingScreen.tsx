import logo from '@/assets/images/logo_on_yellow.png';
import { Image, View } from 'react-native';

import { BrandColors } from '@/constants/theme';
import { themedStyles } from '@/constants/themed-styles';

export default function LoadingScreen() {
  return (
    <View style={styles.container}>
      <Image source={logo} style={styles.logo} accessibilityLabel="Trip Split" />
    </View>
  );
}

const styles = themedStyles(() => ({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BrandColors.base50,
  },
  logo: {
    width: 200,
    height: 54,
  },
}));
