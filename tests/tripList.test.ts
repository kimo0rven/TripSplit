import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  filterTrips,
  pinActiveTrip,
  resolveActiveTripId,
  tripIsOver,
  tripStatus,
} from '../src/utils/tripList.ts';

const base = {
  archived: {},
  summaries: {},
  today: '2026-06-15',
};

const trip = (id: string, members: Record<string, { role?: string }>) => ({
  id,
  name: id,
  createdAt: '2026-01-01T00:00:00.000Z',
  members,
});

test('Created shows only trips the person owns', () => {
  const trips = [
    trip('mine', { me: { role: 'owner' } }),
    trip('theirs', { me: { role: 'member' } }),
  ];

  const shown = filterTrips(trips, {
    ...base,
    filter: 'created',
    query: '',
    uid: 'me',
  });

  assert.deepEqual(
    shown.map((item) => item.id),
    ['mine'],
  );
});

test('Joined keeps a trip whose member record has no role at all', () => {
  // A member record written before roles existed has no `role` field. Checking
  // for `role === 'member'` exactly would hide that trip from both Created and
  // Joined, so it has to count as joined.
  const trips = [trip('legacy', { me: {} }), trip('mine', { me: { role: 'owner' } })];

  const shown = filterTrips(trips, {
    ...base,
    filter: 'joined',
    query: '',
    uid: 'me',
  });

  assert.deepEqual(
    shown.map((item) => item.id),
    ['legacy'],
  );
});

test('Joined still excludes trips the person owns', () => {
  const trips = [trip('mine', { me: { role: 'owner' } })];

  const shown = filterTrips(trips, {
    ...base,
    filter: 'joined',
    query: '',
    uid: 'me',
  });

  assert.deepEqual(shown, []);
});

test('a trip is over only after its last day', () => {
  const dates = { startDate: '2026-06-10', endDate: '2026-06-15' };

  assert.equal(tripIsOver(dates, '2026-06-15'), false);
  assert.equal(tripIsOver(dates, '2026-06-16'), true);
  assert.equal(tripStatus(dates, '2026-06-15'), 'ongoing');
  assert.equal(tripStatus(dates, '2026-06-16'), 'past');
});

test('a trip with no dates is never over and has no status', () => {
  assert.equal(tripIsOver({}, '2030-01-01'), false);
  assert.equal(tripStatus({}, '2030-01-01'), null);
});

test('the remembered trip stays active when a newer trip is created', () => {
  // fetchUserTrips sorts newest first, so the new trip is at the top of the
  // list. The remembered one must still win, otherwise simply creating a trip
  // would take the dashboard over from the trip already in use.
  const today = '2026-06-15';
  const trips = [{ id: 'new' }, { id: 'old' }, { id: 'older' }];

  assert.equal(resolveActiveTripId(trips, 'old', today), 'old');
  assert.equal(resolveActiveTripId(trips, 'older', today), 'older');
});

test('with nothing remembered the newest open trip is picked', () => {
  const today = '2026-06-15';
  const trips = [{ id: 'new' }, { id: 'old' }];

  assert.equal(resolveActiveTripId(trips, '', today), 'new');
});

test('a remembered trip that has finished hands over to the newest open one', () => {
  const today = '2026-06-15';
  const trips = [
    { id: 'done', startDate: '2026-06-01', endDate: '2026-06-05' },
    { id: 'open', startDate: '2026-06-20', endDate: '2026-06-25' },
  ];

  assert.equal(resolveActiveTripId(trips, 'done', today), 'open');
});

test('a remembered trip that is no longer in the list is replaced', () => {
  // Leaving or deleting the trip it remembers must not leave the dashboard
  // pointing at nothing.
  const today = '2026-06-15';
  const trips = [{ id: 'open' }];

  assert.equal(resolveActiveTripId(trips, 'gone', today), 'open');
});

test('nothing open means no active trip', () => {
  const today = '2026-06-15';
  const trips = [{ id: 'done', startDate: '2026-06-01', endDate: '2026-06-05' }];

  assert.equal(resolveActiveTripId(trips, 'done', today), '');
  assert.equal(resolveActiveTripId([], '', today), '');
});

test('a trip taken off the dashboard stays off, even when one is open', () => {
  // A trip still months away is open by the date rules, so without the cleared
  // flag the dashboard would quietly pick it up again on the next load.
  const today = '2026-06-15';
  const trips = [{ id: 'far', startDate: '2026-12-01', endDate: '2026-12-08' }];

  assert.equal(resolveActiveTripId(trips, '', today), 'far');
  assert.equal(resolveActiveTripId(trips, '', today, true), '');
  assert.equal(resolveActiveTripId(trips, 'far', today, true), '');
});

test('a cleared dashboard stays cleared with several open trips', () => {
  const today = '2026-06-15';
  const trips = [{ id: 'new' }, { id: 'old' }];

  assert.equal(resolveActiveTripId(trips, 'old', today, true), '');
  // Picking one clears the flag, which is what brings a trip back.
  assert.equal(resolveActiveTripId(trips, 'old', today, false), 'old');
});

test('an end date before the start date is ignored', () => {
  // A one-day trip: the backwards end date must not make it look finished.
  const dates = { startDate: '2026-06-15', endDate: '2026-06-01' };

  assert.equal(tripIsOver(dates, '2026-06-15'), false);
  assert.equal(tripStatus(dates, '2026-06-15'), 'ongoing');
});

const three = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

test('the active trip moves to the top', () => {
  assert.deepEqual(
    pinActiveTrip(three, 'c').map((t) => t.id),
    ['c', 'a', 'b'],
  );
});

test('the other trips keep their order', () => {
  // Only the active one moves; b stays ahead of c even though c is active
  // now, because the sort chose that order for everything below the top.
  assert.deepEqual(
    pinActiveTrip(three, 'b').map((t) => t.id),
    ['b', 'a', 'c'],
  );
});

test('an active trip already first is left alone', () => {
  assert.deepEqual(
    pinActiveTrip(three, 'a').map((t) => t.id),
    ['a', 'b', 'c'],
  );
});

test('no active trip leaves the order untouched', () => {
  assert.deepEqual(
    pinActiveTrip(three, '').map((t) => t.id),
    ['a', 'b', 'c'],
  );
});

test('an active trip the filter removed pins nothing', () => {
  // Filtered to b and c, while a is the active trip: a is not in the list, so
  // nothing is pulled to the front and the filter wins.
  assert.deepEqual(
    pinActiveTrip([{ id: 'b' }, { id: 'c' }], 'a').map((t) => t.id),
    ['b', 'c'],
  );
});

test('an empty list stays empty', () => {
  assert.deepEqual(pinActiveTrip([], 'a'), []);
});
