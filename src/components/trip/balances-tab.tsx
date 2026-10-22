import Avatar from '@/components/ui/avatar';
import { Card, HelperText, ProgressBar, SectionTitle } from '@/components/ui/card';
import PaymentsList from '@/components/trip/payments-list';
import EmptyState from '@/components/ui/empty-state';
import { BrandColors, Spacing } from '@/constants/theme';
import { DebtEdge, Expense, MemberBalance, Settlement } from '@/types/expenses';
import { TripMember } from '@/types/trips';
import { formatMoney } from '@/utils/money';
import { remindDebtor } from '@/services/reminders/push';
import { ArrowRight, Plus, Scale } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
}

/** How many payments the Balances tab lists before "View all". */
export const RECENT_PAYMENT_LIMIT = 5;

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
  onViewAll,
  onEditSettlement,
  onRespond,
}: BalancesTabProps) {
  const [showAllPairs, setShowAllPairs] = useState(false);

  const nameOf = (id: string) =>
    members.find((member) => member.id === id)?.fullname ?? 'Someone who left';
  const photoOf = (id: string) => members.find((member) => member.id === id)?.photoURL;
  const first = (id: string) => nameOf(id).split(' ')[0];

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

  const myBalance = balances.find((balance) => balance.memberId === currentUserId);
  const myNet = myBalance?.net ?? 0;

  const totalOwed = edges.reduce((sum, edge) => sum + edge.amount, 0);
  const biggest = edges.reduce((max, edge) => Math.max(max, edge.amount), 0);

  // Without simplification, every debtor would pay every creditor. This is
  // how many separate transfers that would take.
  const debtors = balances.filter((balance) => balance.net < -0.004).length;
  const creditors = balances.filter((balance) => balance.net > 0.004).length;
  const pairPayments = debtors * creditors;
  const savedPayments = Math.max(0, pairPayments - edges.length);

  return (
    <View style={styles.wrap}>
      <Card style={styles.hero}>
        <Text style={styles.heroLabel}>
          {myNet > 0.004 ? 'You should receive' : myNet < -0.004 ? 'You owe' : 'You are all square'}
        </Text>
        <Text style={styles.heroValue}>{formatMoney(Math.abs(myNet), currency)}</Text>
        <HelperText tone="muted">
          {myNet > 0.004
            ? 'The trip owes you this much in total.'
            : myNet < -0.004
              ? 'This is your share of everything spent so far.'
              : 'Nothing to pay and nothing to collect.'}
        </HelperText>
      </Card>

      <SectionTitle>Who pays who</SectionTitle>

      {edges.length === 0 ? (
        <EmptyState
          icon={Scale}
          title="Everyone is even"
          message="Once expenses are added, the smallest set of payments appears here."
        />
      ) : (
        <View style={styles.list}>
          {edges.map((edge) => (
            <Pressable
              key={`${edge.from}-${edge.to}`}
              style={({ pressed }) => [styles.edgeCard, pressed && styles.pressed]}
              onPress={() => onSettle({ from: edge.from, to: edge.to, amount: edge.amount })}
            >
              <Avatar name={nameOf(edge.from)} size={34} photoURL={photoOf(edge.from)} />
              <View style={styles.edgeMiddle}>
                <Text style={styles.edgeText} numberOfLines={1}>
                  {first(edge.from)} pays {first(edge.to)}
                </Text>
                <Text style={styles.edgeHint}>Tap to record this payment</Text>
              </View>
              <View style={styles.edgeRight}>
                <Text style={styles.edgeAmount}>{formatMoney(edge.amount, currency)}</Text>
                <ArrowRight size={14} color={BrandColors.secondary} />
              </View>
              {edge.to === currentUserId && (
                <Pressable
                  onPress={() => remind(edge)}
                  style={styles.remindBtn}
                  accessibilityRole="button"
                  accessibilityLabel={`Remind ${first(edge.from)}`}
                >
                  <Text style={styles.remindText}>
                    {sentKey === `${edge.from}-${edge.to}` ? 'Sent ✓' : 'Remind'}
                  </Text>
                </Pressable>
              )}
            </Pressable>
          ))}
        </View>
      )}

      <Card style={styles.simplifyCard}>
        <View style={styles.simplifyHeader}>
          <Scale size={16} color={BrandColors.primary} />
          <Text style={styles.simplifyTitle}>Debts simplified</Text>
        </View>
        <Text style={styles.simplifyText}>
          Paying each person back one by one would take {pairPayments}{' '}
          {pairPayments === 1 ? 'payment' : 'payments'}. With simplification it takes {edges.length}
          {savedPayments > 0 ? `, so ${savedPayments} fewer.` : '.'}
        </Text>
        <HelperText>
          Total still to move around: {formatMoney(totalOwed, currency)}
          {biggest > 0 ? ` · largest single payment ${formatMoney(biggest, currency)}` : ''}
        </HelperText>
      </Card>

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

      <Pressable
        style={({ pressed }) => [styles.recordButton, pressed && styles.pressed]}
        onPress={() => onSettle()}
        accessibilityRole="button"
      >
        <Plus size={16} color={BrandColors.primary} />
        <Text style={styles.recordText}>Record a payment</Text>
      </Pressable>

      {settlements.length === 0 ? (
        <HelperText>
          No payments recorded yet. Tap a debt above once someone hands over cash.
        </HelperText>
      ) : (
        <PaymentsList
          settlements={settlements.slice(0, RECENT_PAYMENT_LIMIT)}
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
    </View>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: BrandColors.base400,
    borderColor: BrandColors.base400,
  },
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: BrandColors.background,
    borderWidth: 1,
    borderColor: BrandColors.base200,
    borderRadius: 15,
    padding: Spacing.three,
  },
  pressed: {
    opacity: 0.75,
  },
  edgeMiddle: {
    flex: 1,
    gap: 2,
  },
  edgeText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    color: BrandColors.primary,
  },
  remindBtn: {
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 12,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  remindText: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 11, color: BrandColors.primary },
  edgeHint: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 10,
    color: BrandColors.secondary,
  },
  edgeRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  edgeAmount: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 14,
    color: BrandColors.primary,
  },
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
});
