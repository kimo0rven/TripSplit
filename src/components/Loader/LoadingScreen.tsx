import { BrandColors } from '@/constants/theme';
import { StyleSheet, Text, View } from 'react-native';

export default function LoadingScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>
        Trip<Text style={styles.logo2}>Split</Text>
      </Text>
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
    fontSize: 64,
    fontFamily: 'PlusJakartaSans-ExtraBold',

    color: BrandColors.primary,
  },
  logo2: {
    color: BrandColors.background,
  },
});