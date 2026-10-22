import BalanceCard from '@/components/dashboard/balance-card';
import QuickActions from '@/components/dashboard/quick-actions';
import RecentSection from '@/components/dashboard/recent-section';
import NavBar from '@/components/Navbar/Nav';
import { ActiveTripCard } from '@/components/dashboard/active-trip-card';
import ReceiptSourceSheet from '@/components/dashboard/receipt-source-sheet';
import AllTripsSummary from '@/components/dashboard/all-trips-summary';
import DebtsList from '@/components/dashboard/debts-list';
import GettingStarted from '@/components/dashboard/getting-started';
import PendingPayments from '@/components/dashboard/pending-payments';
import QuickLinks from '@/components/dashboard/quick-links';
import RecentActivity from '@/components/dashboard/recent-activity';
import DashboardSkeleton from '@/components/dashboard/skeleton';
import SpendingGlance from '@/components/dashboard/spending-glance';
import SyncChip from '@/components/dashboard/sync-chip';
import TripChips from '@/components/dashboard/trip-chips';
import { fetchTripBudget, respondToSettlement } from '@/services/Firebase/settlementService';
import ExpenseDetailSheet from '@/components/trip/expense-detail-sheet';
import SettleSheet from '@/components/trip/settle-sheet';
import ExpenseForm from '@/components/trip/expense-form';
import TripShareSheet from '@/components/trip/trip-share-sheet';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import { BrandColors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useActiveTrip } from '@/hooks/use-active-trip';
import { useTripDetails } from '@/hooks/use-trip-details';
import { useAuth } from '@/services/Firebase/useAuth';
import { pickImage, takePhoto } from '@/utils/imagePicker';
import { Expense } from '@/types/expenses';
import { computeTripTotals, simplifyDebts } from '@/utils/balance';
import { dateToday, timeOfTheDay } from '@/utils/dates';
import { useRouter } from 'expo-router';
import { Bell, Settings } from 'lucide-react-native';
import { useUnreadCount } from '@/services/notifications/useUnreadCount';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

/** What the receipt button is asking, when it is asking anything. */
type ReceiptStep = 'source' | null;

export default function HomeScreen() {
  const { currentUser } = useAuth();
  const router = useRouter();
  const unread = useUnreadCount();

  const userId = currentUser?.uid ?? '';
  const {
    trips,
    activeTrip,
    activeTripIsOver,
    loading: tripsLoading,
    error: tripsError,
    selectTrip,
    reload: reloadTrips,
  } = useActiveTrip(userId);

  const {
    trip,
    expenses,
    settlements,
    loading: tripLoading,
    setExpenses,
    setSettlements,
    reload: reloadTrip,
  } = useTripDetails(activeTrip?.id ?? '');

  const [expenseFormOpen, setExpenseFormOpen] = useState(false);
  const [pendingReceipt, setPendingReceipt] = useState<string | null>(null);
  const [receiptStep, setReceiptStep] = useState<ReceiptStep>(null);
  const [settleOpen, setSettleOpen] = useState(false);
  const [preselect, setPreselect] = useState<{ from?: string; to?: string; amount?: number }>();
  const [budget, setBudget] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [noTripNotice, setNoTripNotice] = useState('');
  /** The expense whose detail sheet is open, by id. */
  const [detailExpenseId, setDetailExpenseId] = useState<string | null>(null);
  /** The expense the form is changing, when it is changing one. */
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const userName = currentUser?.displayName || 'User';

  const members = useMemo(() => {
    const list = Object.values(trip?.members ?? {});
    return [...list].sort((a, b) => {
      if (a.role === b.role) return (a.fullname || '').localeCompare(b.fullname || '');
      return a.role === 'owner' ? -1 : 1;
    });
  }, [trip]);

  const currency = trip?.currency || activeTrip?.currency || 'PHP';

  const totals = useMemo(() => {
    const ids = members.map((member) => member.id);
    return computeTripTotals(ids, expenses, settlements);
  }, [members, expenses, settlements]);

  const edges = useMemo(() => simplifyDebts(totals.balances), [totals.balances]);

  const myBalance = totals.balances.find((balance) => balance.memberId === userId);
  const myNet = myBalance?.net ?? 0;

  const loading = tripsLoading || tripLoading;

  const pendingForMe = settlements.filter(
    (item) => item.status === 'pending' && item.to === userId,
  );

  useEffect(() => {
    if (!activeTrip?.id) {
      setBudget(null);
      return;
    }
    fetchTripBudget(activeTrip.id)
      .then((result) => setBudget(result?.amount ?? null))
      .catch(() => setBudget(null));
  }, [activeTrip?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([reloadTrips(), reloadTrip()]);
    } finally {
      setRefreshing(false);
    }
  };

  const respond = async (payment: (typeof settlements)[number], accept: boolean) => {
    if (!activeTrip) return;
    try {
      const result = await respondToSettlement(activeTrip.id, payment.id, userId, accept);
      setSettlements((previous) =>
        previous.map((item) => (item.id === payment.id ? { ...item, ...result } : item)),
      );
    } catch (err) {
      console.error('Failed to answer the payment:', err);
      setNoTripNotice('Could not update that payment. Please try again.');
    }
  };

  /** Every button needs a trip to act on, so this is the shared guard. */
  const requireTrip = useCallback(
    (what: string): boolean => {
      if (trip) return true;
      setNoTripNotice(`Make or join a trip first, then you can ${what}.`);
      return false;
    },
    [trip],
  );

  const handleAddExpense = () => {
    if (!requireTrip('add an expense')) return;
    setPendingReceipt(null);
    setEditingExpense(null);
    setExpenseFormOpen(true);
  };

  const handleSettleUp = () => {
    if (!requireTrip('settle up')) return;
    setPreselect(undefined);
    if (edges.length === 0 && myNet === 0) {
      setNoTripNotice('Everyone is settled up on this trip, so there is nothing to pay right now.');
      return;
    }
    setSettleOpen(true);
  };

  const handleReceipt = () => {
    if (!requireTrip('save a receipt')) return;
    setReceiptStep('source');
  };

  /** Takes the photo, then hands it to the expense form so it can be saved. */
  const handleReceiptPicked = async (source: 'camera' | 'library') => {
    try {
      const result =
        source === 'camera'
          ? await takePhoto({ quality: 0.7 })
          : await pickImage({ includeBase64: false, quality: 0.7 });

      if (result.denied) {
        setReceiptStep(null);
        setNoTripNotice(
          source === 'camera'
            ? 'Camera access is off. Turn it on in your phone settings to photograph a receipt.'
            : 'Photo access is off. Turn it on in your phone settings to pick a receipt.',
        );
        return;
      }

      if (result.asset?.uri) {
        setReceiptStep(null);
        setPendingReceipt(result.asset.uri);
        setExpenseFormOpen(true);
      }
    } catch (err) {
      console.error('Failed to get a receipt photo:', err);
      setReceiptStep(null);
      setNoTripNotice('Could not open your camera or photos.');
    }
  };

  const handleInvite = () => {
    if (!requireTrip('invite someone')) return;
    setShareOpen(true);
  };

  const openTrip = () => {
    if (!activeTrip) {
      router.push('/groups' as any);
      return;
    }
    router.push(`/trips/${activeTrip.id}` as any);
  };

  /** Opens the page holding every expense of the active trip. */
  const openAllExpenses = () => {
    if (!activeTrip) {
      router.push('/groups' as any);
      return;
    }
    router.push(`/trips/${activeTrip.id}/expenses` as any);
  };

  const actionHandlers: Record<string, () => void> = {
    'add-expense': handleAddExpense,
    'settle-up': handleSettleUp,
    receipt: handleReceipt,
    invite: handleInvite,
  };

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.container}>
          <View style={styles.settingsContainer}>
            <TouchableOpacity
              onPress={() => router.push('/notifications' as any)}
              accessibilityRole="button"
              accessibilityLabel={unread ? 'Notifications, ' + unread + ' unread' : 'Notifications'}
            >
              <Bell color={BrandColors.primary} size={24} />
              {unread > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/settings' as any)}
              accessibilityRole="button"
              accessibilityLabel="Settings"
            >
              <Settings color={BrandColors.primary} size={24} />
            </TouchableOpacity>
          </View>

          <View style={styles.header}>
            <Text style={styles.dateText}>{dateToday()}</Text>
            <Text style={styles.title}>
              {timeOfTheDay()}, <Text style={styles.titleBold}>{userName}</Text>!
            </Text>
          </View>

          {loading ? (
            <DashboardSkeleton />
          ) : (
            <>
              <SyncChip />

              {trips.length > 1 && (
                <TripChips
                  trips={trips}
                  activeId={activeTrip?.id}
                  onSelect={selectTrip}
                  onNew={() => router.push('/trips/create' as any)}
                />
              )}

              <ActiveTripCard
                activeTrip={activeTrip}
                isOver={activeTripIsOver}
                onOpen={openTrip}
                onManageTrips={() => router.push('/groups' as any)}
                onShowQr={handleInvite}
              />

              {!!tripsError && <Text style={styles.errorText}>{tripsError}</Text>}

              <PendingPayments
                payments={pendingForMe}
                members={members}
                currency={currency}
                onRespond={respond}
                onViewAll={() => router.push('/payments' as any)}
              />

              {activeTrip && (
                <View style={styles.moneyCard}>
                  <BalanceCard
                    embedded
                    aside={
                      trips.length > 1 ? (
                        <AllTripsSummary
                          inline
                          userId={userId}
                          refreshKey={`${trips.length}-${expenses.length}-${settlements.length}`}
                        />
                      ) : undefined
                    }
                    net={myNet}
                    currency={currency}
                    spent={totals.spent}
                    onPress={openTrip}
                  />
                  <DebtsList
                    embedded
                    edges={edges}
                    members={members}
                    userId={userId}
                    currency={currency}
                    tripId={activeTrip.id}
                    tripName={activeTrip.name}
                    onPay={(edge) => {
                      setPreselect({ from: edge.from, to: edge.to, amount: edge.amount });
                      setSettleOpen(true);
                    }}
                  />
                </View>
              )}

              <QuickActions handlers={actionHandlers} />

              <GettingStarted
                steps={[
                  {
                    label: 'Create a trip',
                    done: trips.length > 0,
                    onPress: () => router.push('/trips/create' as any),
                  },
                  { label: 'Invite a friend', done: members.length > 1, onPress: handleInvite },
                  {
                    label: 'Add your first expense',
                    done: expenses.length > 0,
                    onPress: handleAddExpense,
                  },
                ]}
              />

              {!!activeTrip && (
                <SpendingGlance
                  expenses={expenses}
                  userId={userId}
                  currency={currency}
                  budget={budget}
                  tripSpent={totals.spent}
                />
              )}

              <RecentSection
                tripName={activeTrip?.name}
                hasTrip={!!activeTrip}
                expenses={expenses}
                members={members}
                currency={currency}
                onOpenExpense={(expense) => setDetailExpenseId(expense.id)}
                onViewAll={openAllExpenses}
                onAddExpense={handleAddExpense}
                onGoToTrips={() => router.push('/groups' as any)}
              />
              {trips.length > 1 && (
                <RecentActivity
                  userId={userId}
                  refreshKey={`${trips.length}-${expenses.length}-${settlements.length}`}
                />
              )}

              <QuickLinks />
            </>
          )}
        </View>
      </ScrollView>

      <NavBar />

      {!!trip && (
        <>
          <ExpenseForm
            visible={expenseFormOpen}
            onClose={() => {
              setExpenseFormOpen(false);
              setPendingReceipt(null);
              setEditingExpense(null);
            }}
            expense={editingExpense}
            tripId={trip.id}
            currency={currency}
            members={members}
            currentUserId={userId}
            initialReceiptUri={pendingReceipt}
            onSaved={(saved) => {
              setExpenses((previous) =>
                editingExpense
                  ? previous.map((entry) => (entry.id === saved.id ? saved : entry))
                  : [saved, ...previous],
              );
              setExpenseFormOpen(false);
              setPendingReceipt(null);
              setEditingExpense(null);
            }}
          />

          <SettleSheet
            visible={settleOpen}
            onClose={() => setSettleOpen(false)}
            tripId={trip.id}
            currency={currency}
            members={members}
            edges={edges}
            currentUserId={userId}
            preselect={preselect}
            onSaved={(saved) => {
              // Settlements change the balances, so they are kept in step here.
              setSettlements((previous) => [saved, ...previous]);
            }}
          />

          <TripShareSheet
            visible={shareOpen}
            onClose={() => setShareOpen(false)}
            tripName={trip.name}
            inviteCode={trip.inviteCode || ''}
            onInviteFriends={() => router.push(`/trips/${trip.id}/invite` as any)}
          />

          <ReceiptSourceSheet
            visible={receiptStep === 'source'}
            onClose={() => setReceiptStep(null)}
            tripName={trip.name}
            onPick={handleReceiptPicked}
          />

          <ExpenseDetailSheet
            expense={expenses.find((entry) => entry.id === detailExpenseId) ?? null}
            onClose={() => setDetailExpenseId(null)}
            members={members}
            currency={currency}
            currentUserId={userId}
            onEdit={(expense) => {
              setDetailExpenseId(null);
              setEditingExpense(expense);
              setExpenseFormOpen(true);
            }}
          />
        </>
      )}

      <ConfirmDialog
        visible={!!noTripNotice}
        title="Hold on"
        message={noTripNotice}
        confirmLabel="Got it"
        cancelLabel="Close"
        onConfirm={() => setNoTripNotice('')}
        onCancel={() => setNoTripNotice('')}
      />
    </>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    backgroundColor: BrandColors.background,
    paddingBottom: 120,
  },
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    backgroundColor: BrandColors.background,
    paddingTop: 40,
    paddingHorizontal: 25,
    gap: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  moneyCard: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.one,
  },
  settingsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: Spacing.three,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: BrandColors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 10,
    color: '#fff',
  },
  header: {
    alignItems: 'flex-start',
    gap: Spacing.half,
  },
  dateText: {
    fontFamily: 'PlusJakartaSans-Light',
    fontSize: 14,
    color: BrandColors.secondary,
    letterSpacing: Spacing.half,
  },
  title: {
    fontFamily: 'PlusJakartaSans-Medium',
    color: BrandColors.primary,
    fontSize: 20,
  },
  titleBold: {
    fontFamily: 'PlusJakartaSans-Bold',
  },
  errorText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13,
    color: BrandColors.error,
  },
});
