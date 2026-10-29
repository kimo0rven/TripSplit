import assert from 'node:assert/strict';
import test from 'node:test';

import { mapUrlFor, nextPlan, planTiming, startsIn } from '../src/utils/itinerary.ts';

/**
 * The timing helpers decide what the Plan tab calls "next", so they get tested
 * against a fixed clock instead of the real one.
 */
const plan = (over: { [key: string]: unknown } = {}) =>
  ({
    id: 'p1',
    title: 'Island hopping',
    day: '2025-06-14',
    ...over,
  }) as { day: string; time?: string; endTime?: string; id: string };

/** A local Date on the given day and time, so the tests match what a phone shows. */
const at = (day: string, hours: number, minutes = 0): Date => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, hours, minutes, 0, 0);
};

test('a plan on a later day is upcoming, with the wait counted in minutes', () => {
  const timing = planTiming(plan({ day: '2025-06-16', time: '09:00' }), at('2025-06-14', 9, 0));
  assert.equal(timing.state, 'upcoming');
  if (timing.state !== 'upcoming') return;
  // Two whole days ahead, at the same clock time.
  assert.equal(timing.startsInMinutes, 2 * 1440);
});

test('today, before its start time, the wait is just the gap', () => {
  const timing = planTiming(plan({ day: '2025-06-14', time: '15:00' }), at('2025-06-14', 13, 30));
  assert.equal(timing.state, 'today');
  if (timing.state !== 'today') return;
  assert.equal(timing.startsInMinutes, 90);
});

test('a plan with no time counts as today rather than already past', () => {
  const timing = planTiming(plan({ day: '2025-06-14' }), at('2025-06-14', 22, 0));
  assert.equal(timing.state, 'today');
});

test('a running plan needs an end time later than its start', () => {
  const timing = planTiming(
    plan({ day: '2025-06-14', time: '09:00', endTime: '16:00' }),
    at('2025-06-14', 12, 0),
  );
  assert.equal(timing.state, 'now');
  if (timing.state !== 'now') return;
  assert.equal(timing.endsInMinutes, 240);
});

test('a plan already finished today is past, not running', () => {
  const timing = planTiming(
    plan({ day: '2025-06-14', time: '09:00', endTime: '10:00' }),
    at('2025-06-14', 11, 0),
  );
  assert.equal(timing.state, 'past');
});

test('an end time before the start does not count as running', () => {
  // A bad range is ignored rather than producing a negative duration, so once
  // the start time passes the plan simply reads as past.
  const timing = planTiming(
    plan({ day: '2025-06-14', time: '16:00', endTime: '09:00' }),
    at('2025-06-14', 17, 0),
  );
  assert.equal(timing.state, 'past');
});

test('a plan on an earlier day is past', () => {
  assert.equal(
    planTiming(plan({ day: '2025-06-13', time: '09:00' }), at('2025-06-14', 9, 0)).state,
    'past',
  );
});

test('next plan prefers the one happening now over a later one', () => {
  const running = plan({ id: 'now', day: '2025-06-14', time: '09:00', endTime: '16:00' });
  const later = plan({ id: 'later', day: '2025-06-14', time: '18:00' });
  // The list arrives in day order, so the running plan comes first anyway.
  assert.equal(nextPlan([running, later], at('2025-06-14', 12, 0))?.id, 'now');
});

test('next plan skips finished ones and picks the soonest', () => {
  const done = plan({ id: 'done', day: '2025-06-14', time: '08:00' });
  const soon = plan({ id: 'soon', day: '2025-06-14', time: '18:00' });
  const tomorrow = plan({ id: 'tomorrow', day: '2025-06-15', time: '09:00' });
  assert.equal(nextPlan([done, soon, tomorrow], at('2025-06-14', 12, 0))?.id, 'soon');
});

test('with nothing ahead there is no next plan', () => {
  const done = plan({ id: 'done', day: '2025-06-14', time: '08:00' });
  assert.equal(nextPlan([done], at('2025-06-14', 12, 0)), null);
});

test('the wait reads in minutes, hours, then days', () => {
  assert.equal(startsIn(0), 'now');
  assert.equal(startsIn(30), 'in 30 min');
  assert.equal(startsIn(60), 'in 1 hour');
  assert.equal(startsIn(180), 'in 3 hours');
  assert.equal(startsIn(1440), 'in 1 day');
  assert.equal(startsIn(1440 * 3), 'in 3 days');
});

test('a place becomes a map search, and a link is left alone', () => {
  assert.match(mapUrlFor('Session Road'), /^https:\/\/maps\.google\.com\/\?q=Session%20Road$/);
  assert.equal(mapUrlFor('https://maps.app.goo.gl/x'), 'https://maps.app.goo.gl/x');
  // Nothing to search means nothing to open.
  assert.equal(mapUrlFor('   '), '');
});
