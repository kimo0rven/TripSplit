export type SplitMode = 'equal' | 'percentage' | 'custom';

/** How an expense's total was split between members. */
export interface SplitDetail {
  mode: SplitMode;
  /** Raw input per member: percent (0-100) or exact amount, depending on mode. */
  input?: Record<string, number>;
}

/** One edit to a money record: who changed it, when, and what moved. */
export interface EditLogEntry {
  id: string;
  at: string;
  by: string;
  byName: string;
  changes: { label: string; from: string; to: string }[];
}

/** One line of an itemised receipt, shared equally by the members listed. */
export interface ExpenseItem {
  id: string;
  name: string;
  amount: number;
  sharedBy: string[];
}

export interface Expense {
  id: string;
  title: string;
  /** Total in the trip's currency. */
  amount: number;
  category: string;
  /** Day the money was spent, as YYYY-MM-DD. */
  spentOn: string;
  /** Clock time it was spent, HH:mm. Older expenses have none. */
  spentTime?: string;
  notes?: string;
  /** memberId -> how much that member put in (supports several payers). */
  paidBy: Record<string, number>;
  /** memberId -> how much that member owes for this expense. */
  shares: Record<string, number>;
  splitMode: SplitMode;
  splitDetail?: SplitDetail;
  /** Set when the receipt was entered item by item. */
  items?: ExpenseItem[];
  /** The first receipt photo; kept so expenses saved before several photos still work. */
  receiptUrl?: string;
  /** Every receipt photo, in the order they were added. */
  receiptUrls?: string[];
  createdBy: string;
  createdAt: string;
  /** Edit log, newest first. */
  history?: EditLogEntry[];
}

export interface Settlement {
  id: string;
  /** Member handing over the money. */
  from: string;
  /** Member receiving it. */
  to: string;
  amount: number;
  /** Whether this cleared the debt between the two members at the time. */
  kind: 'full' | 'partial';
  settledOn: string;
  /** Whether the money changed hands as cash. */
  /** Who confirmed it: 'pending' until the receiver agrees. Older payments have no status and count. */
  status?: 'pending' | 'confirmed' | 'declined';
  confirmedBy?: string;
  confirmedAt?: string;
  isCash?: boolean;
  /** How a non-cash payment was made, e.g. GCash or bank transfer. */
  method?: string;
  /** Photos of the transfer or handover, e.g. a GCash screenshot. */
  proofUrls?: string[];
  note?: string;
  createdBy: string;
  createdAt: string;
  /** Edit log, newest first. */
  history?: EditLogEntry[];
}

export interface ItineraryItem {
  id: string;
  title: string;
  /** Day of the plan, as YYYY-MM-DD. */
  day: string;
  /** Optional clock time, HH:mm. */
  time?: string;
  location?: string;
  notes?: string;
  /** Public links to photos attached to the plan. */
  photoUrls?: string[];
  createdBy: string;
  createdAt: string;
  /** Edit log, newest first. */
  history?: EditLogEntry[];
}

/** What one member has put in versus what they should pay. */
export interface MemberBalance {
  memberId: string;
  paid: number;
  owed: number;
  /** paid - owed. Positive means the trip owes them money. */
  net: number;
}

/** One suggested repayment, used by the debt simplifier. */
export interface DebtEdge {
  from: string;
  to: string;
  amount: number;
}

export interface TripBudget {
  amount: number;
  updatedBy?: string;
  updatedAt?: string;
}

export type RepeatEvery = 'daily' | 'weekly' | 'monthly';

/** A template that adds the same expense again on a schedule. */
export interface RecurringExpense {
  id: string;
  title: string;
  amount: number;
  category: string;
  every: RepeatEvery;
  /** The next day an expense is due, as YYYY-MM-DD. */
  nextDue: string;
  spentTime?: string;
  notes?: string;
  paidBy: Record<string, number>;
  shares: Record<string, number>;
  splitMode: SplitMode;
  createdBy: string;
  createdAt: string;
  active: boolean;
}
