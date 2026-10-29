import BackButton from '@/components/Button/back-button';
import PrimaryButton from '@/components/Button/primary-button';
import ChangePasswordSheet from '@/components/profile/change-password-sheet';
import DeleteAccountSheet from '@/components/profile/delete-account-sheet';
import EditProfileSheet from '@/components/profile/edit-profile-sheet';
import Avatar from '@/components/ui/avatar';
import BigButtonOptions from '@/components/ui/big-button-options';
import BottomSheet from '@/components/ui/bottom-sheet';
import { HelperText } from '@/components/ui/card';
import SyncStatusCard from '@/components/ui/sync-status-card';
import ConfirmSheet from '@/components/ui/confirm-sheet';
import { SettingsRow, SettingsSection } from '@/components/settings/settings-rows';
import { currencies } from '@/constants/currencies';
import { BrandColors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/services/Firebase/useAuth';
import { getUserData, saveDefaultCurrency } from '@/services/Firebase/userService';
import { cacheSize, clearCache } from '@/services/offline/offlineStore';
import {
  DEFAULT_PREFS,
  NoticeType,
  NotificationPrefs,
  fetchPrefs,
} from '@/services/notifications/inbox';
import { handleLogout } from '@/utils/logout';
import { formatBytes } from '@/utils/format';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import {
  Bell,
  ChevronRight,
  CircleHelp,
  Coins,
  Database,
  KeyRound,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const router = useRouter();
  const { currentUser } = useAuth();

  const [profileOpen, setProfileOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [currency, setCurrency] = useState('PHP');
  const [notice, setNotice] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [cacheOpen, setCacheOpen] = useState(false);
  const [cacheBytes, setCacheBytes] = useState<number | null>(null);
  const [cacheEntries, setCacheEntries] = useState(0);
  const [clearing, setClearing] = useState(false);
  const [, setVersion] = useState(0);

  // Reading the saved copies walks every entry, so it is done once on open and
  // again after a clear, never during a render.
  const readCacheSize = () => {
    cacheSize()
      .then(({ bytes, entries }) => {
        setCacheBytes(bytes);
        setCacheEntries(entries);
      })
      .catch((err) => console.warn('Could not measure the saved data:', err));
  };

  useEffect(readCacheSize, []);

  const handleClearCache = async () => {
    setClearing(true);
    const { cleared, keptWrites } = await clearCache();
    setClearing(false);
    setCacheOpen(false);
    readCacheSize();
    setNotice(
      keptWrites > 0
        ? `Cleared ${cleared} saved ${cleared === 1 ? 'item' : 'items'}. ${keptWrites} unsent ${keptWrites === 1 ? 'change is' : 'changes are'} still waiting to be sent.`
        : `Cleared ${cleared} saved ${cleared === 1 ? 'item' : 'items'}.`,
    );
  };

  const canChangePassword = !!currentUser?.providerData?.some(
    (provider) => provider.providerId === 'password',
  );

  useEffect(() => {
    if (!currentUser) return;
    fetchPrefs(currentUser.uid)
      .then(setPrefs)
      .catch((err) => console.warn('Could not read notification settings:', err));
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    getUserData<{ currency?: string }>(currentUser.uid)
      .then((data) => data?.currency && setCurrency(data.currency))
      .catch((err) => console.warn('Could not read the default currency:', err));
  }, [currentUser]);

  const flash = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(''), 3000);
  };

  const chooseCurrency = async (value: string) => {
    const previous = currency;
    setCurrency(value);
    setCurrencyOpen(false);
    try {
      await saveDefaultCurrency(value);
      flash('Default currency saved.');
    } catch (err) {
      console.error('Failed to save the default currency:', err);
      setCurrency(previous);
      flash('Could not save the default currency.');
    }
  };

  const onLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await handleLogout();
    } catch (err) {
      console.error('Log out failed:', err);
      setLoggingOut(false);
    }
  };

  const currencyName = currencies.find((entry) => entry.value === currency)?.name ?? currency;

  // A one-line answer to "will I be told?", so the row says something useful.
  const types = Object.keys(DEFAULT_PREFS) as NoticeType[];
  const onCount = types.filter((type) => prefs[type]).length;
  const notifySummary =
    onCount === 0
      ? 'All off'
      : onCount === types.length
        ? 'All on'
        : `${onCount} of ${types.length} on`;

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <Pressable
            style={styles.userCard}
            onPress={() => setProfileOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
          >
            <Avatar
              name={currentUser?.displayName || currentUser?.email || '?'}
              size={56}
              photoURL={currentUser?.photoURL ?? undefined}
            />
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{currentUser?.displayName || 'User'}</Text>
              {!!currentUser?.email && <Text style={styles.userEmail}>{currentUser.email}</Text>}
            </View>
            <ChevronRight size={18} color={BrandColors.secondary} />
          </Pressable>

          {!!notice && <HelperText tone="success">{notice}</HelperText>}

          <SettingsSection title="Account">
            <SettingsRow
              icon={UserRound}
              label="Edit profile"
              hint="Your name and photo"
              onPress={() => setProfileOpen(true)}
            />
            <SettingsRow
              icon={Coins}
              label="Default currency"
              hint="What new trips start with"
              value={currency}
              onPress={() => setCurrencyOpen(true)}
            />
            {canChangePassword && (
              <SettingsRow
                icon={KeyRound}
                label="Change password"
                onPress={() => setPasswordOpen(true)}
              />
            )}
          </SettingsSection>

          <SettingsSection title="Preferences">
            <SettingsRow
              icon={Bell}
              label="Notifications"
              hint="Choose what reaches you, and how"
              value={notifySummary}
              onPress={() => router.push('/settings/notifications' as any)}
            />
          </SettingsSection>

          <SettingsSection title="Data">
            <SyncStatusCard />
            <SettingsRow
              icon={Sparkles}
              label="Saved offline data"
              hint="Copies of trips kept on this phone so they open without a signal"
              value={cacheBytes === null ? '—' : `${formatBytes(cacheBytes)}`}
              onPress={() => setCacheOpen(true)}
            />
          </SettingsSection>

          <SettingsSection title="About">
            <SettingsRow
              icon={CircleHelp}
              label="How TripSplit works"
              hint="Splitting, settling up, and privacy"
              onPress={() => router.push('/settings/about' as any)}
            />
            <SettingsRow
              icon={ShieldCheck}
              label="Privacy and your data"
              hint="What is stored, and who can see it"
              onPress={() => router.push('/settings/privacy' as any)}
            />
            <SettingsRow
              icon={Database}
              label="App version"
              value={Constants.expoConfig?.version ?? '1.0.0'}
              onPress={() => {}}
            />
          </SettingsSection>

          <PrimaryButton
            title={loggingOut ? 'Logging out…' : 'Log out'}
            onPress={onLogout}
            buttonColor={BrandColors.errorBg}
            textColor={BrandColors.error}
            borderColor={BrandColors.error}
            borderWidth={1}
            disabled={loggingOut}
          />
          {canChangePassword && (
            <SettingsRow icon={Trash2} label="Delete account" onPress={() => setDeleteOpen(true)} />
          )}
        </View>
      </ScrollView>

      <ConfirmSheet
        visible={cacheOpen}
        title="Clear saved data?"
        message={
          cacheEntries === 0
            ? 'Nothing is saved on this phone right now, so there is nothing to clear.'
            : `This frees about ${formatBytes(cacheBytes ?? 0)} by removing the offline copies of your trips. They download again next time you open each one. Anything you changed while offline is kept and still gets sent.`
        }
        confirmLabel={cacheEntries === 0 ? 'Close' : 'Clear saved data'}
        icon="delete"
        busy={clearing}
        onConfirm={() => (cacheEntries === 0 ? setCacheOpen(false) : handleClearCache())}
        onCancel={() => setCacheOpen(false)}
      />

      <DeleteAccountSheet visible={deleteOpen} onClose={() => setDeleteOpen(false)} />

      <EditProfileSheet
        visible={profileOpen}
        onClose={() => setProfileOpen(false)}
        onSaved={() => {
          setVersion((value) => value + 1);
          flash('Profile saved.');
        }}
      />
      <ChangePasswordSheet
        visible={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        onChanged={() => flash('Password updated.')}
      />
      <BottomSheet
        visible={currencyOpen}
        title="Default currency"
        onClose={() => setCurrencyOpen(false)}
      >
        <HelperText>New trips start with {currencyName}.</HelperText>
        <BigButtonOptions
          choices={currencies}
          selectedValue={currency}
          onSelect={(choice) => chooseCurrency(choice.value)}
          maxHeight={360}
        />
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: BrandColors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  headerTitle: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 22, color: BrandColors.primary },
  scrollContent: { paddingBottom: 60, alignItems: 'center' },
  container: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingTop: Spacing.three,
    paddingHorizontal: 25,
    gap: Spacing.four,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: BrandColors.surfaceAlt,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 15,
    padding: Spacing.four,
  },
  userInfo: { flex: 1, gap: Spacing.half },
  userName: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 18, color: BrandColors.primary },
  userEmail: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 14, color: BrandColors.secondary },
});
