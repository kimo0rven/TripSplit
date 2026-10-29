import assert from 'node:assert/strict';
import test from 'node:test';

import { firstName, memberLookup } from '../src/utils/memberLookup.ts';

const ana = { id: 'a', fullname: 'Ana Villanueva', photoURL: 'ana.png' };
const ben = { id: 'b', fullname: 'Ben Cruz' };
const unnamed = { id: 'c' };

test('a lookup finds every member by id', () => {
  const lookup = memberLookup([ana, ben, unnamed]);
  assert.equal(lookup.get('a')?.fullname, 'Ana Villanueva');
  assert.equal(lookup.get('b')?.fullname, 'Ben Cruz');
});

test('someone who left the trip comes back as undefined', () => {
  const lookup = memberLookup([ana]);
  assert.equal(lookup.get('gone'), undefined);
  assert.equal(lookup.photoOf('gone'), undefined);
});

test('a missing name falls back to the caller default', () => {
  const lookup = memberLookup([unnamed]);
  assert.equal(lookup.nameOf('c'), 'Someone');
  assert.equal(lookup.nameOf('c', 'Someone who left'), 'Someone who left');
  assert.equal(lookup.nameOf('gone', 'Someone who left'), 'Someone who left');
});

test('an empty name counts as missing, not as a blank label', () => {
  const lookup = memberLookup([{ id: 'd', fullname: '' }]);
  assert.equal(lookup.nameOf('d'), 'Someone');
});

test('the photo comes back when there is one', () => {
  const lookup = memberLookup([ana, ben]);
  assert.equal(lookup.photoOf('a'), 'ana.png');
  assert.equal(lookup.photoOf('b'), undefined);
});

test('the first name is what a narrow card shows', () => {
  assert.equal(firstName('Ana Villanueva'), 'Ana');
  assert.equal(firstName('Maria Clara Santos'), 'Maria');
  assert.equal(firstName('  spaced  '), 'spaced');
});

test('a missing or blank name gets the fallback rather than an empty string', () => {
  assert.equal(firstName(undefined), 'Someone');
  assert.equal(firstName(''), 'Someone');
  assert.equal(firstName('   '), 'Someone');
  assert.equal(firstName(undefined, 'Someone who left'), 'Someone who left');
});

test('a duplicated id keeps a member rather than throwing', () => {
  const lookup = memberLookup([ana, { id: 'a', fullname: 'Other' }]);
  assert.equal(lookup.get('a')?.fullname, 'Other');
});
