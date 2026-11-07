import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  buildInviteEntry,
  joinStepFor,
  memberOrigin,
  readInviteEntry,
} from '../src/utils/joinInvite.ts';

const trip = {
  id: 't1',
  name: 'Baguio Weekend',
  createdBy: 'kim',
  members: { kim: { fullname: 'Kim Valencia' }, ana: { fullname: 'Ana' } },
  startDate: '2026-11-20',
  endDate: '2026-11-22',
};

describe('the copy kept beside an invite code', () => {
  test('carries the name, owner, dates and whether the owner approves', () => {
    assert.deepEqual(buildInviteEntry({ ...trip, requireApproval: true }), {
      tripId: 't1',
      name: 'Baguio Weekend',
      ownerId: 'kim',
      ownerName: 'Kim Valencia',
      startDate: '2026-11-20',
      endDate: '2026-11-22',
      requireApproval: true,
    });
  });

  test('leaves out what the trip does not have', () => {
    const entry = buildInviteEntry({ id: 't2', name: 'Day trip', createdBy: 'x' });
    assert.deepEqual(entry, {
      tripId: 't2',
      name: 'Day trip',
      ownerId: 'x',
      requireApproval: false,
    });
  });

  test('an end date without a start date is dropped', () => {
    assert.equal(buildInviteEntry({ ...trip, startDate: undefined }).endDate, undefined);
  });

  test('old codes that hold only the trip id still read', () => {
    assert.deepEqual(readInviteEntry('t1'), { tripId: 't1', name: '' });
  });

  test('a full entry reads back the same', () => {
    const entry = buildInviteEntry({ ...trip, requireApproval: true });
    assert.deepEqual(readInviteEntry(entry), entry);
  });

  test('junk is not a code', () => {
    assert.equal(readInviteEntry(null), null);
    assert.equal(readInviteEntry(''), null);
    assert.equal(readInviteEntry({ name: 'No id' }), null);
    assert.equal(readInviteEntry(42), null);
  });
});

describe('what the join screen offers', () => {
  test('an open trip joins straight away', () => {
    assert.equal(joinStepFor({ requireApproval: false }, { isMember: false }), 'join');
  });

  test('a trip the owner approves sends a request', () => {
    assert.equal(joinStepFor({ requireApproval: true }, { isMember: false }), 'ask');
  });

  test('a request already sent is waiting, or was declined', () => {
    assert.equal(
      joinStepFor({ requireApproval: true }, { isMember: false, request: { fullname: 'A' } }),
      'pending',
    );
    assert.equal(
      joinStepFor({ requireApproval: true }, { isMember: false, request: { status: 'declined' } }),
      'declined',
    );
  });

  test('a member is already in, whatever else is stored', () => {
    assert.equal(
      joinStepFor({ requireApproval: true }, { isMember: true, request: { status: 'declined' } }),
      'member',
    );
  });
});

describe('how a member got in', () => {
  const nameOf = (id: string) => ({ kim: 'Kim', ana: 'Ana' })[id] ?? 'Someone';

  test('each way in reads plainly', () => {
    assert.equal(memberOrigin({ joinedWith: 'AB12CD' }, nameOf), 'Joined with the invite code');
    assert.equal(memberOrigin({ joinedWith: 'AB12CD', addedBy: 'kim' }, nameOf), 'Let in by Kim');
    assert.equal(memberOrigin({ addedBy: 'kim' }, nameOf), 'Added by Kim');
    assert.equal(
      memberOrigin({ addedBy: 'kim', invitedBy: 'ana' }, nameOf),
      'Invited by Ana · let in by Kim',
    );
  });

  test('the owner and older members say nothing', () => {
    assert.equal(memberOrigin({ role: 'owner', addedBy: 'kim' }, nameOf), '');
    assert.equal(memberOrigin({}, nameOf), '');
  });
});
