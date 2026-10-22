import { useAuth } from '@/services/Firebase/useAuth';
import { fetchNotices } from '@/services/notifications/inbox';
import { runSmartChecks } from '@/services/notifications/smartChecks';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

let checkedFor = '';

/** How many notices the user has not opened yet; refreshed whenever the screen is focused. */
export function useUnreadCount(): number {
  const { currentUser } = useAuth();
  const [count, setCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!currentUser) return;
      const uid = currentUser.uid;
      // The checks look at every trip, so they run once per app session per user.
      const ready = checkedFor === uid ? Promise.resolve() : runSmartChecks(uid);
      checkedFor = uid;
      ready
        .then(() => fetchNotices(uid))
        .then((list) => setCount(list.filter((n) => !n.read).length))
        .catch(() => {});
    }, [currentUser]),
  );

  return count;
}
