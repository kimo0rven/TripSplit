/**
 * What sits beside an invite code, and what someone holding the code can do.
 *
 * Only members can read a trip, so a person holding a code sees the trip
 * through a small copy kept beside the code: its name, who runs it, its
 * dates, and whether the owner lets new people in.
 *
 * Kept free of imports so it can be tested with `node --test`.
 */

export interface InviteEntry {
  tripId: string;
  name: string;
  /** Who runs the trip: told about requests to join. */
  ownerId?: string;
  ownerName?: string;
  startDate?: string;
  endDate?: string;
  /** True when the owner lets each new member in by hand. */
  requireApproval?: boolean;
}

/** Where a person stands with a trip they hold the code for. */
export type JoinStep =
  /** Anyone with the code can join straight away. */
  | 'join'
  /** The owner lets people in, so joining sends a request. */
  | 'ask'
  /** A request is waiting for the owner. */
  | 'pending'
  /** The owner said no to the last request. */
  | 'declined'
  /** Already in the trip. */
  | 'member';

interface TripLike {
  id: string;
  name: string;
  createdBy: string;
  members?: Record<string, { fullname?: string } | undefined>;
  startDate?: string;
  endDate?: string;
  requireApproval?: boolean;
}

/** The copy kept beside a trip's invite code. Fields left empty are left out. */
export const buildInviteEntry = (trip: TripLike): InviteEntry => {
  const ownerName = trip.members?.[trip.createdBy]?.fullname?.trim();
  return {
    tripId: trip.id,
    name: trip.name,
    ownerId: trip.createdBy,
    ...(ownerName ? { ownerName } : {}),
    ...(trip.startDate ? { startDate: trip.startDate } : {}),
    ...(trip.startDate && trip.endDate ? { endDate: trip.endDate } : {}),
    requireApproval: trip.requireApproval === true,
  };
};

/**
 * Reads what is stored under a code. Older codes hold only the trip id, newer
 * ones the whole entry; anything else is not a code.
 */
export const readInviteEntry = (value: unknown): InviteEntry | null => {
  if (typeof value === 'string') return value ? { tripId: value, name: '' } : null;
  if (!value || typeof value !== 'object') return null;
  const entry = value as Record<string, unknown>;
  if (typeof entry.tripId !== 'string' || !entry.tripId) return null;
  const text = (key: string) => (typeof entry[key] === 'string' ? (entry[key] as string) : '');
  return {
    tripId: entry.tripId,
    name: text('name'),
    ...(text('ownerId') ? { ownerId: text('ownerId') } : {}),
    ...(text('ownerName') ? { ownerName: text('ownerName') } : {}),
    ...(text('startDate') ? { startDate: text('startDate') } : {}),
    ...(text('endDate') ? { endDate: text('endDate') } : {}),
    requireApproval: entry.requireApproval === true,
  };
};

/** What the join screen offers, from the code's entry and the person's own records. */
export const joinStepFor = (
  entry: Pick<InviteEntry, 'requireApproval'>,
  person: { isMember: boolean; request?: unknown },
): JoinStep => {
  if (person.isMember) return 'member';
  const request = person.request as { status?: unknown } | null | undefined;
  if (request && typeof request === 'object') {
    return request.status === 'declined' ? 'declined' : 'pending';
  }
  return entry.requireApproval ? 'ask' : 'join';
};

/**
 * How a member got into the trip, for the members list: "Joined with the
 * invite code", "Let in by Kim", "Added by Kim", or nothing when unknown
 * (people added before this was recorded, and the owner).
 */
export const memberOrigin = (
  member: { role?: string; joinedWith?: string; addedBy?: string; invitedBy?: string },
  nameOf: (id: string) => string,
): string => {
  if (member.invitedBy && member.addedBy && member.invitedBy !== member.addedBy) {
    return `Invited by ${nameOf(member.invitedBy)} · let in by ${nameOf(member.addedBy)}`;
  }
  if (member.joinedWith && member.addedBy) return `Let in by ${nameOf(member.addedBy)}`;
  if (member.joinedWith) return 'Joined with the invite code';
  if (member.addedBy && member.role !== 'owner') return `Added by ${nameOf(member.addedBy)}`;
  return '';
};
