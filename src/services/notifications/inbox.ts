import { auth } from '@/config/firebase';
import { newId, readPath, removeAt, writeAt, writeUpdates } from '@/services/offline/offlineStore';
import { callServer, hasServer } from '@/services/server/appServer';

export type NoticeType =
  | 'tripInvites'
  | 'friendRequests'
  | 'friendAccepted'
  | 'paymentRequests'
  | 'paymentUpdates'
  | 'pendingPayments'
  | 'newExpenses'
  | 'expenseChanges'
  | 'tripActivity'
  | 'recurring'
  | 'budget'
  | 'settleUp'
  | 'summary'
  | 'reminders';

export interface Notice {
  id: string;
  type: NoticeType;
  title: string;
  body: string;
  from: string;
  tripId?: string;
  /** The trip it is about, for the rules, even when it doesn't link there. */
  about?: string;
  createdAt: string;
  read?: boolean;
}

export type NotificationPrefs = Record<NoticeType, boolean>;

export const NOTICE_LABELS: Record<NoticeType, { label: string; hint: string }> = {
  tripInvites: { label: 'Trip invites', hint: 'When someone adds you to a trip' },
  friendRequests: { label: 'Friend requests', hint: 'When someone wants to be your friend' },
  friendAccepted: { label: 'Friend request accepted', hint: 'When someone accepts your request' },
  paymentRequests: { label: 'Payment requests', hint: 'When someone says they paid you' },
  paymentUpdates: { label: 'Payment confirmed or declined', hint: 'When your payment is answered' },
  pendingPayments: { label: 'Unconfirmed payments', hint: 'A nudge if a payment waits for you' },
  newExpenses: { label: 'New expenses', hint: 'When an expense includes you' },
  expenseChanges: {
    label: 'Expense edits and deletes',
    hint: 'When an expense you are in changes',
  },
  tripActivity: { label: 'Trip members', hint: 'Joins, requests to join, or you were removed' },
  recurring: { label: 'Recurring expenses', hint: 'When a repeating expense is added' },
  budget: { label: 'Budget warnings', hint: 'At 80% and 100% of a trip budget' },
  settleUp: { label: 'Settle-up nudges', hint: 'Open balances on a quiet trip' },
  summary: { label: 'Weekly summary', hint: 'What you owe and are owed' },
  reminders: { label: 'Reminders', hint: 'When a friend nudges you about money you owe' },
};

export const DEFAULT_PREFS: NotificationPrefs = Object.fromEntries(
  (Object.keys(NOTICE_LABELS) as NoticeType[]).map((type) => [type, true]),
) as NotificationPrefs;

export interface DeliverySettings {
  /** Phone pushes on top of the in-app inbox. */
  push: boolean;
  /** No pushes between 10 PM and 7 AM; notices still land in the inbox. */
  quiet: boolean;
  /** The user's UTC offset in minutes, so a sender can tell when it is night for them. */
  tz: number;
  mutedTrips: Record<string, boolean>;
}

export const DEFAULT_DELIVERY: DeliverySettings = {
  push: true,
  quiet: false,
  tz: 0,
  mutedTrips: {},
};

/**
 * Each person's own settings live under `userPrivate`, which only they can
 * read. Nobody else can see their push token, quiet hours or muted trips.
 */
export const privatePath = (uid: string, key: string) => 'userPrivate/' + uid + '/' + key;

const deliveryPath = (uid: string) => privatePath(uid, 'notificationSettings');

export async function fetchDelivery(uid: string): Promise<DeliverySettings> {
  const stored = (await readPath(deliveryPath(uid), {
    preferCache: false,
  })) as Partial<DeliverySettings> | null;
  return { ...DEFAULT_DELIVERY, ...(stored ?? {}), mutedTrips: stored?.mutedTrips ?? {} };
}

export async function saveDelivery(
  uid: string,
  patch: { push?: boolean; quiet?: boolean },
): Promise<void> {
  await writeUpdates({
    ...(patch.push !== undefined ? { [deliveryPath(uid) + '/push']: patch.push } : {}),
    ...(patch.quiet !== undefined ? { [deliveryPath(uid) + '/quiet']: patch.quiet } : {}),
    [deliveryPath(uid) + '/tz']: -new Date().getTimezoneOffset(),
  });
}

export async function setTripMuted(uid: string, tripId: string, muted: boolean): Promise<void> {
  await writeUpdates({ [deliveryPath(uid) + '/mutedTrips/' + tripId]: muted ? true : null });
}

const prefsPath = (uid: string) => privatePath(uid, 'notificationPrefs');

export async function fetchPrefs(uid: string): Promise<NotificationPrefs> {
  const stored = (await readPath(prefsPath(uid), {
    preferCache: false,
  })) as Partial<NotificationPrefs> | null;
  return { ...DEFAULT_PREFS, ...(stored ?? {}) };
}

export async function savePref(uid: string, type: NoticeType, on: boolean): Promise<void> {
  await writeUpdates({ [prefsPath(uid) + '/' + type]: on });
}

/**
 * Leaves a notice in someone's inbox (and pushes it to their phone) unless they
 * turned that kind off. Never throws: a missed notice must not fail the action
 * that triggered it.
 */
/**
 * What happened to a notice: 'pushed' reached their phone, 'inbox' only waits in
 * their inbox, 'off' they switched that kind (or the trip) off, 'failed' broke.
 */
export type NotifyResult = 'pushed' | 'inbox' | 'off' | 'failed';

export async function notify(
  toUserId: string,
  type: NoticeType,
  title: string,
  body: string,
  options: {
    tripId?: string;
    /**
     * The trip a notice is about when it shouldn't link there (a trip that
     * was deleted, or one they were removed from). The database rules use it
     * to check the sender and the person share that trip.
     */
    about?: string;
    push?: boolean;
    id?: string;
  } = {},
): Promise<NotifyResult> {
  const me = auth.currentUser?.uid;
  if (!me || !toUserId) return 'failed';
  try {
    const about = options.about ?? options.tripId;
    const notice: Notice = {
      id: options.id || newId(),
      type,
      title,
      body,
      from: me,
      ...(options.tripId ? { tripId: options.tripId } : {}),
      ...(about ? { about } : {}),
      createdAt: new Date().toISOString(),
      read: false,
    };
    await writeAt('notifications/' + toUserId + '/' + notice.id, notice);

    // Their push token and settings are private, so the server sends the push.
    // It reads the notice just written, so it can only push what the rules let in.
    const wantsPush = options.push !== false && toUserId !== me;
    if (wantsPush && hasServer()) {
      const { status } = await callServer<{ status: NotifyResult }>('/push', {
        to: toUserId,
        noticeId: notice.id,
      }).catch(() => ({ status: 'inbox' as NotifyResult }));
      return status;
    }
    return 'inbox';
  } catch (error) {
    console.warn('Could not send a notification:', error);
    return 'failed';
  }
}

/** Notifies several people at once, never the person who caused it. */
export async function notifyMany(
  userIds: string[],
  type: NoticeType,
  title: string,
  body: string,
  options: { tripId?: string; about?: string } = {},
): Promise<void> {
  const me = auth.currentUser?.uid;
  const others = [...new Set(userIds)].filter((id) => id && id !== me);
  await Promise.all(others.map((id) => notify(id, type, title, body, options)));
}

/** The trip's name and currency, for writing a notice about it. */
export async function tripLabel(tripId: string): Promise<{ name: string; currency: string }> {
  const [name, currency] = await Promise.all([
    readPath('trips/' + tripId + '/name'),
    readPath('trips/' + tripId + '/currency'),
  ]);
  return { name: (name as string) || 'a trip', currency: (currency as string) || 'PHP' };
}

export const myName = (): string => auth.currentUser?.displayName || 'Someone';

export async function fetchNotices(uid: string): Promise<Notice[]> {
  if (!uid) return [];
  const [value, prefs, delivery] = await Promise.all([
    readPath('notifications/' + uid, { preferCache: false }),
    fetchPrefs(uid),
    fetchDelivery(uid),
  ]);
  // Anyone sharing a trip can leave a notice; the ones they turned off stay hidden.
  return Object.values((value ?? {}) as Record<string, Notice>)
    .filter((notice) => prefs[notice.type] !== false)
    .filter((notice) => !(notice.tripId && delivery.mutedTrips[notice.tripId]))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function markAllRead(uid: string, notices: Notice[]): Promise<void> {
  const updates: Record<string, unknown> = {};
  notices
    .filter((n) => !n.read)
    .forEach((n) => (updates['notifications/' + uid + '/' + n.id + '/read'] = true));
  if (Object.keys(updates).length) await writeUpdates(updates);
}

export async function markRead(uid: string, id: string): Promise<void> {
  await writeUpdates({ ['notifications/' + uid + '/' + id + '/read']: true });
}

export async function dismissNotice(uid: string, id: string): Promise<void> {
  await removeAt('notifications/' + uid + '/' + id);
}

export async function clearNotices(uid: string, notices: Notice[]): Promise<void> {
  const updates: Record<string, unknown> = {};
  notices.forEach((n) => (updates['notifications/' + uid + '/' + n.id] = null));
  if (Object.keys(updates).length) await writeUpdates(updates);
}
