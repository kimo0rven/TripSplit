import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { buildActivity } from '../src/utils/activity.ts';

const source = {
  trip: { name: 'Baguio', createdBy: 'kim', createdAt: '2026-11-01T08:00:00Z' },
  members: [
    { id: 'kim', joinedAt: '2026-11-01T08:00:00Z', role: 'owner' },
    { id: 'ana', joinedAt: '2026-11-01T09:00:00Z', joinedWith: 'AB12CD' },
  ],
  expenses: [
    {
      id: 'e1',
      title: 'Dinner',
      amount: 900,
      createdBy: 'kim',
      createdAt: '2026-11-02T12:00:00Z',
      history: [
        {
          id: 'h1',
          at: '2026-11-02T13:00:00Z',
          by: 'ana',
          changes: [{ label: 'Amount', from: '₱900', to: '₱950' }],
        },
      ],
    },
  ],
  settlements: [
    {
      id: 's1',
      from: 'ana',
      to: 'kim',
      amount: 300,
      status: 'confirmed',
      createdBy: 'ana',
      createdAt: '2026-11-03T10:00:00Z',
      confirmedBy: 'kim',
      confirmedAt: '2026-11-03T11:00:00Z',
    },
  ],
  plans: [{ id: 'p1', title: 'Burnham Park', createdBy: 'kim', createdAt: 'not a date' }],
  nameOf: (id: string) => ({ kim: 'Kim', ana: 'Ana' })[id] ?? 'Someone',
  money: (value: number) => `₱${value}`,
};

describe('the trip activity log', () => {
  test('lists everything newest first', () => {
    assert.deepEqual(
      buildActivity(source).map((entry) => `${entry.by} ${entry.text}`),
      [
        'kim confirmed a payment: Ana → Kim · ₱300',
        'ana recorded a payment: Ana → Kim · ₱300',
        'ana edited Dinner',
        'kim added Dinner · ₱900',
        'ana joined with the invite code',
        'kim created Baguio',
      ],
    );
  });

  test('an edit carries what changed', () => {
    const edit = buildActivity(source).find((entry) => entry.text === 'edited Dinner');
    assert.deepEqual(edit?.details, ['Amount: ₱900 → ₱950']);
    assert.equal(edit?.targetId, 'e1');
  });

  test('the creator is not listed as joining, and bad dates are skipped', () => {
    const texts = buildActivity(source).map((entry) => entry.text);
    assert.equal(texts.filter((text) => text.startsWith('joined')).length, 1);
    assert.ok(!texts.some((text) => text.includes('Burnham')));
  });

  test('older string change logs still read', () => {
    const entries = buildActivity({
      ...source,
      expenses: [
        {
          id: 'e2',
          title: 'Taxi',
          amount: 200,
          history: [{ at: '2026-11-04T00:00:00Z', by: 'kim', changes: 'Title changed' }],
        },
      ],
    });
    assert.deepEqual(entries[0].details, ['Title changed']);
  });

  test('says who let a member in', () => {
    const entries = buildActivity({
      ...source,
      members: [{ id: 'ben', joinedAt: '2026-11-05T00:00:00Z', joinedWith: 'X', addedBy: 'kim' }],
    });
    assert.equal(entries[0].text, 'joined, let in by Kim');
  });

  test('deletions in the trash and closing the trip are listed', () => {
    const entries = buildActivity({
      ...source,
      trash: [
        {
          id: 'e9',
          kind: 'expense',
          item: { title: 'Taxi', amount: 250 },
          deletedAt: '2026-11-06T00:00:00Z',
          deletedBy: 'ana',
        },
      ],
      closed: { at: '2026-11-07T00:00:00Z', by: 'kim' },
    });
    assert.equal(entries[0].text, 'closed Baguio');
    assert.equal(entries[1].text, 'deleted Taxi · ₱250');
  });
});
