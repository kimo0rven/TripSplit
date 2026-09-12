import logo from '@/assets/images/logo_whitemode.png';
import { Image, StyleSheet, View } from 'react-native';

import { BrandColors } from '@/constants/theme';

export default function LoadingScreen() {
  return (
    <View style={styles.container}>
      <Image source={logo} style={styles.logo} accessibilityLabel="Trip Split" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BrandColors.base50,
  },
  logo: {
    width: 184,
    height: 54,
  },
});