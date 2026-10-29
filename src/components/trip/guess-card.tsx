import Avatar from '@/components/ui/avatar';
import { Card, HelperText } from '@/components/ui/card';
import { BrandColors, Spacing } from '@/constants/theme';
import { fetchGuesses, saveGuess } from '@/services/Firebase/funService';
import { saveErrorMessage } from '@/services/offline/offlineStore';
import { TripMember } from '@/types/trips';
import { scoreGuesses } from '@/utils/fun';
import { GUESSES_LOCKED_HINT, guessesOpen } from '@/utils/funExtras';
import { formatMoney, parseAmount } from '@/utils/money';
import { EyeOff, Target, Trophy } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

interface GuessCardProps {
  tripId: string;
  members: TripMember[];
  currency: string;
  currentUserId: string;
  /** The real total of the trip. */
  actual: number;
  /** True once the trip has finished, which is when guesses are revealed. */
  tripEnded: boolean;
}

/**
 * Everyone guesses the trip total, closest wins.
 *
 * Guesses are hidden until the trip ends. Otherwise the first person to open
 * this tab could read the total off the recap and win by typing it back, which
 * is not a game.
 *
 * The score itself is computed by `scoreGuesses`, which is pure and tested; this
 * card only shows what it returns.
 */
export default function GuessCard({
  tripId,
  members,
  currency,
  currentUserId,
  actual,
  tripEnded,
}: GuessCardProps) {
  const [guesses, setGuesses] = useState<Record<string, number>>({});
  const [draft, setDraft] = useState('');
  /**
   * Whether the amount box is open.
   *
   * It opens on its own for someone who has not guessed yet, and stays shut for
   * someone who has, so their guess reads as an answer rather than as an empty
   * box they appear to have lost. "Change guess" opens it again.
   */
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!tripId) return;
    try {
      setGuesses(await fetchGuesses(tripId));
    } catch (err) {
      console.error('Could not load the guesses:', err);
    } finally {
      setLoaded(true);
    }
  }, [tripId]);

  useEffect(() => {
    load();
  }, [load]);

  const open = guessesOpen(tripEnded);
  const scored = useMemo(() => scoreGuesses(actual, guesses), [actual, guesses]);
  const mine = guesses[currentUserId];
  const showInput = !mine || editing;
  const nameOf = (id: string) =>
    members.find((member) => member.id === id)?.fullname.split(' ')[0] ?? 'Someone';
  const photoOf = (id: string) => members.find((member) => member.id === id)?.photoURL;

  const handleSave = async () => {
    if (!currentUserId || busy) return;

    const amount = parseAmount(draft) / 100;
    if (!amount || amount <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      await saveGuess(tripId, currentUserId, amount);
      setGuesses((previous) => ({ ...previous, [currentUserId]: amount }));
      setDraft('');
      setEditing(false);
    } catch (err) {
      console.error('Could not save the guess:', err);
      setError(saveErrorMessage(err, 'That guess could not be saved. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  /** Opens the box again with the old amount ready to be replaced. */
  const startEditing = () => {
    if (!mine) return;
    setDraft(mine.toFixed(2));
    setError('');
    setEditing(true);
  };

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <Target size={16} color={BrandColors.primary} />
        <Text style={styles.title}>Guess the total</Text>
        {!open && <EyeOff size={13} color={BrandColors.secondary} />}
      </View>

      <HelperText>
        {open
          ? 'The trip is over, so the guesses are in. Closest wins bragging rights.'
          : GUESSES_LOCKED_HINT}
      </HelperText>

      {!open ? (
        <View style={styles.lockedBox}>
          {!!mine && (
            <View style={styles.mineRow}>
              <Text style={styles.lockedText}>
                Your guess is in at {formatMoney(mine, currency)}.
              </Text>
              {editing ? (
                <Pressable
                  onPress={() => {
                    setEditing(false);
                    setDraft('');
                    setError('');
                  }}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Keep your old guess"
                >
                  <Text style={styles.changeLink}>Cancel</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={startEditing}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Change your guess"
                >
                  <Text style={styles.changeLink}>Change</Text>
                </Pressable>
              )}
            </View>
          )}

          {showInput && (
            <>
              <Text style={styles.lockedText}>
                {mine
                  ? 'What should it be instead?'
                  : "Nobody can see anyone's guess yet. What is it?"}
              </Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  value={draft}
                  onChangeText={(text) => {
                    setDraft(text);
                    if (error) setError('');
                  }}
                  placeholder="0.00"
                  placeholderTextColor={BrandColors.secondary}
                  keyboardType="numeric"
                  returnKeyType="done"
                  onSubmitEditing={handleSave}
                />
                <Pressable
                  onPress={handleSave}
                  disabled={!draft.trim() || busy}
                  style={({ pressed }) => [
                    styles.saveButton,
                    (!draft.trim() || busy) && styles.disabled,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                >
                  {busy ? (
                    <ActivityIndicator size="small" color={BrandColors.primary} />
                  ) : (
                    <Text style={styles.saveText}>{mine ? 'Update' : 'Lock in'}</Text>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </View>
      ) : scored.list.length === 0 ? (
        <Text style={styles.lockedText}>
          Nobody guessed. The total was {formatMoney(actual, currency)}.
        </Text>
      ) : (
        <View style={styles.list}>
          <Text style={styles.actual}>The total came to {formatMoney(actual, currency)}</Text>

          {scored.list.map((entry) => {
            const won = scored.winner?.memberId === entry.memberId;
            const isMe = entry.memberId === currentUserId;
            return (
              <View key={entry.memberId} style={[styles.row, won && styles.rowWon]}>
                <Avatar
                  name={nameOf(entry.memberId)}
                  size={30}
                  photoURL={photoOf(entry.memberId)}
                />
                <View style={styles.body}>
                  <Text style={styles.name} numberOfLines={1}>
                    {nameOf(entry.memberId)}
                    {isMe ? ' (you)' : ''}
                  </Text>
                  <Text style={styles.distance}>
                    {entry.distance === 0
                      ? 'exactly right'
                      : `${formatMoney(entry.distance, currency)} off`}
                  </Text>
                </View>
                {won && <Trophy size={15} color={BrandColors.base700} />}
                <Text style={styles.guess}>{formatMoney(entry.guess, currency)}</Text>
              </View>
            );
          })}
        </View>
      )}

      {!!error && <Text style={styles.error}>{error}</Text>}
      {loaded && !open && !!mine && (
        <Text style={styles.count}>
          {scored.list.length} of {members.length} have guessed.
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: BrandColors.surfaceAlt,
    gap: Spacing.two,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  title: {
    flex: 1,
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 15,
    color: BrandColors.primary,
  },
  lockedBox: {
    gap: Spacing.two,
  },
  mineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  changeLink: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 12,
    color: BrandColors.info,
  },
  lockedText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: BrandColors.primary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  input: {
    flex: 1,
    minWidth: 0,
    backgroundColor: BrandColors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BrandColors.border,
    paddingHorizontal: Spacing.three,
    paddingVertical: 9,
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    color: BrandColors.primary,
  },
  saveButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: BrandColors.base50,
  },
  saveText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    color: BrandColors.primary,
  },
  list: {
    gap: Spacing.one,
  },
  actual: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 12,
    color: BrandColors.secondary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: BrandColors.background,
    borderRadius: 12,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  rowWon: {
    backgroundColor: BrandColors.base200,
  },
  body: {
    flex: 1,
    gap: 1,
  },
  name: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    color: BrandColors.primary,
  },
  distance: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    color: BrandColors.secondary,
  },
  guess: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    color: BrandColors.primary,
  },
  count: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    color: BrandColors.secondary,
  },
  error: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 11,
    color: BrandColors.error,
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.6,
  },
});
