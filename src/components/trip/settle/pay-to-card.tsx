import { BrandColors, Spacing } from '@/constants/theme';
import { fetchTripPayDetails } from '@/services/Firebase/payDetailsService';
import { formatPayNumber, PayMethod, payMethodTitle } from '@/utils/payDetails';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { Check, Copy, QrCode, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { themedStyles } from '@/constants/themed-styles';

interface PayToCardProps {
  tripId: string;
  payeeId: string;
  /** "Kim": who is being paid. */
  payeeLabel: string;
  /** Leaves out the closing tip, for lists that show several people. */
  compact?: boolean;
  /** Leaves out the "How Kim likes to be paid" title, where the card around it says it. */
  noTitle?: boolean;
  /** The account picked as the one the money went to, by id. */
  selectedId?: string;
  /** Makes each account pickable, as "this is where I sent it". */
  onSelect?: (method: PayMethod) => void;
  /** Hands over the accounts once they load (an empty list when there are none). */
  onLoaded?: (methods: PayMethod[]) => void;
  /** Says "you" instead of the name in the empty message, for your own accounts. */
  isYou?: boolean;
}

/**
 * How the person being paid likes to receive money, from their profile: each
 * number with a Copy button, and their QR to scan. When they have not added
 * any, says so, so the payer knows to ask them rather than wonder.
 */
export function PayToCard({
  tripId,
  payeeId,
  payeeLabel,
  compact,
  noTitle,
  selectedId,
  onSelect,
  onLoaded,
  isYou,
}: PayToCardProps) {
  const [methods, setMethods] = useState<PayMethod[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [copiedId, setCopiedId] = useState('');
  const [qr, setQr] = useState('');

  useEffect(() => {
    let active = true;
    setMethods([]);
    setLoaded(false);
    if (tripId && payeeId) {
      fetchTripPayDetails(tripId, payeeId).then((found) => {
        if (!active) return;
        setMethods(found);
        setLoaded(true);
        onLoaded?.(found);
      });
    }
    return () => {
      active = false;
    };
    // onLoaded is a callback from the parent; only a new person reloads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, payeeId]);

  if (!methods.length) {
    if (!loaded) return null;
    return (
      <Text style={styles.missing}>
        {isYou
          ? 'You haven’t added how you like to be paid yet. Add your GCash, Maya or bank details in Profile → How to pay me, so people can send money straight to you.'
          : `${payeeLabel} hasn’t added how they like to be paid yet. Ask them for their GCash, Maya or bank details, or pay in cash.`}
      </Text>
    );
  }

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
      {!noTitle && <Text style={styles.title}>How {payeeLabel} likes to be paid</Text>}
      <View style={styles.card}>
        {methods.map((method, index) => {
          const picked = !!onSelect && method.id === selectedId;
          const details = (
            <>
              {!!onSelect && (
                <View style={[styles.radio, picked && styles.radioOn]}>
                  {picked && <View style={styles.radioDot} />}
                </View>
              )}
              <View style={styles.text}>
                <Text style={styles.kind}>{payMethodTitle(method)}</Text>
                {!!method.number && <Text style={styles.number}>{formatPayNumber(method)}</Text>}
                {!!method.accountName && <Text style={styles.name}>{method.accountName}</Text>}
              </View>
            </>
          );
          return (
            // Copy and QR sit beside the pickable part, not inside it: a button
            // inside a button is invalid on the web.
            <View key={method.id} style={[styles.row, index > 0 && styles.rowBorder]}>
              {onSelect ? (
                <Pressable
                  style={styles.pick}
                  onPress={() => onSelect(method)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: picked }}
                  accessibilityLabel={`Sent to ${payMethodTitle(method)} ${formatPayNumber(method)}`}
                >
                  {details}
                </Pressable>
              ) : (
                <View style={styles.pick}>{details}</View>
              )}
              {!!method.qrUrl && (
                <Pressable
                  style={styles.button}
                  onPress={() => setQr(method.qrUrl ?? '')}
                  accessibilityRole="button"
                  accessibilityLabel={`Show ${payeeLabel}'s ${payMethodTitle(method)} QR`}
                >
                  <QrCode size={14} color={BrandColors.onBrand} />
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
                    <Copy size={14} color={BrandColors.onBrand} />
                  )}
                  <Text style={styles.buttonText}>
                    {copiedId === method.id ? 'Copied' : 'Copy'}
                  </Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </View>
      {!compact && (
        <Text style={styles.hint}>
          Check the name before sending. Then record the payment here, with a screenshot as proof.
        </Text>
      )}

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

const styles = themedStyles(() => ({
  wrap: { gap: Spacing.two },
  missing: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 17,
    color: BrandColors.secondary,
  },
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
  pick: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: BrandColors.disabled,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: BrandColors.base50 },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: BrandColors.base50 },
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
  buttonText: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 12, color: BrandColors.onBrand },
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
}));
