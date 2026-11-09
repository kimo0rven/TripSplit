import QRCode from 'react-native-qrcode-svg';
import { View } from 'react-native';
import { themedStyles } from '@/constants/themed-styles';

interface QrCodeProps {
  value: string;
  size?: number;
  /** Colour of the dark squares. Keep it dark enough to stay scannable. */
  color?: string;
}

/**
 * The squares' colours are fixed, not taken from the theme: the theme's text
 * colours turn light in dark mode, and light squares on the white card can't
 * be scanned.
 */
export const QR_INK = '#1A1A1A';
/** The brand gold, dark enough to scan on white. */
export const QR_GOLD = '#C4900D';

/** A white card with a QR code inside, so it stays scannable on any background. */
export default function QrCode({ value, size = 200, color = QR_INK }: QrCodeProps) {
  if (!value) return null;

  return (
    <View style={styles.card}>
      <QRCode value={value} size={size} color={color} backgroundColor="#FFFFFF" />
    </View>
  );
}

const styles = themedStyles(() => ({
  card: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
