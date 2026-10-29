import PrimaryButton from '@/components/Button/primary-button';
import EditProfileSheet from '@/components/profile/edit-profile-sheet';
import NavBar from '@/components/Navbar/Nav';
import Avatar from '@/components/ui/avatar';
import PageHeader from '@/components/ui/page-header';
import SyncStatusCard from '@/components/ui/sync-status-card';
import { BrandColors, Spacing } from '@/constants/theme';
import { useAuth } from '@/services/Firebase/useAuth';
import { handleLogout } from '@/utils/logout';
import { fetchUserTrips } from '@/services/Firebase/tripService';
import { auth } from '@/config/firebase';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { BarChart3, Bell, ChevronRight, Pencil, Receipt, Settings } from 'lucide-react-native';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function ProfileScreen() {
  const { currentUser } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [, setVersion] = useState(0);
  const router = useRouter();
  const [summary, setSummary] = useState<{ trips: number; buddies: number } | null>(null);
  const uid = currentUser?.uid;

  const loadSummary = useCallback(async () => {
    if (!uid) return;
    const trips = await fetchUserTrips(uid);
    const buddies = new Set<string>();
    trips.forEach((trip) =>
      Object.keys(trip.members ?? {}).forEach((id) => id !== uid && buddies.add(id)),
    );
    setSummary({ trips: trips.length, buddies: buddies.size });
  }, [uid]);

  useEffect(() => {
    loadSummary().catch(() => {});
  }, [loadSummary]);

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

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.container}>
          <PageHeader title="Profile" />

          <Pressable
            style={styles.userCard}
            onPress={() => setEditOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
          >
            {/* The same avatar the rest of the app draws, so your own face
                matches how friends see you in a list. */}
            <Avatar
              name={currentUser?.displayName || currentUser?.email || '?'}
              size={64}
              photoURL={currentUser?.photoURL ?? undefined}
            />
            <View style={styles.userInfo}>
              <Text style={styles.userName} numberOfLines={1}>
                {currentUser?.displayName || 'User'}
              </Text>
              {!!currentUser?.email && (
                <Text style={styles.userEmail} numberOfLines={1}>
                  {currentUser.email}
                </Text>
              )}
            </View>
            <View style={styles.editIcon}>
              <Pencil size={14} color={BrandColors.primary} />
            </View>
          </Pressable>

          <View style={styles.summaryRow}>
            {summary && (
              <>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{summary.trips}</Text>
                  <Text style={styles.summaryLabel}>{summary.trips === 1 ? 'Trip' : 'Trips'}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{summary.buddies}</Text>
                  <Text style={styles.summaryLabel}>Travel buddies</Text>
                </View>
              </>
            )}
            <Pressable
              style={styles.summaryItem}
              onPress={() => router.push('/profile/statistics' as any)}
              accessibilityRole="button"
              accessibilityLabel="Statistics"
            >
              <BarChart3 size={22} color={BrandColors.primary} />
              <Text style={styles.summaryLabel}>Statistics</Text>
            </Pressable>
          </View>

          <Pressable
            style={styles.menuRow}
            onPress={() => router.push('/notifications' as any)}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
          >
            <Bell size={20} color={BrandColors.primary} />
            <Text style={styles.menuText}>Notifications</Text>
            <ChevronRight size={18} color={BrandColors.secondary} />
          </Pressable>

          <Pressable
            style={styles.menuRow}
            onPress={() => router.push('/profile/payments' as any)}
            accessibilityRole="button"
            accessibilityLabel="Payment history"
          >
            <Receipt size={20} color={BrandColors.primary} />
            <Text style={styles.menuText}>Payment history</Text>
            <ChevronRight size={18} color={BrandColors.secondary} />
          </Pressable>

          <Pressable
            style={styles.menuRow}
            onPress={() => router.push('/settings' as any)}
            accessibilityRole="button"
            accessibilityLabel="Settings"
          >
            <Settings size={20} color={BrandColors.primary} />
            <Text style={styles.menuText}>Settings</Text>
            <ChevronRight size={18} color={BrandColors.secondary} />
          </Pressable>

          <SyncStatusCard />

          <PrimaryButton
            title={loggingOut ? 'Logging out…' : 'Log out'}
            onPress={onLogout}
            buttonColor={BrandColors.errorBg}
            textColor={BrandColors.error}
            borderColor={BrandColors.error}
            borderWidth={1}
            disabled={loggingOut}
          />
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

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    backgroundColor: BrandColors.background,
    paddingBottom: 100,
  },
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    backgroundColor: BrandColors.background,
    paddingTop: 40,
    paddingHorizontal: 25,
    gap: Spacing.three,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: BrandColors.surfaceAlt,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 15,
    padding: Spacing.three,
  },
  editIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BrandColors.border,
    backgroundColor: BrandColors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: BrandColors.surfaceAlt,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 15,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  summaryRow: { flexDirection: 'row', gap: Spacing.three },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: BrandColors.surfaceAlt,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 15,
    paddingVertical: Spacing.three,
  },
  summaryValue: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 22,
    color: BrandColors.primary,
  },
  summaryLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: BrandColors.secondary,
  },
  menuText: {
    flex: 1,
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 15,
    color: BrandColors.primary,
  },
  userInfo: {
    flex: 1,
    alignItems: 'flex-start',
    gap: Spacing.half,
  },
  userName: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 18,
    color: BrandColors.primary,
  },
  userEmail: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    color: BrandColors.secondary,
  },
});
