export type TripMemberRole = 'owner' | 'member';

export interface TripMember {
  id: string;
  fullname: string;
  email: string;
  photoURL?: string;
  role: TripMemberRole;
  joinedAt: string;
  /** The invite code they joined with, when they joined by code. */
  joinedWith?: string;
  /** Who put them in the trip: the owner who let them in, or the person who added them. */
  addedBy?: string;
  /** The member who suggested them, when someone other than the owner invited them. */
  invitedBy?: string;
}

export interface Trip {
  id: string;
  name: string;
  currency: string;
  /**
   * Which picture the trip wears, as a key from `constants/trip-icons`.
   * Optional because trips made before icons existed have none saved.
   */
  icon?: string;
  /**
   * The colour of the icon's square, as a key from `constants/trip-colors`.
   * Optional because trips made before colours existed wear the default.
   */
  iconColor?: string;
  createdBy: string;
  createdAt: string;
  /** When the trip happens, as YYYY-MM-DD. Both are optional; no end means a one-day trip. */
  startDate?: string;
  endDate?: string;
  inviteCode: string;
  /** True when the owner lets each new member in by hand. */
  requireApproval?: boolean;
  /** True when expenses and payments can be recorded before the trip starts. */
  allowEarlySpending?: boolean;
  /** Set when the owner closed the trip: its expenses and plans are then read-only. */
  closedAt?: string;
  closedBy?: string;
  members: Record<string, TripMember>;
  /** Kept in step by the expense service, so lists can show a total cheaply. */
  totalSpent?: number;
}

export interface CreateTripInput {
  name: string;
  startDate?: string;
  endDate?: string;
  currency: string;
  icon?: string;
  iconColor?: string;
  /** A starting budget, in the trip's currency. Left out when none was set. */
  budget?: number;
  /** Plans to drop straight into the itinerary, in the order they were added. */
  itinerary?: {
    title: string;
    day: string;
    time?: string;
    endTime?: string;
    /** The plan's description. */
    notes?: string;
    /** Photos already uploaded for the plan. */
    photoUrls?: string[];
  }[];
  /**
   * The trip's id, when the caller made it up front - needed when photos are
   * uploaded under the trip's folder before the trip itself is saved.
   */
  id?: string;
  owner: {
    id: string;
    fullname: string;
    email: string;
    photoURL?: string;
  };
  members?: {
    id: string;
    fullname: string;
    email: string;
    photoURL?: string;
  }[];
}

export interface InviteResult {
  success: boolean;
  message: string;
  member?: TripMember;
  /** True when the invite went to the owner to approve instead of adding them. */
  requested?: boolean;
}

/**
 * What someone can see about a trip *before* joining it.
 *
 * Only the name is kept here, because that is the one thing that never
 * changes. A member count would go stale the moment anyone joins.
 */
export interface TripPreview {
  tripId: string;
  name: string;
  ownerName?: string;
  startDate?: string;
  endDate?: string;
  /** True when the owner lets each new member in by hand. */
  requireApproval: boolean;
  /** What the person holding the code can do next. */
  step: import('@/utils/joinInvite').JoinStep;
}

/** Someone waiting for the owner to let them into a trip. */
export interface JoinRequest {
  id: string;
  fullname: string;
  email: string;
  photoURL?: string;
  /** The invite code they asked with; missing when a member invited them. */
  code?: string;
  /** The member who invited them, when the request came from inside the trip. */
  invitedBy?: string;
  invitedByName?: string;
  requestedAt: string;
  status?: 'declined';
}

/** What joining by code did: joined straight away, or asked the owner. */
export type JoinResult =
  | { status: 'joined'; tripId: string; name: string }
  | { status: 'requested'; tripId: string; name: string; ownerName?: string };

/** What happened when someone left a trip. */
export interface LeaveTripResult {
  /** True when the person who left was the last member. */
  tripDeleted: boolean;
  /** Set when the trip was handed to another member. */
  newOwner?: TripMember;
}
