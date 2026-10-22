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
import { currencies } from '@/constants/currencies';
import { BrandColors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/services/Firebase/useAuth';
import { getUserData, saveDefaultCurrency } from '@/services/Firebase/userService';
import {
  isWeeklyReminderOn,
  remindersSupported,
  setWeeklyReminder,
} from '@/services/reminders/weeklyReminder';
import {
  DEFAULT_DELIVERY,
  DEFAULT_PREFS,
  DeliverySettings,
  NOTICE_LABELS,
  NoticeType,
  NotificationPrefs,
  fetchDelivery,
  fetchPrefs,
  saveDelivery,
  savePref,
  setTripMuted,
} from '@/services/notifications/inbox';
import { fetchUserTrips } from '@/services/Firebase/tripService';
import { Trip } from '@/types/trips';
import { handleLogout } from '@/utils/logout';
import { useRouter } from 'expo-router';
import { Bell, ChevronRight, Coins, Trash2, KeyRound, LucideIcon, UserRound } from 'lucide-react-native';
import { ReactNode, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const router = useRouter();
  const { currentUser } = useAuth();

  const [profileOpen, setProfileOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reminderOn, setReminderOn] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [currency, setCurrency] = useState('PHP');
  const [notice, setNotice] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [delivery, setDelivery] = useState<DeliverySettings>(DEFAULT_DELIVERY);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [, setVersion] = useState(0);

  const canChangePassword = !!currentUser?.providerData?.some(
    (provider) => provider.providerId === 'password',
  );

  useEffect(() => {
    if (!currentUser) return;
    fetchPrefs(currentUser.uid)
      .then(setPrefs)
      .catch((err) => console.warn('Could not read notification settings:', err));
    fetchDelivery(currentUser.uid)
      .then(setDelivery)
      .catch((err) => console.warn('Could not read delivery settings:', err));
    fetchUserTrips(currentUser.uid)
      .then(setTrips)
      .catch((err) => console.warn('Could not read trips:', err));
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    getUserData<{ currency?: string }>(currentUser.uid)
      .then((data) => data?.currency && setCurrency(data.currency))
      .catch((err) => console.warn('Could not read the default currency:', err));
  }, [currentUser]);

  useEffect(() => {
    if (remindersSupported) isWeeklyReminderOn().then(setReminderOn).catch(() => {});
  }, []);

  const toggleReminder = async () => {
    try {
      const next = !reminderOn;
      const ok = await setWeeklyReminder(next);
      if (!ok) return flash('Allow notifications to get reminders.');
      setReminderOn(next);
      flash(next ? 'Weekly reminder on.' : 'Weekly reminder off.');
    } catch (err) {
      console.warn('Could not change the reminder:', err);
      flash('Could not change the reminder.');
    }
  };

  const changePref = async (type: NoticeType, on: boolean) => {
    if (!currentUser) return;
    setPrefs((current) => ({ ...current, [type]: on }));
    try {
      await savePref(currentUser.uid, type, on);
    } catch (err) {
      console.warn('Could not save the notification setting:', err);
      setPrefs((current) => ({ ...current, [type]: !on }));
      flash('Could not save that setting.');
    }
  };

  const changeDelivery = async (patch: { push?: boolean; quiet?: boolean }) => {
    if (!currentUser) return;
    const previous = delivery;
    setDelivery({ ...delivery, ...patch });
    try {
      await saveDelivery(currentUser.uid, patch);
    } catch (err) {
      console.warn('Could not save the delivery setting:', err);
      setDelivery(previous);
      flash('Could not save that setting.');
    }
  };

  const changeMuted = async (tripId: string, muted: boolean) => {
    if (!currentUser) return;
    const previous = delivery;
    setDelivery({ ...delivery, mutedTrips: { ...delivery.mutedTrips, [tripId]: muted } });
    try {
      await setTripMuted(currentUser.uid, tripId, muted);
    } catch (err) {
      console.warn('Could not mute the trip:', err);
      setDelivery(previous);
      flash('Could not save that setting.');
    }
  };

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

  const mutedTrips = trips.filter((trip) => delivery.mutedTrips[trip.id]);

  const currencyName = currencies.find((entry) => entry.value === currency)?.name ?? currency;

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

          <Section title="Account">
            <Row icon={UserRound} label="Edit profile" onPress={() => setProfileOpen(true)} />
            <Row
              icon={Coins}
              label="Default currency"
              value={currency}
              onPress={() => setCurrencyOpen(true)}
            />
            {canChangePassword && (
              <Row icon={KeyRound} label="Change password" onPress={() => setPasswordOpen(true)} />
            )}
          </Section>

          {remindersSupported && (
            <Section title="Reminders">
              <Row
                icon={Bell}
                label="Weekly payment reminder"
                value={reminderOn ? 'On' : 'Off'}
                onPress={toggleReminder}
              />
            </Section>
          )}

          <Section title="Notifications">
            {(Object.keys(NOTICE_LABELS) as NoticeType[]).map((type) => (
              <View key={type} style={styles.row}>
                <Bell size={20} color={BrandColors.primary} />
                <View style={styles.rowText}>
                  <Text style={[styles.rowLabel, styles.rowLabelAuto]}>{NOTICE_LABELS[type].label}</Text>
                  <Text style={styles.rowHint}>{NOTICE_LABELS[type].hint}</Text>
                </View>
                <Switch
                  value={prefs[type]}
                  onValueChange={(on) => changePref(type, on)}
                  {...switchColors(prefs[type])}
                  accessibilityLabel={NOTICE_LABELS[type].label}
                />
              </View>
            ))}
          </Section>

          <Section title="Delivery">
            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Push notifications</Text>
                <Text style={styles.rowHint}>Off keeps notices in the inbox only</Text>
              </View>
              <Switch
                value={delivery.push}
                onValueChange={(on) => changeDelivery({ push: on })}
                {...switchColors(delivery.push)}
                accessibilityLabel="Push notifications"
              />
            </View>
            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Quiet hours</Text>
                <Text style={styles.rowHint}>No pushes from 10 PM to 7 AM</Text>
              </View>
              <Switch
                value={delivery.quiet}
                onValueChange={(on) => changeDelivery({ quiet: on })}
                {...switchColors(delivery.quiet)}
                accessibilityLabel="Quiet hours"
              />
            </View>
          </Section>

          {mutedTrips.length > 0 && (
            <Section title="Muted trips">
              {mutedTrips.map((trip) => (
                <View key={trip.id} style={styles.row}>
                  <View style={styles.rowText}>
                    <Text style={styles.rowLabel}>{trip.name}</Text>
                    <Text style={styles.rowHint}>Mute a trip from its page with the bell</Text>
                  </View>
                  <Pressable onPress={() => changeMuted(trip.id, false)} accessibilityRole="button">
                    <Text style={styles.rowValue}>Unmute</Text>
                  </Pressable>
                </View>
              ))}
            </Section>
          )}

          <Section title="Data">
            <SyncStatusCard />
          </Section>

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
            <Row icon={Trash2} label="Delete account" onPress={() => setDeleteOpen(true)} />
          )}
        </View>
      </ScrollView>
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

const switchColors = (on: boolean) => ({
  trackColor: { false: BrandColors.border, true: BrandColors.base400 },
  thumbColor: on ? BrandColors.base50 : BrandColors.background,
  // React Native Web ignores thumbColor when on and falls back to teal.
  activeThumbColor: BrandColors.base50,
});

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Row({
  icon: Icon,
  label,
  value,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  value?: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress} accessibilityRole="button">
      <Icon size={20} color={BrandColors.primary} />
      <Text style={styles.rowLabel}>{label}</Text>
      {!!value && <Text style={styles.rowValue}>{value}</Text>}
      <ChevronRight size={18} color={BrandColors.secondary} />
    </Pressable>
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
  section: { gap: Spacing.two },
  sectionTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    color: BrandColors.secondary,
    textTransform: 'uppercase',
  },
  sectionBody: { gap: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: BrandColors.surfaceAlt,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 15,
    padding: Spacing.four,
  },
  rowLabel: {
    flex: 1,
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 15,
    color: BrandColors.primary,
  },
  rowLabelAuto: { flex: 0 },
  rowText: { flex: 1, gap: 2 },
  rowHint: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 12, color: BrandColors.secondary },
  rowValue: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 14, color: BrandColors.secondary },
});
