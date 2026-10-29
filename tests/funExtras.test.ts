import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  REACTIONS,
  canUploadPhotos,
  guessesOpen,
  isDuplicateTrack,
  parseTrack,
  reactionRows,
  rouletteShares,
  rouletteSummary,
  toggleReaction,
} from '../src/utils/funExtras.ts';

const member = (id: string, fullname: string) => ({
  id,
  fullname,
  email: `${id}@example.com`,
  role: 'member' as const,
  joinedAt: '2026-01-01T00:00:00.000Z',
});

const members = [member('a', 'Ana Cruz'), member('b', 'Ben Reyes'), member('c', 'Cara Lim')];

/* ---------------------------------------------------------------- */
/* Reactions                                                        */
/* ---------------------------------------------------------------- */

test('a reaction is added for whoever tapped it', () => {
  assert.deepEqual(toggleReaction({}, '🔥', 'a'), { '🔥': ['a'] });
});

test('tapping the same face twice removes the reaction', () => {
  assert.deepEqual(toggleReaction({ '🔥': ['a'] }, '🔥', 'a'), {});
});

test('one reaction per person: a new face moves the old one', () => {
  assert.deepEqual(toggleReaction({ '🔥': ['a'] }, '😂', 'a'), { '😂': ['a'] });
});

test('moving away leaves other people on the old face', () => {
  assert.deepEqual(toggleReaction({ '🔥': ['a', 'b'] }, '😂', 'a'), {
    '🔥': ['b'],
    '😂': ['a'],
  });
});

test('an emoji nobody is left on is dropped', () => {
  assert.deepEqual(Object.keys(toggleReaction({ '🔥': ['a'] }, '🔥', 'a')), []);
});

test('the stored map is never mutated in place', () => {
  const original = { '🔥': ['a'] };
  toggleReaction(original, '😂', 'b');
  assert.deepEqual(original, { '🔥': ['a'] });
});

test('reaction rows count and name the people behind each face', () => {
  const rows = reactionRows({ '🔥': ['a', 'b'] }, members, 'a');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].count, 2);
  assert.deepEqual(rows[0].names, ['Ana', 'Ben']);
  assert.equal(rows[0].mine, true);
});

test('the most popular reaction comes first', () => {
  const rows = reactionRows({ '🔥': ['a'], '😂': ['a', 'b', 'c'] }, members, 'a');
  assert.deepEqual(
    rows.map((row) => row.emoji),
    ['😂', '🔥'],
  );
});

test('a face that is no longer offered is not drawn', () => {
  assert.deepEqual(reactionRows({ '🦄': ['a'] }, members, 'a'), []);
});

test('six faces are offered', () => {
  assert.equal(REACTIONS.length, 6);
});

/* ---------------------------------------------------------------- */
/* Soundtrack                                                       */
/* ---------------------------------------------------------------- */

test('"Artist - Song" is read into its two parts', () => {
  assert.deepEqual(parseTrack('Eraserheads - Ang Huling El Bimbo'), {
    artist: 'Eraserheads',
    title: 'Ang Huling El Bimbo',
  });
});

test('"Song by Artist" is read the other way round', () => {
  assert.deepEqual(parseTrack('Wonderwall by Oasis'), { title: 'Wonderwall', artist: 'Oasis' });
});

test('a bare name is treated as the song', () => {
  assert.deepEqual(parseTrack('Wonderwall'), { title: 'Wonderwall', artist: '' });
});

test('an empty box reads as no song', () => {
  assert.equal(parseTrack('   '), null);
});

test('the spaces people leave behind are squeezed', () => {
  assert.deepEqual(parseTrack('  Oasis   -   Wonderwall '), {
    artist: 'Oasis',
    title: 'Wonderwall',
  });
});

test('a pasted wall of text is capped', () => {
  assert.equal(parseTrack('x'.repeat(200))?.title.length, 60);
});

test('the same song is spotted whatever the case', () => {
  const tracks = [
    { id: '1', title: 'Wonderwall', artist: 'Oasis', addedBy: 'a', addedAt: '2026-01-01' },
  ];
  assert.equal(isDuplicateTrack(tracks, { title: 'wonderwall', artist: 'oasis' }), true);
});

test('a different song is let through', () => {
  const tracks = [
    { id: '1', title: 'Wonderwall', artist: 'Oasis', addedBy: 'a', addedAt: '2026-01-01' },
  ];
  assert.equal(isDuplicateTrack(tracks, { title: 'Wonderwall', artist: 'Someone else' }), false);
});

/* ---------------------------------------------------------------- */
/* Split roulette                                                   */
/* ---------------------------------------------------------------- */

test('the roulette hands out the whole amount, to the cent', () => {
  const shares = rouletteShares(100, ['a', 'b', 'c'], () => 0.4);
  const total = Object.values(shares).reduce((sum, value) => sum + value, 0);
  assert.equal(Math.round(total * 100), 10000);
});

test('no share comes out as zero', () => {
  const shares = rouletteShares(9.99, ['a', 'b', 'c'], () => 0);
  Object.values(shares).forEach((value) => assert.ok(value > 0));
});

test('equal weights split the bill evenly', () => {
  assert.deepEqual(
    rouletteShares(30, ['a', 'b', 'c'], () => 0.5),
    { a: 10, b: 10, c: 10 },
  );
});

test('a zero amount splits into nothing', () => {
  assert.deepEqual(rouletteShares(0, ['a', 'b']), {});
});

test('nobody to split between means nothing', () => {
  assert.deepEqual(rouletteShares(50, []), {});
});

test('the roulette result lists the biggest payer first', () => {
  const rows = rouletteSummary({ a: 5, b: 12 }, members, (value) => `P${value}`);
  assert.deepEqual(
    rows.map((row) => row.memberId),
    ['b', 'a'],
  );
  assert.equal(rows[0].label, 'P12');
});

/* ---------------------------------------------------------------- */
/* Guesses and note photos                                          */
/* ---------------------------------------------------------------- */

test('guesses stay closed until the trip ends', () => {
  assert.equal(guessesOpen(false), false);
  assert.equal(guessesOpen(true), true);
});

test('a note photo uploads while online', () => {
  assert.equal(canUploadPhotos(true).ok, true);
});

test('a note photo says why it waits when offline', () => {
  const gate = canUploadPhotos(false);
  assert.equal(gate.ok, false);
  assert.ok(gate.reason.includes('connection'));
});
