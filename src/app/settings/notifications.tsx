import BackButton from '@/components/Button/back-button';
import { HelperText } from '@/components/ui/card';
import { SettingsSection, SettingsToggleRow } from '@/components/settings/settings-rows';
import { BrandColors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/services/Firebase/useAuth';
import { shortName } from '@/utils/format';
import { fetchUserTrips } from '@/services/Firebase/tripService';
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
import { Trip } from '@/types/trips';
import { useRouter } from 'expo-router';
import {
  BarChart3,
  Bell,
  CreditCard,
  Pencil,
  Receipt,
  Repeat,
  Scale,
  UserPlus,
  Users,
  Wallet,
  LucideIcon,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * The switches are grouped by what they are about, because fourteen in one
 * list is a wall nobody reads. Each group is a plain heading over rows.
 */
const GROUPS: { title: string; items: NoticeType[] }[] = [
  { title: 'Trips', items: ['tripInvites', 'tripActivity', 'newExpenses', 'expenseChanges'] },
  {
    title: 'Money',
    items: [
      'paymentRequests',
      'paymentUpdates',
      'pendingPayments',
      'settleUp',
      'reminders',
      'budget',
      'recurring',
    ],
  },
  { title: 'Friends', items: ['friendRequests', 'friendAccepted'] },
  { title: 'Summaries', items: ['summary'] },
];

/** An icon per switch, so a row is recognisable before you read it. */
const ICONS: Partial<Record<NoticeType, LucideIcon>> = {
  tripInvites: Users,
  tripActivity: Users,
  newExpenses: Receipt,
  expenseChanges: Pencil,
  paymentRequests: CreditCard,
  pendingPayments: CreditCard,
  reminders: Bell,
  budget: Wallet,
  recurring: Repeat,
  settleUp: Scale,
  friendRequests: UserPlus,
  summary: BarChart3,
};

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const { currentUser } = useAuth();

  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [delivery, setDelivery] = useState<DeliverySettings>(DEFAULT_DELIVERY);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [reminderOn, setReminderOn] = useState(false);
  const [notice, setNotice] = useState('');

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
    if (remindersSupported)
      isWeeklyReminderOn()
        .then(setReminderOn)
        .catch(() => {});
  }, []);

  const flash = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(''), 3000);
  };

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

  const mutedTrips = trips.filter((trip) => delivery.mutedTrips[trip.id]);

  const allOff = (Object.keys(NOTICE_LABELS) as NoticeType[]).every((type) => !prefs[type]);

  /** One switch to silence everything, or bring it all back. */
  const toggleAll = async () => {
    const next = allOff;
    const types = Object.keys(NOTICE_LABELS) as NoticeType[];
    setPrefs(Object.fromEntries(types.map((type) => [type, next])) as NotificationPrefs);
    try {
      await Promise.all(types.map((type) => savePref(currentUser!.uid, type, next)));
      flash(next ? 'All notifications on.' : 'All notifications off.');
    } catch (err) {
      console.warn('Could not save the notification settings:', err);
      flash('Could not save that setting.');
      setPrefs(await fetchPrefs(currentUser!.uid));
    }
  };

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <Pressable
            style={styles.inboxRow}
            onPress={() => router.push('/notifications' as any)}
            accessibilityRole="button"
            accessibilityLabel="Open your notification inbox"
          >
            <Bell size={20} color={BrandColors.primary} />
            <View style={styles.inboxText}>
              <Text style={styles.inboxTitle}>Your inbox</Text>
              <Text style={styles.inboxHint}>Everything that has happened so far</Text>
            </View>
            <Text style={styles.inboxLink}>Open</Text>
          </Pressable>

          {!!notice && <HelperText tone="success">{notice}</HelperText>}

          <SettingsSection title="Everything">
            <SettingsToggleRow
              icon={Bell}
              label={allOff ? 'Turn all notifications on' : 'Turn all notifications off'}
              hint={
                allOff
                  ? 'Nothing is being sent to you right now'
                  : 'One switch to silence the lot, and to bring it back'
              }
              value={!allOff}
              onValueChange={toggleAll}
            />
          </SettingsSection>

          {GROUPS.map((group) => (
            <SettingsSection key={group.title} title={group.title}>
              {group.items.map((type) => (
                <SettingsToggleRow
                  key={type}
                  icon={ICONS[type]}
                  label={NOTICE_LABELS[type].label}
                  hint={NOTICE_LABELS[type].hint}
                  value={prefs[type]}
                  onValueChange={(on) => changePref(type, on)}
                />
              ))}
            </SettingsSection>
          ))}

          <SettingsSection title="How they arrive">
            <SettingsToggleRow
              label="Push notifications"
              hint="Off keeps notices in the inbox only"
              value={delivery.push}
              onValueChange={(on) => changeDelivery({ push: on })}
            />
            <SettingsToggleRow
              label="Quiet hours"
              hint="No pushes from 10 PM to 7 AM"
              value={delivery.quiet}
              onValueChange={(on) => changeDelivery({ quiet: on })}
            />
            {remindersSupported && (
              <SettingsToggleRow
                icon={Bell}
                label="Weekly payment reminder"
                hint="A nudge every Monday at 6 PM"
                value={reminderOn}
                onValueChange={toggleReminder}
              />
            )}
          </SettingsSection>

          {mutedTrips.length > 0 && (
            <SettingsSection title="Muted trips">
              {mutedTrips.map((trip) => (
                <View key={trip.id} style={styles.mutedRow}>
                  <View style={styles.inboxText}>
                    <Text style={styles.inboxTitle}>{shortName(trip.name)}</Text>
                    <Text style={styles.inboxHint}>Mute a trip from its page with the bell</Text>
                  </View>
                  <Pressable
                    onPress={() => changeMuted(trip.id, false)}
                    accessibilityRole="button"
                    accessibilityLabel={`Unmute ${trip.name}`}
                  >
                    <Text style={styles.inboxLink}>Unmute</Text>
                  </Pressable>
                </View>
              ))}
            </SettingsSection>
          )}

          <HelperText>
            Turning something off here also hides it from your inbox. Nothing is sent by email.
          </HelperText>
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
  inboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: BrandColors.surfaceAlt,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 15,
    padding: Spacing.four,
  },
  mutedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: BrandColors.surfaceAlt,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 15,
    padding: Spacing.four,
  },
  inboxText: { flex: 1, gap: 2 },
  inboxTitle: { fontFamily: 'PlusJakartaSans-Medium', fontSize: 15, color: BrandColors.primary },
  inboxHint: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 12, color: BrandColors.secondary },
  inboxLink: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: BrandColors.base700 },
});
