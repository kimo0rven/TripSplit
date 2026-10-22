import { readPath, writeUpdates } from '@/services/offline/offlineStore';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { Platform, Share } from 'react-native';
import { notify } from '@/services/notifications/inbox';
import { formatMoney } from '@/utils/money';

const supported = Platform.OS !== 'web';

if (supported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** Saves this phone's push address on the user so friends can send it a reminder. */
export async function registerPushToken(userId: string): Promise<void> {
  if (!supported || !userId) return;
  try {
    const current = await Notifications.getPermissionsAsync();
    const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted;
    if (!granted) return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const { data } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    const stored = await readPath('users/' + userId + '/pushToken');
    if (stored !== data) await writeUpdates({ ['users/' + userId + '/pushToken']: data });
  } catch (error) {
    // Push is a nicety; a phone that cannot register just gets reminders by message.
    console.warn('Could not register for push notifications:', error);
  }
}

export interface Reminder {
  debtorId: string;
  debtorName: string;
  amount: number;
  currency: string;
  tripId: string;
  tripName: string;
  fromName: string;
}

/**
 * Reminds someone they owe money through their notification settings: it lands in
 * their inbox and is pushed to their phone when they have one registered. Without
 * a push, it also opens the share sheet (or copies the
 * message on the web) so the reminder can go out another way.
 */
export async function remindDebtor(reminder: Reminder): Promise<'pushed' | 'shared' | 'declined'> {
  const money = formatMoney(reminder.amount, reminder.currency);
  const trip = reminder.tripName ? ' for ' + reminder.tripName : '';
  const first = (reminder.debtorName || 'there').split(' ')[0];
  const link = reminder.tripId ? Linking.createURL('/trips/' + reminder.tripId) : '';

  const result = await notify(
    reminder.debtorId,
    'reminders',
    'Payment reminder',
    reminder.fromName + ' reminds you that you owe ' + money + trip + '.',
    { tripId: reminder.tripId },
  );
  if (result === 'pushed') return 'pushed';
  // They switched reminders off, so do not work around it with a manual message.
  if (result === 'off') return 'declined';

  const message =
    'Hi ' + first + ', a friendly reminder: you owe ' + money + trip + '.' +
    (link ? ' Settle up: ' + link : '');
  if (Platform.OS === 'web' && !(navigator as any).share) {
    await (navigator as any).clipboard?.writeText(message);
  } else {
    await Share.share({ message });
  }
  return 'shared';
}

/** The trip a tapped notification belongs to, if any. */
export const tripIdFromNotification = (
  response: Notifications.NotificationResponse,
): string | undefined => {
  const id = response.notification.request.content.data?.tripId;
  return typeof id === 'string' && id ? id : undefined;
};
