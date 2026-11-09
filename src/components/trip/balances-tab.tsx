import Avatar from '@/components/ui/avatar';
import { Card, HelperText, ProgressBar, SectionTitle } from '@/components/ui/card';
import PaymentsList from '@/components/trip/payments-list';
import EmptyState from '@/components/ui/empty-state';
import { BrandColors, Spacing } from '@/constants/theme';
import WhyOweSheet from '@/components/trip/why-owe-sheet';
import { pendingBetween } from '@/utils/settle';
import { DebtEdge, Expense, MemberBalance, Settlement } from '@/types/expenses';
import { TripMember } from '@/types/trips';
import { formatMoney } from '@/utils/money';
import { memberLookup } from '@/utils/memberLookup';
import { remindDebtor } from '@/services/reminders/push';
import { ArrowRight, HelpCircle, Plus, Scale } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { themedStyles } from '@/constants/themed-styles';

interface BalancesTabProps {
  members: TripMember[];
  expenses: Expense[];
  settlements: Settlement[];
  balances: MemberBalance[];
  edges: DebtEdge[];
  currency: string;
  currentUserId: string;
  tripId?: string;
  tripName?: string;
  onViewAll?: () => void;
  onEditSettlement?: (settlement: Settlement) => void;
  onRespond?: (settlement: Settlement, accept: boolean) => void;
  onSettle: (preselect?: { from?: string; to?: string; amount?: number }) => void;
  /** Opens "Settle all", offered when you owe more than one person. */
  onSettleAll?: () => void;
  /**
   * Set while payments can't be recorded yet (the trip hasn't started): says
   * why, and the payment buttons are hidden.
   */
  settleLocked?: string;
}

/** How many payments the Balances tab lists before "View all". */
export const RECENT_PAYMENT_LIMIT = 3;

export default function BalancesTab({
  members,
  expenses,
  settlements,
  balances,
  edges,
  currency,
  currentUserId,
  tripId,
  tripName,
  onSettle,
  onSettleAll,
  settleLocked,
  onViewAll,
  onEditSettlement,
  onRespond,
}: BalancesTabProps) {
  const [showAllPairs, setShowAllPairs] = useState(false);
  /** Whether the "Debts simplified" card shows its longer explanation. */
  const [simplifyOpen, setSimplifyOpen] = useState(false);

  const lookup = useMemo(() => memberLookup(members), [members]);
  const nameOf = (id: string) => lookup.nameOf(id, 'Someone who left');
  const photoOf = lookup.photoOf;
  const first = (id: string) => nameOf(id).split(' ')[0];
  /** "You" for the person looking, otherwise their first name. */
  const who = (id: string) => (id === currentUserId ? 'You' : first(id));

  const [sentKey, setSentKey] = useState('');
  const remind = async (edge: DebtEdge) => {
    try {
      const result = await remindDebtor({
        debtorId: edge.from,
        debtorName: nameOf(edge.from),
        amount: edge.amount,
        currency,
        tripId: tripId ?? '',
        tripName: tripName ?? '',
        fromName: nameOf(currentUserId),
      });
      if (result === 'pushed') setSentKey(`${edge.from}-${edge.to}`);
    } catch (err) {
      console.warn('Could not send the reminder:', err);
    }
  };

  /** Whose debt the "Why?" sheet explains, or ''. */
  const [whyId, setWhyId] = useState('');
  const myBalance = balances.find((balance) => balance.memberId === currentUserId);
  const myDebts = edges.filter((edge) => edge.from === currentUserId && edge.amount > 0.004);
  /** Money already sent on this debt that the receiver hasn't confirmed yet. */
  const waitingOn = (edge: DebtEdge) => pendingBetween(settlements, edge.from, edge.to);
  const myNet = myBalance?.net ?? 0;

  const totalOwed = edges.reduce((sum, edge) => sum + edge.amount, 0);
  const biggest = edges.reduce((max, edge) => Math.max(max, edge.amount), 0);

  // Without simplification, every debtor would pay every creditor. This is
  // how many separate transfers that would take.
  const debtors = balances.filter((balance) => balance.net < -0.004).length;
  const creditors = balances.filter((balance) => balance.net > 0.004).length;
  const pairPayments = debtors * creditors;
  const savedPayments = Math.max(0, pairPayments - edges.length);
  const plural = (count: number) => `${count} ${count === 1 ? 'payment' : 'payments'}`;
  // No zeros: with nothing owed yet, say what simplifying will do instead.
  const simplifySummary =
    edges.length === 0
      ? 'Paying everyone back one by one can take a lot of payments. Once there are expenses, TripSplit works out the fewest payments that settle the whole trip.'
      : savedPayments > 0
        ? `Paying each person back one by one would take ${plural(pairPayments)}. With simplification it takes ${edges.length}, so ${savedPayments} fewer.`
        : `Settling up takes ${plural(edges.length)}, already the fewest possible.`;

  return (
    <View style={styles.wrap}>
      {/* Dashed and unfilled, so it doesn't compete with the trip card above. */}
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>
          {myNet > 0.004 ? 'You should receive' : myNet < -0.004 ? 'You owe' : 'You are all square'}
        </Text>
        <Text
          style={[
            styles.heroValue,
            myNet > 0.004 && styles.heroGet,
            myNet < -0.004 && styles.heroOwe,
          ]}
        >
          {formatMoney(Math.abs(myNet), currency)}
        </Text>
        <HelperText tone="muted">
          {myNet > 0.004
            ? 'The trip owes you this much in total.'
            : myNet < -0.004
              ? 'This is your share of everything spent so far.'
              : 'Nothing to pay and nothing to collect.'}
        </HelperText>
      </View>

      <SectionTitle>Who pays who</SectionTitle>

      {!!settleLocked && <HelperText>{settleLocked}</HelperText>}

      {!settleLocked && !!onSettleAll && myDebts.length > 1 && (
        <Pressable
          style={({ pressed }) => [styles.settleAll, pressed && styles.pressed]}
          onPress={onSettleAll}
          accessibilityRole="button"
        >
          <View style={styles.settleAllText}>
            <Text style={styles.settleAllTitle}>Settle all at once</Text>
            <Text style={styles.settleAllHint}>
              Pay all {myDebts.length} people you owe ·{' '}
              {formatMoney(
                myDebts.reduce((sum, edge) => sum + edge.amount, 0),
                currency,
              )}
            </Text>
          </View>
          <ArrowRight size={16} color={BrandColors.onBrand} />
        </Pressable>
      )}

      {edges.length === 0 ? (
        <EmptyState
          icon={Scale}
          title="Everyone is even"
          message="Once expenses are added, the smallest set of payments appears here."
        />
      ) : (
        <View style={styles.list}>
          {edges.map((edge) => {
            const waiting = waitingOn(edge);
            const canRemind = edge.to === currentUserId && waiting < edge.amount - 0.004;
            const key = `${edge.from}-${edge.to}`;
            return (
              // The buttons sit in their own row under the tappable part, not
              // inside it: a button inside a button is invalid on the web.
              <View key={key} style={styles.edgeCard}>
                <Pressable
                  style={({ pressed }) => [styles.edgeMain, pressed && styles.pressed]}
                  onPress={() =>
                    !settleLocked && onSettle({ from: edge.from, to: edge.to, amount: edge.amount })
                  }
                  disabled={!!settleLocked}
                  accessibilityRole="button"
                  accessibilityLabel={`${who(edge.from)} pays ${who(edge.to)} ${formatMoney(edge.amount, currency)}`}
                >
                  <View style={styles.avatars}>
                    <Avatar name={nameOf(edge.from)} size={36} photoURL={photoOf(edge.from)} />
                    <View style={styles.avatarSecond}>
                      <Avatar name={nameOf(edge.to)} size={36} photoURL={photoOf(edge.to)} />
                    </View>
                  </View>
                  <View style={styles.edgeMiddle}>
                    <View style={styles.namesRow}>
                      <Text style={styles.edgeName} numberOfLines={1}>
                        {who(edge.from)}
                      </Text>
                      <ArrowRight size={14} color={BrandColors.secondary} />
                      <Text style={styles.edgeName} numberOfLines={1}>
                        {who(edge.to)}
                      </Text>
                    </View>
                    {(waiting > 0 || !!settleLocked) && (
                      <Text
                        style={[styles.edgeHint, waiting > 0 && styles.edgeWaiting]}
                        numberOfLines={2}
                      >
                        {waiting > 0
                          ? `${formatMoney(waiting, currency)} sent, waiting for ${first(edge.to)} to confirm`
                          : 'Can be paid once the trip starts'}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.edgeAmount}>{formatMoney(edge.amount, currency)}</Text>
                </Pressable>

                <View style={styles.edgeActions}>
                  <Pressable
                    onPress={() => setWhyId(edge.from)}
                    style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
                    hitSlop={4}
                    accessibilityRole="button"
                    accessibilityLabel={`Why ${first(edge.from)} owes this`}
                  >
                    <HelpCircle size={13} color={BrandColors.info} />
                    <Text style={styles.chipWhy}>Why?</Text>
                  </Pressable>
                  <View style={styles.actionsRight}>
                    {canRemind && (
                      <Pressable
                        onPress={() => remind(edge)}
                        style={({ pressed }) => [
                          styles.chip,
                          styles.chipOutline,
                          pressed && styles.pressed,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Remind ${first(edge.from)}`}
                      >
                        <Text style={styles.chipText}>{sentKey === key ? 'Sent ✓' : 'Remind'}</Text>
                      </Pressable>
                    )}
                    {!settleLocked && (
                      <Pressable
                        onPress={() =>
                          onSettle({ from: edge.from, to: edge.to, amount: edge.amount })
                        }
                        style={({ pressed }) => [
                          styles.chip,
                          styles.chipFilled,
                          pressed && styles.pressed,
                        ]}
                        accessibilityRole="button"
                      >
                        <Text style={[styles.chipText, styles.chipTextFilled]}>
                          {edge.from === currentUserId ? 'Pay' : 'Record payment'}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Tapping the card shows or hides the longer explanation. */}
      <Pressable
        onPress={() => setSimplifyOpen((open) => !open)}
        accessibilityRole="button"
        accessibilityState={{ expanded: simplifyOpen }}
        accessibilityHint={simplifyOpen ? 'Hides the explanation' : 'Shows how this works'}
      >
        <Card style={styles.simplifyCard}>
          <View style={styles.simplifyHeader}>
            <Scale size={16} color={BrandColors.primary} />
            <Text style={styles.simplifyTitle}>Debts simplified</Text>
          </View>
          <Text style={styles.simplifyText}>{simplifySummary}</Text>
          {simplifyOpen && (
            <>
              <HelperText>
                A new expense can change who pays whom, but never how much anyone owes in total.
                People who already paid each other stay paired, so the list changes as little as it
                can. Tap Why? on any payment to see the expenses behind it.
              </HelperText>
              {edges.length > 0 && (
                <HelperText>
                  Total still to move around: {formatMoney(totalOwed, currency)}
                  {biggest > 0 ? ` · largest single payment ${formatMoney(biggest, currency)}` : ''}
                </HelperText>
              )}
            </>
          )}
        </Card>
      </Pressable>

      <SectionTitle
        right={
          <Pressable onPress={() => setShowAllPairs((value) => !value)} hitSlop={8}>
            <Text style={styles.linkText}>{showAllPairs ? 'Hide' : 'Show all'}</Text>
          </Pressable>
        }
      >
        Member balances
      </SectionTitle>

      <View style={styles.list}>
        {balances.map((balance) => (
          <Card key={balance.memberId} style={styles.balanceCard}>
            <View style={styles.balanceTop}>
              <Avatar
                name={nameOf(balance.memberId)}
                size={32}
                photoURL={photoOf(balance.memberId)}
              />
              <Text style={styles.balanceName} numberOfLines={1}>
                {nameOf(balance.memberId)}
                {balance.memberId === currentUserId ? ' (you)' : ''}
              </Text>
              <Text
                style={[
                  styles.balanceNet,
                  {
                    color:
                      balance.net > 0.004
                        ? BrandColors.success
                        : balance.net < -0.004
                          ? BrandColors.error
                          : BrandColors.secondary,
                  },
                ]}
              >
                {balance.net > 0.004 ? '+' : ''}
                {formatMoney(balance.net, currency)}
              </Text>
            </View>

            {showAllPairs && (
              <View style={styles.balanceMeta}>
                <Text style={styles.metaText}>Paid {formatMoney(balance.paid, currency)}</Text>
                <Text style={styles.metaText}>Owes {formatMoney(balance.owed, currency)}</Text>
              </View>
            )}

            {showAllPairs && balance.paid > 0 && (
              <ProgressBar
                ratio={balance.paid / Math.max(balance.paid, balance.owed, 1)}
                color={BrandColors.base50}
                height={6}
              />
            )}
          </Card>
        ))}
      </View>

      <SectionTitle
        right={
          settlements.length > 0 && !!onViewAll ? (
            <Pressable onPress={onViewAll} hitSlop={8} accessibilityRole="link">
              <Text style={styles.viewAllLink}>View all</Text>
            </Pressable>
          ) : null
        }
      >
        Payments recorded
      </SectionTitle>

      {!settleLocked && (
        <Pressable
          style={({ pressed }) => [styles.recordButton, pressed && styles.pressed]}
          onPress={() => onSettle()}
          accessibilityRole="button"
        >
          <Plus size={16} color={BrandColors.primary} />
          <Text style={styles.recordText}>Record a payment</Text>
        </Pressable>
      )}

      {settlements.length === 0 ? (
        <HelperText>
          No payments recorded yet. Tap a debt above once someone hands over cash.
        </HelperText>
      ) : (
        <PaymentsList
          settlements={settlements.slice(0, RECENT_PAYMENT_LIMIT)}
          allSettlements={settlements}
          expenses={expenses}
          members={members}
          currency={currency}
          currentUserId={currentUserId}
          onEditSettlement={onEditSettlement}
          onRespond={onRespond}
        />
      )}

      <HelperText>
        {expenses.length} expenses and {settlements.length} payments counted.
      </HelperText>

      <WhyOweSheet
        debtorId={whyId}
        onClose={() => setWhyId('')}
        edges={edges}
        expenses={expenses}
        settlements={settlements}
        members={members}
        currency={currency}
        currentUserId={currentUserId}
      />
    </View>
  );
}

const styles = themedStyles(() => ({
  viewAllLink: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    color: BrandColors.info,
  },
  declinedText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: BrandColors.error,
    paddingHorizontal: Spacing.two,
  },
  settlementActions: { flexDirection: 'row', gap: Spacing.four, paddingHorizontal: Spacing.two },
  actionLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: BrandColors.primary,
  },
  recordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: BrandColors.base50,
    borderRadius: 12,
    paddingVertical: Spacing.three,
  },
  recordText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14,
    color: BrandColors.primary,
  },
  proofThumb: { width: 36, height: 36, borderRadius: 8 },
  proofCount: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 10,
    color: BrandColors.secondary,
    textAlign: 'center',
  },
  wrap: {
    gap: Spacing.three,
  },
  hero: {
    gap: 2,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: BrandColors.base50,
    borderRadius: 15,
    padding: Spacing.three,
  },
  heroGet: { color: BrandColors.success },
  heroOwe: { color: BrandColors.error },
  heroLabel: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: BrandColors.primary,
  },
  heroValue: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 26,
    color: BrandColors.primary,
  },
  list: {
    gap: Spacing.two,
  },
  edgeCard: {
    backgroundColor: BrandColors.background,
    borderWidth: 1,
    borderColor: BrandColors.base200,
    borderRadius: 15,
    overflow: 'hidden',
  },
  settleAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: BrandColors.base50,
    borderRadius: 15,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  settleAllText: { flex: 1, gap: 2 },
  settleAllTitle: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: BrandColors.onBrand },
  settleAllHint: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: BrandColors.onBrand,
  },
  edgeMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  pressed: {
    opacity: 0.75,
  },
  avatars: { flexDirection: 'row', alignItems: 'center' },
  avatarSecond: {
    marginLeft: -12,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: BrandColors.background,
  },
  edgeMiddle: {
    flex: 1,
    gap: 3,
  },
  namesRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  edgeName: {
    flexShrink: 1,
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 15,
    color: BrandColors.primary,
  },
  edgeHint: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 16,
    color: BrandColors.secondary,
  },
  edgeWaiting: { color: BrandColors.warning },
  edgeAmount: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 17,
    color: BrandColors.primary,
  },
  edgeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    paddingTop: Spacing.one,
  },
  actionsRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
  },
  chipOutline: { borderWidth: 1, borderColor: BrandColors.border },
  chipFilled: { backgroundColor: BrandColors.base50 },
  chipTextFilled: { color: BrandColors.onBrand },
  chipWhy: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 12, color: BrandColors.info },
  chipText: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 12, color: BrandColors.primary },
  simplifyCard: {
    backgroundColor: BrandColors.surfaceAlt,
  },
  simplifyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  simplifyTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    color: BrandColors.primary,
  },
  simplifyText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: BrandColors.primary,
    lineHeight: 17,
  },
  linkText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: BrandColors.info,
  },
  balanceCard: {
    gap: Spacing.two,
  },
  balanceTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  balanceName: {
    flex: 1,
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 13,
    color: BrandColors.primary,
  },
  balanceNet: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
  },
  balanceMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    color: BrandColors.secondary,
  },
}));
