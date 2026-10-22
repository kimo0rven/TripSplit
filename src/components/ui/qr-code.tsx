import { BrandColors } from '@/constants/theme';
import QRCode from 'react-native-qrcode-svg';
import { StyleSheet, View } from 'react-native';

interface QrCodeProps {
  value: string;
  size?: number;
  /** Colour of the dark squares. Keep it dark enough to stay scannable. */
  color?: string;
}

/** A white card with a QR code inside, so it stays scannable on any background. */
export default function QrCode({ value, size = 200, color = BrandColors.primary }: QrCodeProps) {
  if (!value) return null;

  return (
    <View style={styles.card}>
      <QRCode value={value} size={size} color={color} backgroundColor="#FFFFFF" />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
