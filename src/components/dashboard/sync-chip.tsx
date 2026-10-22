import { BrandColors, Spacing } from '@/constants/theme';
import { useOffline } from '@/services/offline/OfflineProvider';
import { CloudOff, RefreshCw } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

/** Only visible when offline or changes are still waiting to upload. */
export default function SyncChip() {
  const { online, pendingWrites } = useOffline();
  if (online && !pendingWrites) return null;

  const Icon = online ? RefreshCw : CloudOff;
  return (
    <View style={styles.chip}>
      <Icon size={14} color={BrandColors.warning} />
      <Text style={styles.text}>
        {online
          ? `Syncing ${pendingWrites} change${pendingWrites === 1 ? '' : 's'}…`
          : 'Offline. Changes will sync when you reconnect.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: BrandColors.warningBg,
    borderRadius: 12,
    padding: Spacing.two,
  },
  text: { fontFamily: 'PlusJakartaSans-Medium', fontSize: 12, color: BrandColors.primary },
});
