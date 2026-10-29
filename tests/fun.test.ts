import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  pickRandomPayer,
  scoreGuesses,
  spinTargetRotation,
  tripAwards,
  tripCountdown,
  wheelAngleFor,
  yearInReview,
} from '../src/utils/fun.ts';

const member = (id: string, fullname: string) => ({
  id,
  fullname,
  email: `${id}@example.com`,
  role: 'member',
  joinedAt: '2026-01-01T00:00:00.000Z',
});

const members = [member('a', 'Ana Reyes'), member('b', 'Ben Cruz'), member('c', 'Cara Lim')];

const expense = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'e1',
  title: 'Lunch',
  amount: 100,
  category: 'food',
  spentOn: '2026-06-10',
  paidBy: { a: 100 },
  shares: { a: 34, b: 33, c: 33 },
  splitMode: 'equal',
  createdBy: 'a',
  createdAt: '2026-06-10T01:00:00.000Z',
  ...over,
});

const pesos = (amount: number) => `PHP ${amount.toFixed(2)}`;

/* ---------------------------------------------------------------- */
/* Countdown                                                         */
/* ---------------------------------------------------------------- */

test('Countdown counts days until the trip starts', () => {
  const soon = tripCountdown('2026-06-20', '2026-06-24', '2026-06-15');
  assert.ok(soon);
  assert.equal(soon.phase, 'soon');
  assert.equal(soon.days, 5);
  assert.equal(soon.label, '5 days to go');
});

test('Countdown says Tomorrow the day before, not one day', () => {
  const tomorrow = tripCountdown('2026-06-16', '2026-06-20', '2026-06-15');
  assert.equal(tomorrow?.label, 'Tomorrow');
});

test('Countdown reports the day number while the trip is running', () => {
  const live = tripCountdown('2026-06-14', '2026-06-18', '2026-06-15');
  assert.equal(live?.phase, 'live');
  assert.equal(live?.label, 'Day 2 of 5');
});

test('A one-day trip says it is happening now, not Day 1 of 1', () => {
  const oneDay = tripCountdown('2026-06-15', '2026-06-15', '2026-06-15');
  assert.equal(oneDay?.label, 'Happening now');
});

test('Countdown is past once the trip has ended', () => {
  const past = tripCountdown('2026-06-01', '2026-06-05', '2026-06-15');
  assert.equal(past?.phase, 'past');
  assert.equal(past?.label, 'Trip ended');
});

test('No start date means no countdown at all', () => {
  assert.equal(tripCountdown(undefined, '2026-06-05', '2026-06-15'), null);
});

/* ---------------------------------------------------------------- */
/* Awards                                                            */
/* ---------------------------------------------------------------- */

test('Awards name the person who covered the most', () => {
  const awards = tripAwards(
    members,
    [
      expense({ id: 'e1', amount: 300, paidBy: { a: 300 } }),
      expense({ id: 'e2', amount: 100, paidBy: { b: 100 } }),
    ],
    [],
    pesos,
  );
  const sponsor = awards.find((award) => award.key === 'sponsor');
  assert.equal(sponsor?.holder, 'Ana');
});

test('A trip with one expense gets no biggest-thing award', () => {
  const awards = tripAwards(members, [expense()], [], pesos);
  assert.equal(
    awards.some((award) => award.key === 'priciest'),
    false,
  );
});

test('The quiet one only appears when somebody really added nothing', () => {
  const oneAdds = [
    expense({ id: 'e1', createdBy: 'a' }),
    expense({ id: 'e2', createdBy: 'b', spentOn: '2026-06-11' }),
  ];
  const awards = tripAwards(members, oneAdds, [], pesos);
  const quiet = awards.find((award) => award.key === 'owl');
  assert.equal(quiet?.holder, 'Cara');
});

test('Awards are empty when there is nothing to award', () => {
  assert.deepEqual(tripAwards([], [], [], pesos), []);
});

/* ---------------------------------------------------------------- */
/* Guessing                                                          */
/* ---------------------------------------------------------------- */

test('The closest guess wins', () => {
  const scored = scoreGuesses(1000, { a: 900, b: 1200, c: 500 });
  assert.equal(scored.winner?.memberId, 'a');
});

test('Undershooting and overshooting count the same', () => {
  const scored = scoreGuesses(100, { a: 90, b: 110 });
  // Same distance, so it is a tie rather than a win.
  assert.equal(scored.winner, null);
});

test('Nobody guessing means no winner', () => {
  assert.equal(scoreGuesses(500, {}).winner, null);
});

/* ---------------------------------------------------------------- */
/* The wheel                                                         */
/* ---------------------------------------------------------------- */

test('The wheel never picks whoever paid last when others can pay', () => {
  const picked = pickRandomPayer(members, 'a', () => 0);
  assert.notEqual(picked?.id, 'a');
});

test('The wheel still picks someone when they are the only member', () => {
  const picked = pickRandomPayer([member('a', 'Ana Reyes')], 'a', () => 0);
  assert.equal(picked?.id, 'a');
});

test('The wheel returns nothing when there is nobody', () => {
  assert.equal(
    pickRandomPayer([], undefined, () => 0),
    null,
  );
});

/* ---------------------------------------------------------------- */
/* Review                                                            */
/* ---------------------------------------------------------------- */

test('The review totals the trip and finds its top category', () => {
  const review = yearInReview(members, [
    expense({ id: 'e1', amount: 200, category: 'food' }),
    expense({ id: 'e2', amount: 50, category: 'transport', spentOn: '2026-06-11' }),
  ]);
  assert.equal(review.expenses, 2);
  assert.equal(review.spent, 250);
  assert.equal(review.topCategory?.key, 'food');
  assert.equal(review.people, 3);
});

test('The review of an empty trip is zeroes, not a crash', () => {
  const review = yearInReview(members, []);
  assert.equal(review.expenses, 0);
  assert.equal(review.spent, 0);
  assert.equal(review.topCategory, null);
});

test('the first face starts under the pointer, and the ring is shared evenly', () => {
  assert.equal(wheelAngleFor(0, 3), 0);
  assert.equal(wheelAngleFor(1, 4), 90);
  assert.equal(wheelAngleFor(2, 4), 180);
  // A lone member has nowhere to sit but the top.
  assert.equal(wheelAngleFor(0, 1), 0);
  assert.equal(wheelAngleFor(3, 0), 0);
});

test('the ring always turns forward, never rewinds to an earlier angle', () => {
  const target = spinTargetRotation(0, 120);
  assert.ok(target > 0);
  // A second spin on the same face keeps going instead of snapping back.
  const again = spinTargetRotation(target, 120);
  assert.ok(again > target);
});

test('the ring stops with the chosen face under the pointer', () => {
  // The ring turns clockwise, so a face at `indexAngle` is at -indexAngle once
  // the ring has turned. Under the pointer means a whole number of turns.
  [0, 45, 90, 135, 270].forEach((indexAngle) => {
    [0, 37, 360, 1000].forEach((from) => {
      const target = spinTargetRotation(from, indexAngle);
      const landed = (((-indexAngle - target) % 360) + 360) % 360;
      assert.equal(landed, 0, `${indexAngle}deg from ${from}deg`);
    });
  });
});

test('a spin always runs at least one whole turn', () => {
  // Already showing the winner: the ring still has to travel, or the spin looks
  // like nothing happened at all.
  const target = spinTargetRotation(90, 270, 1);
  assert.ok(target - 90 >= 360);
});
