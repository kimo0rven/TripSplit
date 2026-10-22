import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const KEY = 'tripsplit.weeklyReminder';

export const remindersSupported = Platform.OS !== 'web';

export async function isWeeklyReminderOn(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEY)) === '1';
}

/** Returns false when the user refuses notification permission. */
export async function setWeeklyReminder(on: boolean): Promise<boolean> {
  if (!remindersSupported) return false;
  const stored = await AsyncStorage.getItem(KEY + '.id');
  if (stored) await Notifications.cancelScheduledNotificationAsync(stored).catch(() => {});

  if (!on) {
    await AsyncStorage.multiRemove([KEY, KEY + '.id']);
    return true;
  }

  const current = await Notifications.getPermissionsAsync();
  const granted =
    current.granted || (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) return false;

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Any trip payments to settle?',
      body: 'Open TripSplit to check who owes what.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 2,
      hour: 18,
      minute: 0,
    },
  });
  await AsyncStorage.multiSet([[KEY, '1'], [KEY + '.id', id]]);
  return true;
}
