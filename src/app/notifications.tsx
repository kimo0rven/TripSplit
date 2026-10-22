import BackButton from '@/components/Button/back-button';
import EmptyState from '@/components/ui/empty-state';
import ErrorState from '@/components/ui/error-state';
import ListSkeleton from '@/components/ui/list-skeleton';
import { BrandColors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/services/Firebase/useAuth';
import {
  Notice,
  NoticeType,
  clearNotices,
  dismissNotice,
  fetchNotices,
  markAllRead,
  markRead,
} from '@/services/notifications/inbox';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  BarChart3,
  Bell,
  CheckCircle2,
  Clock,
  CreditCard,
  LucideIcon,
  Pencil,
  Receipt,
  Repeat,
  Scale,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const ICONS: Record<NoticeType, LucideIcon> = {
  tripInvites: Users,
  friendRequests: UserPlus,
  friendAccepted: UserCheck,
  paymentRequests: CreditCard,
  paymentUpdates: CheckCircle2,
  pendingPayments: Clock,
  newExpenses: Receipt,
  expenseChanges: Pencil,
  tripActivity: Users,
  recurring: Repeat,
  budget: Wallet,
  settleUp: Scale,
  summary: BarChart3,
  reminders: Bell,
};

const ago = (iso: string): string => {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return minutes + 'm ago';
  if (minutes < 1440) return Math.round(minutes / 60) + 'h ago';
  return Math.round(minutes / 1440) + 'd ago';
};

export default function NotificationsScreen() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const uid = currentUser?.uid ?? '';
  const [notices, setNotices] = useState<Notice[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!uid) return;
    try {
      setFailed(false);
      const list = await fetchNotices(uid);
      setNotices(list);
      // Opening the inbox counts as reading it; the dots stay on this visit only.
      markAllRead(uid, list).catch(() => {});
    } catch (error) {
      console.warn('Could not load notifications:', error);
      setFailed(true);
    }
  }, [uid]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const open = (notice: Notice) => {
    markRead(uid, notice.id).catch(() => {});
    if (notice.type === 'friendRequests') router.push('/friends' as any);
    else if (notice.tripId) router.push(('/trips/' + notice.tripId) as any);
  };

  const remove = (id: string) => {
    setNotices((list) => (list ?? []).filter((n) => n.id !== id));
    dismissNotice(uid, id).catch((error) => console.warn('Could not dismiss:', error));
  };

  const clearAll = () => {
    const all = notices ?? [];
    setNotices([]);
    clearNotices(uid, all).catch((error) => console.warn('Could not clear:', error));
  };

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
        <Text style={styles.headerTitle}>Notifications</Text>
        {!!notices?.length && (
          <Pressable onPress={clearAll} accessibilityRole="button">
            <Text style={styles.clear}>Clear all</Text>
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          {failed ? (
            <ErrorState message="We couldn't load your notifications." onRetry={load} />
          ) : notices === null ? (
            <ListSkeleton rows={4} />
          ) : notices.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="You're all caught up"
              message="Trip invites, friend requests, payment requests and reminders will show up here."
              actionLabel="Notification settings"
              onAction={() => router.push('/settings' as any)}
            />
          ) : (
            notices.map((notice) => {
              const Icon = ICONS[notice.type] ?? Bell;
              return (
                <Pressable key={notice.id} style={styles.row} onPress={() => open(notice)}>
                  <View style={styles.iconCircle}>
                    <Icon size={18} color={BrandColors.primary} />
                  </View>
                  <View style={styles.text}>
                    <Text style={styles.title}>{notice.title}</Text>
                    <Text style={styles.body}>{notice.body}</Text>
                    <Text style={styles.time}>{ago(notice.createdAt)}</Text>
                  </View>
                  <Pressable
                    onPress={() => remove(notice.id)}
                    hitSlop={10}
                    accessibilityLabel="Dismiss"
                  >
                    <X size={16} color={BrandColors.secondary} />
                  </Pressable>
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: BrandColors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  headerTitle: {
    flex: 1,
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 20,
    color: BrandColors.primary,
  },
  clear: { fontFamily: 'PlusJakartaSans-Medium', fontSize: 14, color: BrandColors.secondary },
  scroll: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.five },
  container: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 16,
    backgroundColor: BrandColors.surfaceAlt,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BrandColors.base50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 2 },
  title: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: BrandColors.primary },
  body: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 13, color: BrandColors.primary },
  time: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 11, color: BrandColors.secondary },
});
