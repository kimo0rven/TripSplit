import { DEFAULT_TRIP_COLOR } from '@/constants/trip-colors';
import { DEFAULT_TRIP_ICON } from '@/constants/trip-icons';
import { auth, db } from '@/config/firebase';
import { myName, notify, notifyMany } from '@/services/notifications/inbox';
import { fetchExpenses } from '@/services/Firebase/expenseService';
import { fetchSettlements } from '@/services/Firebase/settlementService';
import { isConnected, newId, readPath, writeUpdates } from '@/services/offline/offlineStore';
import { parseAmount, toAmount } from '@/utils/money';
import {
  CreateTripInput,
  InviteResult,
  LeaveTripResult,
  Trip,
  TripMember,
  TripPreview,
} from '@/types/trips';
import { equalTo, get, orderByChild, query, ref } from 'firebase/database';

/**
 * Said whenever a step truly needs the server.
 *
 * Joining a trip is the main one: the trip itself cannot be read until the
 * member record has reached the server, so queueing it would leave the person
 * looking at a trip that says it does not exist.
 */
const requireConnection = (): void => {
  if (!isConnected()) {
    throw new Error('This needs a connection. It will work again once you are back online.');
  }
};

const CODE_LENGTH = 6;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Generates a short, human-friendly invite code (no confusing 0/O/1/I). */
const createInviteCode = (): string => {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CODE_ALPHABET.charAt(Math.floor(Math.random() * CODE_ALPHABET.length));
  }
  return code;
};

const normalizeCode = (code: string): string => code.trim().toUpperCase();

/**
 * Finds an invite code that no trip is using yet, so two trips never share
 * the same code. Tries a few times before giving up.
 */
const reserveInviteCode = async (): Promise<string> => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = createInviteCode();
    // Fresh, not from the saved copy: a code already taken must not be handed out.
    const taken = await readPath(`inviteCodes/${code}`, { preferCache: false });
    if (taken === null) return code;
  }
  throw new Error('Could not create a unique invite code. Please try again.');
};

const buildMember = (person: {
  id: string;
  fullname: string;
  email: string;
  photoURL?: string;
}): TripMember => ({
  id: person.id,
  fullname: person.fullname,
  email: person.email,
  ...(person.photoURL ? { photoURL: person.photoURL } : {}),
  role: 'member',
  joinedAt: new Date().toISOString(),
});

/**
 * Creates a trip and adds the owner (plus any pre-selected members) to it.
 * Writes three things so the trip can be found from either side:
 *   trips/{tripId}            - the trip itself
 *   trips/{tripId}/members/   - who is in it
 *   userTrips/{uid}/{tripId}  - a per-user index for listing "my trips"
 */
export const createTrip = async (input: CreateTripInput): Promise<Trip> => {
  const name = input.name.trim();
  if (!name) {
    throw new Error('Please give your trip a name.');
  }
  if (!input.owner?.id) {
    throw new Error('No owner is signed in.');
  }

  const inviteCode = await reserveInviteCode();
  const createdAt = new Date().toISOString();
  // A key made on the device, so a trip can be created with no connection.
  const tripId = newId();

  const members: Record<string, TripMember> = {
    [input.owner.id]: {
      ...buildMember(input.owner),
      role: 'owner',
    },
  };

  (input.members ?? []).forEach((person) => {
    if (person.id && person.id !== input.owner.id && !members[person.id]) {
      members[person.id] = buildMember(person);
    }
  });

  // A budget and a first plan can be set at creation. Both live under the same
  // trip key, so they are folded into the trip write below.
  const budgetAmount = input.budget && input.budget > 0 ? toAmount(parseAmount(input.budget)) : 0;

  const itinerary = (input.itinerary ?? [])
    .map((plan) => ({ ...plan, title: (plan.title || '').trim() }))
    .filter((plan) => !!plan.title)
    .map((plan) => ({
      id: newId(),
      title: plan.title,
      day: plan.day,
      ...(plan.time?.trim() ? { time: plan.time.trim() } : {}),
      createdBy: input.owner.id,
      createdAt,
    }));

  if (!input.startDate) throw new Error('Pick the date of the trip.');

  const trip: Trip = {
    id: tripId,
    name,
    currency: input.currency,
    icon: input.icon || DEFAULT_TRIP_ICON,
    iconColor: input.iconColor || DEFAULT_TRIP_COLOR,
    createdBy: input.owner.id,
    createdAt,
    inviteCode,
    members,
  };

  // NOTE: the members must live *inside* the trip object here. Writing
  // `trips/{id}` and `trips/{id}/members` as two separate keys in the same
  // multi-path update makes Firebase throw "...that is ancestor of another
  // path", because one path is the parent of the other.
  // The owner's index entry is saved together with the trip: you are always
  // allowed to write your own `userTrips` list. The other members' index
  // entries are saved afterwards, because the rules only let you write a
  // person's list once you are already a member of that same trip.
  const updates: Record<string, unknown> = {
    [`trips/${tripId}`]: {
      name,
      currency: input.currency,
      icon: input.icon || DEFAULT_TRIP_ICON,
      iconColor: input.iconColor || DEFAULT_TRIP_COLOR,
      ...(input.startDate ? { startDate: input.startDate } : {}),
      ...(input.startDate && input.endDate ? { endDate: input.endDate } : {}),
      createdBy: input.owner.id,
      createdAt,
      inviteCode,
      members,
      // Written with the trip rather than afterwards, so a trip never exists
      // for a moment with no budget of its own.
      ...(budgetAmount > 0
        ? {
            budget: {
              amount: budgetAmount,
              updatedBy: input.owner.id,
              updatedAt: createdAt,
            },
          }
        : {}),
      ...(itinerary.length > 0
        ? { itinerary: Object.fromEntries(itinerary.map((item) => [item.id, item])) }
        : {}),
    },
    [`inviteCodes/${inviteCode}`]: { tripId, name },
    [`userTrips/${input.owner.id}/${tripId}`]: true,
  };

  await writeUpdates(updates);

  const otherMemberIds = Object.keys(members).filter((uid) => uid !== input.owner.id);
  if (otherMemberIds.length > 0) {
    const memberIndexUpdates: Record<string, unknown> = {};
    otherMemberIds.forEach((uid) => {
      memberIndexUpdates[`userTrips/${uid}/${tripId}`] = true;
    });
    await writeUpdates(memberIndexUpdates);
  }

  return trip;
};

/** Returns every trip the given user belongs to, newest first. */
export const fetchUserTrips = async (userId: string): Promise<Trip[]> => {
  if (!userId) return [];

  const index = (await readPath(`userTrips/${userId}`)) as Record<string, unknown> | null;
  if (!index) return [];

  const tripIds = Object.keys(index);

  const trips = await Promise.all(
    tripIds.map(async (tripId) => {
      const data = (await readPath(`trips/${tripId}`)) as Record<string, unknown> | null;
      if (!data) return null;
      return { id: tripId, ...data } as Trip;
    }),
  );

  return trips
    .filter((trip): trip is Trip => trip !== null)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
};

/** Returns a single trip, or null when it does not exist. */
export const fetchTrip = async (
  tripId: string,
  options?: { preferCache?: boolean },
): Promise<Trip | null> => {
  if (!tripId) return null;

  const data = (await readPath(`trips/${tripId}`, {
    preferCache: options?.preferCache,
  })) as Record<string, unknown> | null;
  if (!data) return null;

  return { id: tripId, ...data } as Trip;
};

/** Returns the trip's members sorted with the owner first. */
export const fetchTripMembers = async (tripId: string): Promise<TripMember[]> => {
  if (!tripId) return [];

  const data = (await readPath(`trips/${tripId}/members`)) as Record<string, TripMember> | null;
  if (!data) return [];

  const members = Object.values(data);

  return members.sort((a, b) => {
    if (a.role === b.role) return a.fullname.localeCompare(b.fullname);
    return a.role === 'owner' ? -1 : 1;
  });
};

/**
 * Adds someone to a trip by their user id. Safe to call twice - the member
 * record is keyed by uid, so an existing member is simply overwritten.
 */
export const addMemberToTrip = async (
  tripId: string,
  person: { id: string; fullname: string; email: string; photoURL?: string },
): Promise<void> => {
  if (!tripId || !person?.id) {
    throw new Error('A trip and a person are required.');
  }

  const member = buildMember(person);

  const updates: Record<string, unknown> = {
    [`trips/${tripId}/members/${person.id}`]: member,
    [`userTrips/${person.id}/${tripId}`]: true,
  };

  await writeUpdates(updates);
};

const notifyInvited = async (tripId: string, userId: string): Promise<void> => {
  const name = ((await readPath(`trips/${tripId}/name`)) as string | null) ?? 'a trip';
  const who = auth.currentUser?.displayName || 'Someone';
  await notify(userId, 'tripInvites', 'Added to a trip', who + ' added you to ' + name + '.', { tripId });
};

/** Adds a friend directly to a trip. */
export const inviteFriendToTrip = async (
  tripId: string,
  friend: { id: string; fullname: string; email: string; photoURL?: string },
): Promise<InviteResult> => {
  if (!friend?.id) {
    return { success: false, message: 'Unknown friend.' };
  }

  const existing = await readPath(`trips/${tripId}/members/${friend.id}`, { preferCache: false });
  if (existing !== null) {
    return { success: false, message: `${friend.fullname} is already in this trip.` };
  }

  await addMemberToTrip(tripId, friend);
  await notifyInvited(tripId, friend.id);
  return { success: true, message: `${friend.fullname} was added to the trip.` };
};

/** Looks up a registered user by email and adds them to the trip. */
export const inviteByEmail = async (tripId: string, email: string): Promise<InviteResult> => {
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanEmail) {
    return { success: false, message: 'Please enter an email address.' };
  }

  if (!isConnected()) {
    return { success: false, message: 'Inviting by email needs a connection.' };
  }

  const usersRef = ref(db, 'users');
  const userQuery = query(usersRef, orderByChild('email'), equalTo(cleanEmail));

  // A server-side lookup by email cannot be answered from the device, so
  // inviting a non-member needs a connection. Everything else works offline.
  const snapshot = await get(userQuery);

  if (!snapshot.exists()) {
    return { success: false, message: 'No TripSplit account uses that email yet.' };
  }

  const data = snapshot.val();
  const uid = Object.keys(data)[0];
  const profile = data[uid];

  const existing = await readPath(`trips/${tripId}/members/${uid}`, { preferCache: false });
  if (existing !== null) {
    return { success: false, message: 'That person is already in this trip.' };
  }

  const member: TripMember = buildMember({
    id: uid,
    fullname: profile.fullname || profile.displayName || cleanEmail,
    email: profile.email || cleanEmail,
    photoURL: profile.photoURL,
  });

  await addMemberToTrip(tripId, member);
  await notifyInvited(tripId, uid);

  return {
    success: true,
    message: `${member.fullname} was added to the trip.`,
    member,
  };
};

/**
 * Turns whatever is stored under an invite code into a trip id.
 *
 * Older records saved the plain trip id, newer ones save `{ tripId, name }`.
 * Both shapes are read here so an existing code never stops working.
 */
const readCodeEntry = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const entry = value as { tripId?: unknown };
    if (typeof entry.tripId === 'string') return entry.tripId;
  }
  return '';
};

/**
 * Looks up a trip by invite code without joining it, so the app can ask
 * "do you want to join this trip?" first. Returns null for a bad code.
 *
 * The name comes from the invite-code record on purpose. The rules only let
 * the people already in a trip read it, so a stranger holding a code cannot
 * read the trip itself - that is why the name is copied next to the code.
 */
export const fetchTripPreview = async (code: string): Promise<TripPreview | null> => {
  const cleanCode = normalizeCode(code);
  if (!cleanCode) return null;

  const stored = await readPath(`inviteCodes/${cleanCode}`, { preferCache: false });
  if (stored === null) return null;

  const tripId = readCodeEntry(stored);
  if (!tripId) return null;

  // Codes made before the name was stored have no name to show.
  const name = stored && typeof stored === 'object' ? (stored as { name?: string }).name : '';

  return { tripId, name: name || 'This trip' };
};

/** Joins the signed-in user to the trip that owns the given invite code. */
export const joinTripByCode = async (
  code: string,
  person: { id: string; fullname: string; email: string; photoURL?: string },
): Promise<Trip> => {
  const cleanCode = normalizeCode(code);

  if (!cleanCode) {
    throw new Error('Please enter an invite code.');
  }

  requireConnection();

  const stored = await readPath(`inviteCodes/${cleanCode}`, { preferCache: false });
  if (stored === null) {
    throw new Error('That invite code is not valid.');
  }

  const tripId = readCodeEntry(stored);
  if (!tripId) {
    throw new Error('That invite code is not valid.');
  }

  await addMemberToTrip(tripId, person);

  const trip = await fetchTrip(tripId);
  if (!trip) {
    throw new Error('That trip could not be found.');
  }

  await notifyMany(
    Object.keys(trip.members ?? {}),
    'tripActivity',
    'Someone joined',
    (person.fullname || 'Someone') + ' joined ' + trip.name + '.',
    { tripId },
  );

  return trip;
};

/**
 * Changes the parts of a trip its owner is allowed to edit: the name and the
 * currency.
 *
 * Only the owner can do this. The database rules let any member write the trip
 * node (they need it to add people and to leave), so the owner check has to
 * live here. The name is also copied next to the invite code, otherwise
 * someone holding a code would be asked to join under the old name.
 */
export const updateTripSettings = async (
  tripId: string,
  editorId: string,
  settings: {
    name: string;
    currency: string;
    icon?: string;
    iconColor?: string;
    startDate?: string;
    endDate?: string;
  },
): Promise<void> => {
  if (!tripId) {
    throw new Error('A trip is required.');
  }

  const name = settings.name.trim();
  if (!name) {
    throw new Error('Please give your trip a name.');
  }
  if (!settings.currency) {
    throw new Error('Please pick a currency.');
  }

  const trip = await fetchTrip(tripId);
  if (!trip) {
    throw new Error('This trip no longer exists.');
  }
  if (trip.createdBy !== editorId) {
    throw new Error('Only the trip owner can change these settings.');
  }

  const updates: Record<string, unknown> = {
    [`trips/${tripId}/name`]: name,
    [`trips/${tripId}/currency`]: settings.currency,
  };

  if (settings.icon) {
    updates[`trips/${tripId}/icon`] = settings.icon;
  }

  if (settings.iconColor) {
    updates[`trips/${tripId}/iconColor`] = settings.iconColor;
  }

  // The end date can be cleared (empty removes it); the start date cannot.
  if (settings.startDate !== undefined) {
    if (!settings.startDate) throw new Error('A trip needs a date.');
    updates[`trips/${tripId}/startDate`] = settings.startDate || null;
    updates[`trips/${tripId}/endDate`] =
      settings.startDate && settings.endDate ? settings.endDate : null;
  }

  // The trip fields are saved on their own, and the invite code's copy of the
  // name is saved afterwards. They used to travel as one multi-path write,
  // which meant a refusal on the code (for example when the code record is in
  // an unexpected shape) took the whole save down with it and the sheet only
  // ever said "permission denied". Keeping them apart means the settings save
  // succeeds on its own merits.
  await writeUpdates(updates).catch((err) => {
    // A raw "PERMISSION_DENIED" is not something the owner can act on. Say what
    // it means, and mention the likely cause so it can be fixed.
    if (/permission|denied/i.test(String(err?.message ?? ''))) {
      throw new Error(
        'The saved trip settings were refused by the database. Make sure the database rules have been published, then try again.',
      );
    }
    throw err;
  });

  if (trip.inviteCode) {
    try {
      const stored = await readPath(`inviteCodes/${trip.inviteCode}`, { preferCache: false });

      // Older codes hold just the trip id. Those are upgraded to the newer
      // `{ tripId, name }` shape, which is what shows the name before joining.
      if (readCodeEntry(stored) === tripId) {
        await writeUpdates({
          ...(stored && typeof stored === 'object'
            ? { [`inviteCodes/${trip.inviteCode}/name`]: name }
            : { [`inviteCodes/${trip.inviteCode}`]: { tripId, name } }),
        });
      }
    } catch (err) {
      // A stale name beside the invite code is not worth failing the save: the
      // owner's own settings are already saved at this point.
      console.warn('Could not update the invite code name:', err);
    }
  }
};

/**
 * How far a member's money stands, in cents: positive means the others still
 * owe them, negative means they still owe the others.
 *
 * Same "paid minus owed" idea as the balances tab, plus the cash that has
 * already changed hands. Removing someone with a non-zero net would strand
 * that amount: their name would vanish from the member list while their share
 * of every expense stayed behind, so the balance screen could no longer show
 * who owes what.
 */
const memberNetCents = async (tripId: string, memberId: string): Promise<number> => {
  // Fresh, not from the saved copy: a stale balance here would either block a
  // removal that is actually fine or allow one that strands money.
  const [expenses, settlements] = await Promise.all([
    fetchExpenses(tripId, { preferCache: false }),
    fetchSettlements(tripId, { preferCache: false }),
  ]);

  let net = 0;
  expenses.forEach((expense) => {
    const paid = Number(expense?.paidBy?.[memberId] ?? 0);
    const share = Number(expense?.shares?.[memberId] ?? 0);
    net += Math.round((paid - share) * 100);
  });
  settlements.forEach((settlement) => {
    if (settlement?.status === 'pending' || settlement?.status === 'declined') return;
    if (settlement?.from === memberId) net += Math.round(Number(settlement.amount) * 100);
    if (settlement?.to === memberId) net -= Math.round(Number(settlement.amount) * 100);
  });

  return net;
};

/**
 * Takes a member out of a trip, along with their personal index entry.
 *
 * Special cases, so a trip never ends up with nobody in charge and a person
 * who already paid money is never left with a hidden balance:
 *   - the last member leaving deletes the whole trip;
 *   - an owner leaving hands the trip to the member who joined earliest;
 *   - anyone still owed (or owing) money must settle first.
 */
export const leaveTrip = async (tripId: string, memberId: string): Promise<LeaveTripResult> => {
  if (!tripId || !memberId) {
    throw new Error('A trip and a member are required.');
  }

  const trip = await fetchTrip(tripId);
  if (!trip) {
    throw new Error('This trip no longer exists.');
  }

  if (!trip.members?.[memberId]) {
    throw new Error('You are not a member of this trip.');
  }

  const others = Object.values(trip.members).filter((member) => member.id !== memberId);

  // Last one out: there is nobody left to own or use the trip.
  if (others.length === 0) {
    // Retire the invite code first, while this person still counts as a member
    // (the rules allow a member to clear their own trip's code). If it fails
    // the trip is still removed below - a spare code is harmless.
    if (trip.inviteCode) {
      try {
        const stored = await readPath(`inviteCodes/${trip.inviteCode}`);
        if (stored !== null && readCodeEntry(stored) === tripId) {
          await writeUpdates({ [`inviteCodes/${trip.inviteCode}`]: null });
        }
      } catch (err) {
        console.error('Could not retire the invite code:', err);
      }
    }

    await writeUpdates({
      [`trips/${tripId}`]: null,
      [`userTrips/${memberId}/${tripId}`]: null,
    });

    return { tripDeleted: true };
  }

  const net = await memberNetCents(tripId, memberId);

  if (Math.abs(net) >= 1) {
    throw new Error(
      net > 0
        ? 'Settle up first: the others still owe you money on this trip.'
        : 'Settle up first: you still owe money on this trip.',
    );
  }

  const updates: Record<string, unknown> = {
    [`trips/${tripId}/members/${memberId}`]: null,
    [`userTrips/${memberId}/${tripId}`]: null,
  };

  // An owner leaving must leave an owner behind. The rules let a member write
  // their own member record, so the hand-over is written in the same update.
  let newOwner: TripMember | undefined;
  if (trip.createdBy === memberId) {
    newOwner = [...others].sort((a, b) => ((a.joinedAt || '') <= (b.joinedAt || '') ? -1 : 1))[0];
    updates[`trips/${tripId}/createdBy`] = newOwner.id;
    updates[`trips/${tripId}/members/${newOwner.id}/role`] = 'owner';
  }

  await writeUpdates(updates);

  return { tripDeleted: false, newOwner };
};

/**
 * Removes someone else from a trip. Only the owner may do this.
 *
 * The owner check is repeated here rather than trusted from the screen, so a
 * member calling this directly is refused. The database rules enforce the
 * same thing, which matters because the rules also let a member write their
 * own record - the owner needs that rule widened to remove anyone.
 */
export const removeMemberFromTrip = async (
  tripId: string,
  memberId: string,
  removerId: string,
): Promise<void> => {
  if (!tripId || !memberId || !removerId) {
    throw new Error('A trip and a member are required.');
  }

  const trip = await fetchTrip(tripId);
  if (!trip) {
    throw new Error('This trip no longer exists.');
  }

  if (trip.createdBy !== removerId) {
    throw new Error('Only the trip owner can remove a member.');
  }

  if (memberId === removerId) {
    throw new Error('To remove yourself, use "Leave this trip" instead.');
  }

  const member = trip.members?.[memberId];
  if (!member) {
    throw new Error('That person is not in this trip any more.');
  }

  const net = await memberNetCents(tripId, memberId);
  if (Math.abs(net) >= 1) {
    throw new Error(
      net > 0
        ? `${member.fullname} is still owed money on this trip. Settle up before removing them.`
        : `${member.fullname} still owes money on this trip. Settle up before removing them.`,
    );
  }

  await writeUpdates({
    [`trips/${tripId}/members/${memberId}`]: null,
    [`userTrips/${memberId}/${tripId}`]: null,
  });

  // tripId is left off so a muted trip cannot hide the news that you were removed.
  await notify(memberId, 'tripActivity', 'Removed from a trip', myName() + ' removed you from ' + trip.name + '.');
};
