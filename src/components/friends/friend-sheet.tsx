import PrimaryButton from '@/components/Button/primary-button';
import Avatar from '@/components/ui/avatar';
import BottomSheet from '@/components/ui/bottom-sheet';
import { BrandColors, Spacing } from '@/constants/theme';
import { fetchDebtsWithFriend, FriendDebt } from '@/services/Firebase/friendService';
import { FriendProfile } from '@/types/friends';
import { formatMoney } from '@/utils/money';
import { ChevronRight, Trash2, Wallet } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface FriendSheetProps {
  visible: boolean;
  onClose: () => void;
  friend: FriendProfile | null;
  /** The signed-in user, needed to work out which side of a debt is "you". */
  currentUserId: string;
  /** Says yes to removing the friendship. The screen asks "are you sure?". */
  onRemove: (friend: FriendProfile) => void;
  /** Opens the settle-up form for one of the trips you share. */
  onPay: (friend: FriendProfile, tripId: string) => void;
}

/**
 * One friend, with a thin yellow ring around their face, their name and email,
 * then three buttons: Pay, Cancel and Remove friend.
 *
 * What they owe you is read from the trips you share rather than stored on the
 * friendship, so it always matches the balances screens. Trips where the two of
 * you are level are left out - the list only shows what is actually open.
 */
export default function FriendSheet({
  visible,
  onClose,
  friend,
  currentUserId,
  onRemove,
  onPay,
}: FriendSheetProps) {
  const [debts, setDebts] = useState<FriendDebt[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Set when the Pay button has to ask which trip the payment belongs to.
  const [choosingTrip, setChoosingTrip] = useState(false);

  useEffect(() => {
    if (!visible || !friend?.id || !currentUserId) return;

    let cancelled = false;
    setLoading(true);
    setError('');
    setChoosingTrip(false);

    fetchDebtsWithFriend(currentUserId, friend.id)
      .then((found) => {
        if (!cancelled) setDebts(found);
      })
      .catch((err) => {
        console.error('Failed to work out what you owe this friend:', err);
        if (!cancelled) setError('Could not read your balances with them right now.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible, friend?.id, currentUserId]);

  /** Only the trips where YOU are the one who owes can be paid from here. */
  const payable = useMemo(() => debts.filter((debt) => debt.youOwe > 0), [debts]);

  /**
   * Totals across trips, but only where the currencies match - adding pesos to
   * dollars would produce a number that means nothing.
   */
  const totals = useMemo(() => {
    const byCurrency = new Map<string, number>();
    debts.forEach((debt) => {
      byCurrency.set(debt.currency, (byCurrency.get(debt.currency) ?? 0) + debt.youOwe);
    });
    return [...byCurrency.entries()].map(([currency, amount]) => ({
      currency,
      amount: Math.round(amount * 100) / 100,
    }));
  }, [debts]);

  const theyOweYou = totals.filter((entry) => entry.amount < 0);
  const youOwe = totals.filter((entry) => entry.amount > 0);

  /** One trip pays straight away; several ask which one first. */
  const handlePay = () => {
    if (!friend || payable.length === 0) return;

    if (payable.length === 1) {
      onPay(friend, payable[0].tripId);
      return;
    }

    setChoosingTrip((previous) => !previous);
  };

  const firstName = friend?.fullname?.split(' ')[0] || 'them';

  return (
    <BottomSheet visible={visible} title="Friend details" onClose={onClose}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* The face, framed the way the app frames things you are looking at. */}
        <View style={styles.identity}>
          <View style={styles.avatarRing}>
            <Avatar name={friend?.fullname} size={72} photoURL={friend?.photoURL} />
          </View>
          <Text style={styles.name} numberOfLines={1}>
            {friend?.fullname || 'Friend'}
          </Text>
          {!!friend?.email && (
            <Text style={styles.email} numberOfLines={1}>
              {friend.email}
            </Text>
          )}
        </View>

        <View style={styles.moneyBox}>
          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator color={BrandColors.base50} />
            </View>
          ) : error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : debts.length === 0 ? (
            <Text style={styles.settledText}>
              You are all square with {firstName}. Nothing is owed either way.
            </Text>
          ) : (
            <>
              {theyOweYou.map((entry) => (
                <Text key={`in-${entry.currency}`} style={styles.totalLine}>
                  They owe you{' '}
                  <Text style={styles.totalPositive}>
                    {formatMoney(-entry.amount, entry.currency)}
                  </Text>
                </Text>
              ))}
              {youOwe.map((entry) => (
                <Text key={`out-${entry.currency}`} style={styles.totalLine}>
                  You owe them{' '}
                  <Text style={styles.totalNegative}>
                    {formatMoney(entry.amount, entry.currency)}
                  </Text>
                </Text>
              ))}

              <View style={styles.tripList}>
                {debts.map((debt) => (
                  <View key={debt.tripId} style={styles.tripRow}>
                    <View style={styles.tripInfo}>
                      <Text style={styles.tripName} numberOfLines={1}>
                        {debt.tripName}
                      </Text>
                      <Text
                        style={[styles.tripAmount, debt.youOwe < 0 && styles.tripAmountPositive]}
                      >
                        {formatMoney(Math.abs(debt.youOwe), debt.currency)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>

        {/* When more than one trip is unpaid, the Pay button lists them instead
            of guessing which one the payment belongs to. */}
        {choosingTrip && payable.length > 1 && (
          <View style={styles.pickList}>
            <Text style={styles.pickLabel}>Which trip is this payment for?</Text>
            {payable.map((debt) => (
              <Pressable
                key={debt.tripId}
                style={({ pressed }) => [styles.pickRow, pressed && styles.pressed]}
                onPress={() => friend && onPay(friend, debt.tripId)}
              >
                <View style={styles.tripInfo}>
                  <Text style={styles.tripName} numberOfLines={1}>
                    {debt.tripName}
                  </Text>
                  <Text style={styles.tripAmount}>
                    {formatMoney(debt.youOwe, debt.currency)} to pay
                  </Text>
                </View>
                <ChevronRight size={16} color={BrandColors.secondary} />
              </Pressable>
            ))}
          </View>
        )}

        {!loading && !error && (
          <View style={styles.noteRow}>
            <Wallet size={13} color={BrandColors.secondary} />
            <Text style={styles.note}>
              {payable.length > 0
                ? 'Pay opens the settle-up form for that trip, where you can pay in full or in part.'
                : debts.length === 0
                  ? 'Balances come from the trips you share, so they update as soon as an expense or a payment is added.'
                  : `Only ${firstName} can record a payment, because you are the one being paid back.`}
            </Text>
          </View>
        )}

        {/* The three actions, stacked: Pay, Cancel, Remove friend. */}
        <View style={styles.actions}>
          <PrimaryButton
            title={choosingTrip && payable.length > 1 ? 'Pick a trip above' : 'Pay'}
            onPress={handlePay}
            buttonColor={BrandColors.base50}
            textColor={BrandColors.primary}
            borderColor={BrandColors.base50}
            borderWidth={0}
            disabled={loading || !!error || payable.length === 0}
          />
          <PrimaryButton
            title="Cancel"
            onPress={onClose}
            buttonColor={BrandColors.surfaceAlt}
            textColor={BrandColors.primary}
            borderColor={BrandColors.border}
            borderWidth={1}
          />
          <PrimaryButton
            title="Remove friend"
            onPress={() => friend && onRemove(friend)}
            buttonColor={BrandColors.errorBg}
            textColor={BrandColors.error}
            borderColor={BrandColors.errorBg}
            borderWidth={0}
          />
        </View>

        <View style={styles.warnRow}>
          <Trash2 size={12} color={BrandColors.secondary} />
          <Text style={styles.warn}>
            Removing a friend does not cancel what you owe each other, and you can add them again
            later. They stay in the trips you already share.
          </Text>
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.three,
    paddingBottom: Spacing.four,
  },
  identity: {
    alignItems: 'center',
    gap: Spacing.half,
    paddingTop: Spacing.two,
  },
  // A thin yellow ring around the face. Padding on the wrapper keeps the circle
  // inside exactly the size it was asked to be.
  avatarRing: {
    padding: 3,
    borderRadius: 44,
    borderWidth: 1.5,
    borderColor: BrandColors.base50,
  },
  name: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 18,
    color: BrandColors.primary,
    marginTop: Spacing.two,
  },
  email: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13,
    color: BrandColors.secondary,
  },
  moneyBox: {
    backgroundColor: BrandColors.surfaceAlt,
    borderRadius: 15,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  centerBox: {
    paddingVertical: Spacing.four,
    alignItems: 'center',
  },
  errorText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13,
    color: BrandColors.error,
    textAlign: 'center',
  },
  settledText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13,
    lineHeight: 20,
    color: BrandColors.secondary,
    textAlign: 'center',
  },
  totalLine: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14,
    color: BrandColors.primary,
  },
  totalPositive: {
    fontFamily: 'PlusJakartaSans-Bold',
    color: BrandColors.success,
  },
  totalNegative: {
    fontFamily: 'PlusJakartaSans-Bold',
    color: BrandColors.error,
  },
  tripList: {
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  tripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BrandColors.background,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 12,
    padding: Spacing.two,
  },
  tripInfo: {
    flex: 1,
    gap: 1,
  },
  tripName: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    color: BrandColors.primary,
  },
  tripAmount: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: BrandColors.error,
  },
  tripAmountPositive: {
    color: BrandColors.success,
  },
  pickList: {
    gap: Spacing.two,
  },
  pickLabel: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: BrandColors.secondary,
  },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: BrandColors.background,
    borderWidth: 1,
    borderColor: BrandColors.base50,
    borderRadius: 12,
    padding: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  note: {
    flex: 1,
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    lineHeight: 16,
    color: BrandColors.secondary,
  },
  actions: {
    gap: Spacing.two,
  },
  warnRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  warn: {
    flex: 1,
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 10,
    lineHeight: 14,
    color: BrandColors.secondary,
  },
});
