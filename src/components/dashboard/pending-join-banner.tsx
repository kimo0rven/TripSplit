import { BrandColors, Spacing } from '@/constants/theme';
import {
  PendingJoinCode,
  readPendingJoinCodes,
  removePendingJoinCode,
} from '@/services/joining/pendingJoinCodes';
import { isConnected, subscribeToConnection } from '@/services/offline/offlineStore';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ticket, X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { themedStyles } from '@/constants/themed-styles';

/**
 * Once the phone is back online, offers the invite code that was saved while
 * it was offline. Opening it shows the trip first, as any code does.
 */
export default function PendingJoinBanner() {
  const router = useRouter();
  const [codes, setCodes] = useState<PendingJoinCode[]>([]);
  const [online, setOnline] = useState(isConnected());

  useFocusEffect(
    useCallback(() => {
      readPendingJoinCodes().then(setCodes);
    }, []),
  );
  useEffect(() => subscribeToConnection(setOnline), []);

  const first = codes[0];
  if (!first || !online) return null;

  return (
    <View style={styles.wrap}>
      <Pressable
        style={({ pressed }) => [styles.banner, pressed && styles.pressed]}
        onPress={async () => {
          await removePendingJoinCode(first.code);
          setCodes((previous) => previous.slice(1));
          router.push({ pathname: '/trips/join', params: { code: first.code } } as any);
        }}
        accessibilityRole="button"
      >
        <Ticket size={18} color={BrandColors.onBrand} />
        <View style={styles.text}>
          <Text style={styles.title}>You’re back online</Text>
          <Text style={styles.hint}>
            Tap to look up invite code {first.code}, saved while you were offline.
          </Text>
        </View>
        <View style={styles.closeSpace} />
      </Pressable>
      <Pressable
        style={styles.close}
        onPress={async () => {
          await removePendingJoinCode(first.code);
          setCodes((previous) => previous.slice(1));
        }}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={`Forget invite code ${first.code}`}
      >
        <X size={16} color={BrandColors.secondary} />
      </Pressable>
    </View>
  );
}

const styles = themedStyles(() => ({
  wrap: { position: 'relative' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: BrandColors.base400,
    borderRadius: 12,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  pressed: { opacity: 0.7 },
  text: { flex: 1, gap: 1 },
  title: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 13, color: BrandColors.onBrand },
  hint: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 11, color: BrandColors.onBrand },
  closeSpace: { width: 16 },
  close: {
    position: 'absolute',
    right: Spacing.three,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
}));
