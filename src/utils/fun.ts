/**
 * The playful side of a trip.
 *
 * Everything here is derived from the expenses and members the app already
 * has, so none of it needs a database change. That matters: a fun feature that
 * needs a migration is a fun feature that silently loses data when someone is
 * offline.
 *
 * All of it is pure, which is what makes it testable.
 */

import type { Expense, Settlement } from '@/types/expenses';
import type { TripMember } from '@/types/trips';

/* ------------------------------------------------------------------ */
/* Countdown                                                          */
/* ------------------------------------------------------------------ */

export interface Countdown {
  /** Whole days from today until the trip starts. Negative once it has. */
  days: number;
  /** 'soon' before it starts, 'live' during it, 'past' after. */
  phase: 'soon' | 'live' | 'past';
  /** A sentence to show on the card, e.g. "In 12 days" or "Day 2 of 5". */
  label: string;
}

/** Whole days between two YYYY-MM-DD keys, in the device's own calendar. */
const dayDiff = (from: string, to: string): number | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(from.trim());
  const match2 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(to.trim());
  if (!match || !match2) return null;

  const a = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const b = Date.UTC(Number(match2[1]), Number(match2[2]) - 1, Number(match2[3]));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;

  return Math.round((b - a) / 86_400_000);
};

/**
 * How long until the trip, or which day of it it is.
 *
 * Uses whole calendar days rather than hours, so a trip starting tomorrow
 * reads "Tomorrow" all day, not "in 0 days" after midday.
 */
export function tripCountdown(
  startDate?: string,
  endDate?: string,
  today: string = '',
): Countdown | null {
  if (!startDate || !today) return null;

  const toStart = dayDiff(today, startDate);
  if (toStart === null) return null;

  const lastDay = endDate || startDate;
  const toEnd = dayDiff(today, lastDay) ?? 0;

  // Before it starts.
  if (toStart > 0) {
    const label = toStart === 1 ? 'Tomorrow' : `${toStart} days to go`;
    return { days: toStart, phase: 'soon', label };
  }

  // During it. Day 1 is the start date itself.
  if (toEnd >= 0) {
    const total = (dayDiff(startDate, lastDay) ?? 0) + 1;
    const day = -toStart + 1;
    const label = total > 1 ? `Day ${day} of ${total}` : 'Happening now';
    return { days: toStart, phase: 'live', label };
  }

  // After it.
  return { days: toStart, phase: 'past', label: 'Trip ended' };
}

/* ------------------------------------------------------------------ */
/* Trip awards                                                        */
/* ------------------------------------------------------------------ */

export interface Award {
  /** Stable key, so the card can colour itself. */
  key: 'sponsor' | 'generous' | 'priciest' | 'planner' | 'streak' | 'owl';
  /** The joke title, e.g. "The Sponsor". */
  title: string;
  /** One member's first name, or a plain description when nobody qualifies. */
  holder: string;
  /** The figure the award is about, already formatted. */
  detail: string;
}

/** Anything under a cent is rounding noise. */
const isZero = (value: number): boolean => Math.abs(value) < 0.005;

/** The first name of a member, or 'Someone' when they have left. */
const firstName = (members: TripMember[], id: string): string => {
  const member = members.find((entry) => entry.id === id);
  const name = member?.fullname?.trim();
  return name ? name.split(' ')[0] : 'Someone';
};

/**
 * The awards, as a list of things that actually happened on this trip.
 *
 * Each one is only handed out when it is earned: a trip with one expense gets
 * no "biggest expense" because the biggest expense of one thing says nothing.
 * Nothing here judges anyone - a trip award is a joke about money, not a
 * comment on a person.
 */
export function tripAwards(
  members: TripMember[],
  expenses: Expense[],
  settlements: Settlement[],
  formatMoney: (amount: number) => string,
): Award[] {
  const awards: Award[] = [];
  if (members.length === 0) return awards;

  // What each person put into expenses (not settlements: paying someone back
  // does not make you the person who covered the trip).
  const paidForExpenses: Record<string, number> = {};
  expenses.forEach((expense) => {
    Object.entries(expense.paidBy ?? {}).forEach(([id, amount]) => {
      paidForExpenses[id] = (paidForExpenses[id] ?? 0) + amount;
    });
  });

  const spendBy = expenses.reduce<Record<string, number>>((sum, expense) => {
    sum[expense.spentOn] = (sum[expense.spentOn] ?? 0) + expense.amount;
    return sum;
  }, {});
  const expenseDays = Object.keys(spendBy).length;

  // The Sponsor: whoever covered the most money.
  const topPayer = Object.entries(paidForExpenses).sort((a, b) => b[1] - a[1])[0];
  if (topPayer && !isZero(topPayer[1]) && members.length > 1) {
    awards.push({
      key: 'sponsor',
      title: 'The Sponsor',
      holder: firstName(members, topPayer[0]),
      detail: `put in ${formatMoney(topPayer[1])}`,
    });
  }

  // The Priciest Thing: worth naming once there is more than one expense.
  if (expenses.length > 1) {
    const biggest = [...expenses].sort((a, b) => b.amount - a.amount)[0];
    if (biggest && !isZero(biggest.amount)) {
      awards.push({
        key: 'priciest',
        title: 'The Priciest Thing',
        holder: biggest.title,
        detail: formatMoney(biggest.amount),
      });
    }
  }

  // The Busiest Day: which day carried the most money.
  if (expenseDays > 1) {
    const busiest = Object.entries(spendBy).sort((a, b) => b[1] - a[1])[0];
    if (busiest) {
      awards.push({
        key: 'streak',
        title: 'The Busiest Day',
        holder: `${expenseDays} days had spending`,
        detail: busiest[1] ? formatMoney(busiest[1]) : '',
      });
    }
  }

  // The Fastest Settler: who cleared the most payments.
  const paidOut: Record<string, number> = {};
  settlements.forEach((settlement) => {
    if (settlement.status && settlement.status !== 'confirmed') return;
    paidOut[settlement.from] = (paidOut[settlement.from] ?? 0) + settlement.amount;
  });
  const topSettler = Object.entries(paidOut).sort((a, b) => b[1] - a[1])[0];
  if (topSettler && !isZero(topSettler[1])) {
    awards.push({
      key: 'generous',
      title: 'The Fastest Settler',
      holder: firstName(members, topSettler[0]),
      detail: `paid back ${formatMoney(topSettler[1])}`,
    });
  }

  // The Quiet One: someone on the trip who never added anything.
  if (expenses.length > 0 && members.length > 2) {
    const added = new Set(expenses.map((expense) => expense.createdBy).filter(Boolean));
    const quiet = members.find((member) => !added.has(member.id));
    if (quiet) {
      awards.push({
        key: 'owl',
        title: 'The Quiet One',
        holder: quiet.fullname?.trim().split(' ')[0] || 'Someone',
        detail: 'has not added an expense yet',
      });
    }
  }

  return awards;
}

/* ------------------------------------------------------------------ */
/* Guessing the total                                                 */
/* ------------------------------------------------------------------ */

export interface Guesses {
  members: string[];
  /** The real total, in the trip's currency. */
  actual: number;
  /** Everyone's guess, once a guess exists. */
  list: { memberId: string; guess: number; distance: number }[];
  /** The closest guess, or null when nobody has guessed. */
  winner: { memberId: string; guess: number; distance: number } | null;
}

/**
 * Scores everyone's guess at the trip total.
 *
 * The point is bragging rights, so a tie is left as a tie rather than broken
 * by who guessed first. Distances are absolute, so undershooting counts the
 * same as overshooting.
 */
export function scoreGuesses(actual: number, guesses: Record<string, number>): Guesses {
  const list = Object.entries(guesses)
    .filter(([, guess]) => Number.isFinite(guess))
    .map(([memberId, guess]) => ({
      memberId,
      guess,
      distance: Math.abs(guess - actual),
    }))
    .sort((a, b) => a.distance - b.distance || b.guess - a.guess);

  const closest = list[0];
  const winner =
    closest && (list.length === 1 || closest.distance < list[1].distance) ? closest : null;

  return { members: list.map((entry) => entry.memberId), actual, list, winner };
}

/* ------------------------------------------------------------------ */
/* Random payer                                                       */
/* ------------------------------------------------------------------ */

/**
 * Picks who pays next.
 *
 * The picker is passed in, so the draw is testable without waiting for luck.
 * Whoever paid the last expense is left out when there is someone else to
 * pick - "spin the wheel" that lands on the same person twice feels broken.
 */
export function pickRandomPayer(
  members: TripMember[],
  lastPayerId: string | undefined,
  random: () => number = Math.random,
): TripMember | null {
  if (members.length === 0) return null;

  const eligible =
    members.length > 1 && lastPayerId
      ? members.filter((member) => member.id !== lastPayerId)
      : members;

  const pool = eligible.length > 0 ? eligible : members;
  const index = Math.floor(random() * pool.length);
  return pool[Math.min(Math.max(index, 0), pool.length - 1)] ?? null;
}

/** Who paid for the most recent expense, so the wheel can avoid them. */
export function lastPayerOf(expenses: Expense[]): string | undefined {
  const newest = [...expenses].sort((a, b) =>
    (b.createdAt ?? '').localeCompare(a.createdAt ?? ''),
  )[0];
  if (!newest) return undefined;
  return Object.entries(newest.paidBy ?? {}).sort((a, b) => b[1] - a[1])[0]?.[0];
}

/* ------------------------------------------------------------------ */
/* The spinning wheel                                                */
/* ------------------------------------------------------------------ */

/**
 * Where a face sits on the ring, in degrees clockwise from the pointer at the
 * top. The first face starts at the top, so an untouched wheel already points
 * at somebody.
 */
export function wheelAngleFor(index: number, count: number): number {
  if (count <= 0) return 0;
  return (360 / count) * index;
}

/**
 * How far the ring must turn so that the face at `indexAngle` stops under the
 * pointer.
 *
 * The ring only ever turns clockwise, so the result is always greater than
 * `current` - a second spin keeps going forward instead of rewinding, which is
 * what makes it read as a real wheel rather than a slideshow.
 */
export function spinTargetRotation(current: number, indexAngle: number, turns = 4): number {
  const wholeTurns = Math.max(1, Math.round(turns));
  const normalized = ((current % 360) + 360) % 360;
  // The face is under the pointer when its own angle plus the ring's turn
  // makes a full circle, which is where the negative angle comes from.
  const landing = (((-indexAngle - normalized) % 360) + 360) % 360;
  return current + wholeTurns * 360 + landing;
}

/* ------------------------------------------------------------------ */
/* Year (or trip) in review                                           */
/* ------------------------------------------------------------------ */

export interface YearInReview {
  trips: number;
  expenses: number;
  spent: number;
  topCategory: { key: string; amount: number } | null;
  mostGenerous: { memberId: string; amount: number } | null;
  busiestDay: { day: string; amount: number } | null;
  /** How many different people shared the money. */
  people: number;
}

/**
 * The wrapped-style summary of everything in one trip.
 *
 * Deliberately built from the trip's own expenses rather than across trips: a
 * review that needs every trip loaded is a review that fails when one of them
 * has not been opened on this device yet.
 */
export function yearInReview(members: TripMember[], expenses: Expense[]): YearInReview {
  const spent = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  const byCategory: Record<string, number> = {};
  expenses.forEach((expense) => {
    byCategory[expense.category] = (byCategory[expense.category] ?? 0) + expense.amount;
  });
  const topCategoryEntry = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];

  const paidIn: Record<string, number> = {};
  expenses.forEach((expense) => {
    Object.entries(expense.paidBy ?? {}).forEach(([id, amount]) => {
      paidIn[id] = (paidIn[id] ?? 0) + amount;
    });
  });
  const generousEntry = Object.entries(paidIn).sort((a, b) => b[1] - a[1])[0];

  const byDay: Record<string, number> = {};
  expenses.forEach((expense) => {
    byDay[expense.spentOn] = (byDay[expense.spentOn] ?? 0) + expense.amount;
  });
  const busiestEntry = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0];

  return {
    trips: members.length > 0 ? 1 : 0,
    expenses: expenses.length,
    spent,
    topCategory: topCategoryEntry
      ? { key: topCategoryEntry[0], amount: topCategoryEntry[1] }
      : null,
    mostGenerous: generousEntry ? { memberId: generousEntry[0], amount: generousEntry[1] } : null,
    busiestDay: busiestEntry ? { day: busiestEntry[0], amount: busiestEntry[1] } : null,
    people: members.length,
  };
}
