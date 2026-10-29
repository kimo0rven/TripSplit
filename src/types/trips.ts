export type TripMemberRole = 'owner' | 'member';

export interface TripMember {
  id: string;
  fullname: string;
  email: string;
  photoURL?: string;
  role: TripMemberRole;
  joinedAt: string;
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
  itinerary?: { title: string; day: string; time?: string }[];
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
}

/** What happened when someone left a trip. */
export interface LeaveTripResult {
  /** True when the person who left was the last member. */
  tripDeleted: boolean;
  /** Set when the trip was handed to another member. */
  newOwner?: TripMember;
}
