import logo from '@/assets/images/logo_whitemode.png';
import { BrandColors } from '@/constants/theme';
import { Image, StyleSheet } from 'react-native';
export default function whitemodeLogo() {
  return (
    <Image
        source={logo}
        accessibilityLabel="Trip Split"
        ></Image>
  );
}

const styles = StyleSheet.create({
  logo: {
    fontWeight: 'bold',
    color: BrandColors.primary,
    textAlign: 'center',
    fontSize: 45,
  },
  logo2: {
    color: BrandColors.background,
  },
});