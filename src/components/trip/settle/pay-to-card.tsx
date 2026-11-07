import { BrandColors, Spacing } from '@/constants/theme';
import { fetchTripPayDetails } from '@/services/Firebase/payDetailsService';
import { formatPayNumber, PayMethod, payMethodTitle } from '@/utils/payDetails';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { Check, Copy, QrCode, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

interface PayToCardProps {
  tripId: string;
  payeeId: string;
  /** "Kim": who is being paid. */
  payeeLabel: string;
}

/**
 * How the person being paid likes to receive money, from their profile: each
 * number with a Copy button, and their QR to scan. Shows nothing when they
 * have not added any.
 */
export function PayToCard({ tripId, payeeId, payeeLabel }: PayToCardProps) {
  const [methods, setMethods] = useState<PayMethod[]>([]);
  const [copiedId, setCopiedId] = useState('');
  const [qr, setQr] = useState('');

  useEffect(() => {
    let active = true;
    setMethods([]);
    if (tripId && payeeId) {
      fetchTripPayDetails(tripId, payeeId).then((found) => active && setMethods(found));
    }
    return () => {
      active = false;
    };
  }, [tripId, payeeId]);

  if (!methods.length) return null;

  const copy = async (method: PayMethod) => {
    try {
      await Clipboard.setStringAsync(method.number.replace(/\s+/g, ''));
      setCopiedId(method.id);
      setTimeout(() => setCopiedId(''), 1500);
    } catch (err) {
      console.warn('Could not copy:', err);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>How {payeeLabel} likes to be paid</Text>
      <View style={styles.card}>
        {methods.map((method, index) => (
          <View key={method.id} style={[styles.row, index > 0 && styles.rowBorder]}>
            <View style={styles.text}>
              <Text style={styles.kind}>{payMethodTitle(method)}</Text>
              {!!method.number && <Text style={styles.number}>{formatPayNumber(method)}</Text>}
              {!!method.accountName && <Text style={styles.name}>{method.accountName}</Text>}
            </View>
            {!!method.qrUrl && (
              <Pressable
                style={styles.button}
                onPress={() => setQr(method.qrUrl ?? '')}
                accessibilityRole="button"
                accessibilityLabel={`Show ${payeeLabel}'s ${payMethodTitle(method)} QR`}
              >
                <QrCode size={14} color={BrandColors.primary} />
                <Text style={styles.buttonText}>QR</Text>
              </Pressable>
            )}
            {!!method.number && (
              <Pressable
                style={styles.button}
                onPress={() => copy(method)}
                accessibilityRole="button"
                accessibilityLabel={`Copy ${payMethodTitle(method)} number`}
              >
                {copiedId === method.id ? (
                  <Check size={14} color={BrandColors.success} />
                ) : (
                  <Copy size={14} color={BrandColors.primary} />
                )}
                <Text style={styles.buttonText}>{copiedId === method.id ? 'Copied' : 'Copy'}</Text>
              </Pressable>
            )}
          </View>
        ))}
      </View>
      <Text style={styles.hint}>
        Check the name before sending. Then record the payment here, with a screenshot as proof.
      </Text>

      <Modal visible={!!qr} transparent animationType="fade" onRequestClose={() => setQr('')}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setQr('')} accessible={false} />
          <View style={styles.qrCard}>
            <Image source={{ uri: qr }} style={styles.qrImage} contentFit="contain" />
            <Pressable
              style={styles.close}
              onPress={() => setQr('')}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <X size={18} color={BrandColors.primary} />
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  title: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: BrandColors.primary },
  card: {
    backgroundColor: BrandColors.inputField,
    borderRadius: 15,
    paddingHorizontal: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BrandColors.border },
  text: { flex: 1, gap: 1 },
  kind: { fontFamily: 'PlusJakartaSans-Medium', fontSize: 12, color: BrandColors.secondary },
  number: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 16, color: BrandColors.primary },
  name: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 12, color: BrandColors.primary },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    backgroundColor: BrandColors.base200,
    borderRadius: 10,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },
  buttonText: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 12, color: BrandColors.primary },
  hint: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 12, color: BrandColors.secondary },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  qrCard: {
    width: '100%',
    maxWidth: 360,
    aspectRatio: 0.8,
    backgroundColor: BrandColors.background,
    borderRadius: 20,
    padding: Spacing.three,
  },
  qrImage: { flex: 1 },
  close: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    backgroundColor: BrandColors.inputField,
    borderRadius: 16,
    padding: Spacing.one,
  },
});
