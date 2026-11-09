import EditProfileSheet from '@/components/profile/edit-profile-sheet';
import NavBar from '@/components/Navbar/Nav';
import Avatar from '@/components/ui/avatar';
import PageHeader from '@/components/ui/page-header';
import SyncStatusCard from '@/components/ui/sync-status-card';
import { BrandColors, isDarkTheme, Spacing } from '@/constants/theme';
import { useAuth } from '@/services/Firebase/useAuth';
import { handleLogout } from '@/utils/logout';
import { fetchUserTrips } from '@/services/Firebase/tripService';
import { auth } from '@/config/firebase';
import { fetchNotices } from '@/services/notifications/inbox';
import { fetchMyPayDetails } from '@/services/Firebase/payDetailsService';
import { useCallback, useState, type ReactNode } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  BarChart3,
  Bell,
  ChevronRight,
  LogOut,
  Pencil,
  Receipt,
  Settings,
  Wallet,
  type LucideIcon,
} from 'lucide-react-native';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { themedStyles } from '@/constants/themed-styles';

interface Summary {
  trips: number;
  buddies: number;
  /** How many accounts are in "How to pay me". */
  payAccounts: number;
  unread: number;
}

/** "Since 2025", from when the account was made. */
const memberSince = (creationTime?: string) => {
  const year = creationTime ? new Date(creationTime).getFullYear() : NaN;
  return Number.isFinite(year) ? String(year) : '';
};

export default function ProfileScreen() {
  const { currentUser } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [, setVersion] = useState(0);
  const router = useRouter();
  const [summary, setSummary] = useState<Summary | null>(null);
  const uid = currentUser?.uid;

  const loadSummary = useCallback(async () => {
    if (!uid) return;
    const [trips, accounts, notices] = await Promise.all([
      fetchUserTrips(uid),
      fetchMyPayDetails(uid).catch(() => []),
      fetchNotices(uid).catch(() => []),
    ]);
    const buddies = new Set<string>();
    trips.forEach((trip) =>
      Object.keys(trip.members ?? {}).forEach((id) => id !== uid && buddies.add(id)),
    );
    setSummary({
      trips: trips.length,
      buddies: buddies.size,
      payAccounts: accounts.length,
      unread: notices.filter((notice) => !notice.read).length,
    });
  }, [uid]);

  // Refreshed each time the page shows, so a new account or a read notice counts.
  useFocusEffect(
    useCallback(() => {
      loadSummary().catch(() => {});
    }, [loadSummary]),
  );

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    // Picks up a name or photo changed on another device, then the counts.
    await auth.currentUser?.reload().catch(() => {});
    setVersion((v) => v + 1);
    await loadSummary().catch(() => {});
    setRefreshing(false);
  };

  const onLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await handleLogout();
      // No manual navigation needed - the auth guard handles it.
    } catch (error) {
      console.error('Log out failed:', error);
      setLoggingOut(false);
    }
  };

  const since = memberSince(currentUser?.metadata?.creationTime);
  const name = currentUser?.displayName || 'User';

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.container}>
          <PageHeader title="Profile" />

          {/* The banner: who you are, in the brand yellow, with your numbers. */}
          <View style={styles.hero}>
            <View style={styles.heroBlobBig} />
            <View style={styles.heroBlobSmall} />

            <Pressable
              style={({ pressed }) => [styles.heroTop, pressed && styles.pressed]}
              onPress={() => setEditOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Edit profile"
            >
              <View style={styles.avatarRing}>
                <Avatar
                  name={currentUser?.displayName || currentUser?.email || '?'}
                  size={72}
                  photoURL={currentUser?.photoURL ?? undefined}
                />
                <View style={styles.editBadge}>
                  <Pencil size={12} color={BrandColors.onBrand} strokeWidth={2.5} />
                </View>
              </View>
              <View style={styles.heroText}>
                <Text style={styles.heroName} numberOfLines={1}>
                  {name}
                </Text>
                {!!currentUser?.email && (
                  <Text style={styles.heroEmail} numberOfLines={1}>
                    {currentUser.email}
                  </Text>
                )}
                {!!since && (
                  <View style={styles.sincePill}>
                    <Text style={styles.sinceText}>Splitting since {since}</Text>
                  </View>
                )}
              </View>
            </Pressable>

            <View style={styles.statsRow}>
              <Stat value={summary?.trips} label={summary?.trips === 1 ? 'Trip' : 'Trips'} />
              <View style={styles.statDivider} />
              <Stat value={summary?.buddies} label="Travel buddies" />
            </View>
          </View>

          {/* Statistics gets its own card, so it reads as something to explore. */}
          <Pressable
            style={({ pressed }) => [styles.statsCard, pressed && styles.pressed]}
            onPress={() => router.push('/profile/statistics' as any)}
            accessibilityRole="button"
            accessibilityLabel="Statistics"
          >
            <View style={[styles.tile, styles.tileLarge, { backgroundColor: BrandColors.infoBg }]}>
              <BarChart3 size={22} color={BrandColors.info} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.statsTitle}>Your statistics</Text>
              <Text style={styles.rowHint}>Where your money went, across every trip</Text>
            </View>
            <ChevronRight size={18} color={BrandColors.secondary} />
          </Pressable>

          <Text style={styles.sectionLabel}>Money</Text>
          <View style={styles.group}>
            <MenuRow
              icon={Wallet}
              tint={BrandColors.success}
              tintBg={BrandColors.successBg}
              label="How to pay me"
              hint={
                !summary
                  ? 'GCash, Maya or bank details'
                  : summary.payAccounts > 0
                    ? `${summary.payAccounts} ${summary.payAccounts === 1 ? 'account' : 'accounts'} for people paying you`
                    : 'Not set up: add one so people can pay you'
              }
              warn={!!summary && summary.payAccounts === 0}
              onPress={() => router.push('/profile/pay-details' as any)}
            />
            <MenuRow
              icon={Receipt}
              tint={BrandColors.warning}
              tintBg={BrandColors.warningBg}
              label="Payment history"
              hint="Everything you paid and received"
              onPress={() => router.push('/profile/payments' as any)}
              divider
            />
          </View>

          <Text style={styles.sectionLabel}>App</Text>
          <View style={styles.group}>
            <MenuRow
              icon={Bell}
              tint={BrandColors.base700}
              tintBg={BrandColors.base200}
              tintOnBrand
              label="Notifications"
              hint={
                summary?.unread ? `${summary.unread} unread` : 'Your inbox of trip and payment news'
              }
              badge={summary?.unread || 0}
              onPress={() => router.push('/notifications' as any)}
            />
            <MenuRow
              icon={Settings}
              tint={BrandColors.secondary}
              tintBg={BrandColors.inputField}
              label="Settings"
              hint="Appearance, notifications, privacy"
              onPress={() => router.push('/settings' as any)}
              divider
            />
          </View>

          <SyncStatusCard />

          <Pressable
            style={({ pressed }) => [styles.logout, pressed && styles.pressed]}
            onPress={onLogout}
            disabled={loggingOut}
            accessibilityRole="button"
          >
            {loggingOut ? (
              <ActivityIndicator size="small" color={BrandColors.error} />
            ) : (
              <LogOut size={18} color={BrandColors.error} />
            )}
            <Text style={styles.logoutText}>{loggingOut ? 'Logging out…' : 'Log out'}</Text>
          </Pressable>
        </View>
      </ScrollView>
      <EditProfileSheet
        visible={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={() => setVersion((value) => value + 1)}
      />
      <NavBar />
    </>
  );
}

/** One number in the banner, with a dash while it loads. */
function Stat({ value, label }: { value?: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value ?? '–'}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MenuRow({
  icon: Icon,
  tint,
  tintBg,
  tintOnBrand,
  label,
  hint,
  warn,
  badge = 0,
  divider,
  onPress,
}: {
  icon: LucideIcon;
  tint: string;
  tintBg: string;
  /** The tile is the brand yellow in dark mode, so its icon goes dark there. */
  tintOnBrand?: boolean;
  label: string;
  hint: string;
  warn?: boolean;
  badge?: number;
  divider?: boolean;
  onPress: () => void;
}): ReactNode {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.menuRow,
        divider && styles.menuDivider,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
    >
      <View style={[styles.tile, { backgroundColor: tintBg }]}>
        <Icon
          size={18}
          color={tintOnBrand && isDarkTheme() ? BrandColors.onBrand : tint}
          strokeWidth={2.2}
        />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.menuText}>{label}</Text>
        <Text style={[styles.rowHint, warn && styles.rowHintWarn]} numberOfLines={1}>
          {hint}
        </Text>
      </View>
      {badge > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
      <ChevronRight size={18} color={BrandColors.secondary} />
    </Pressable>
  );
}

const styles = themedStyles(() => ({
  scrollContent: {
    flexGrow: 1,
    backgroundColor: BrandColors.background,
    paddingBottom: 110,
  },
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    backgroundColor: BrandColors.background,
    paddingTop: 40,
    paddingHorizontal: 25,
    gap: Spacing.three,
  },
  pressed: { opacity: 0.8 },

  hero: {
    backgroundColor: BrandColors.base50,
    borderRadius: 24,
    padding: Spacing.four,
    gap: Spacing.four,
    overflow: 'hidden',
  },
  // Two soft circles in the corner, so the banner has some depth.
  heroBlobBig: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    right: -60,
    top: -70,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  heroBlobSmall: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    right: 50,
    bottom: -45,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  avatarRing: {
    padding: 3,
    borderRadius: 42,
    backgroundColor: '#FFFFFF',
  },
  editBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: BrandColors.base50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: { flex: 1, gap: 2, alignItems: 'flex-start' },
  heroName: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 22,
    color: BrandColors.onBrand,
  },
  heroEmail: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13,
    color: BrandColors.onBrand,
    opacity: 0.75,
  },
  sincePill: {
    marginTop: Spacing.one,
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
  },
  sinceText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 11,
    color: BrandColors.onBrand,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: 16,
    paddingVertical: Spacing.three,
  },
  stat: { flex: 1, alignItems: 'center', gap: 1 },
  statDivider: { width: 1, alignSelf: 'stretch', backgroundColor: 'rgba(0,0,0,0.12)' },
  statValue: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 22,
    color: BrandColors.onBrand,
  },
  statLabel: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: BrandColors.onBrand,
    opacity: 0.75,
  },

  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: BrandColors.surfaceAlt,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 18,
    padding: Spacing.three,
  },
  statsTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 15,
    color: BrandColors.heading,
  },

  sectionLabel: {
    marginTop: Spacing.two,
    marginBottom: -Spacing.one,
    marginLeft: Spacing.one,
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: BrandColors.secondary,
  },
  group: {
    backgroundColor: BrandColors.surfaceAlt,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 18,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  menuDivider: { borderTopWidth: 1, borderTopColor: BrandColors.border },
  tile: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLarge: { width: 46, height: 46, borderRadius: 14 },
  rowText: { flex: 1, gap: 1 },
  menuText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 15,
    color: BrandColors.primary,
  },
  rowHint: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: BrandColors.secondary,
  },
  rowHintWarn: { color: BrandColors.warning, fontFamily: 'PlusJakartaSans-Medium' },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: BrandColors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 11, color: '#FFFFFF' },

  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  logoutText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 15,
    color: BrandColors.error,
  },
}));
