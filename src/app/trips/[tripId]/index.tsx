import TripHeaderActions from '@/components/trip/trip-header-actions';
import TripHero from '@/components/trip/trip-hero';
import TripOverview from '@/components/trip/trip-overview';
import ErrorState from '@/components/ui/error-state';
import ListSkeleton from '@/components/ui/list-skeleton';
import NavBar from '@/components/Navbar/Nav';
import ConfirmSheet from '@/components/ui/confirm-sheet';
import TabSlider from '@/components/ui/tab-slider';
import TripScreenHeader from '@/components/ui/trip-screen-header';
import { TripIconBadge } from '@/components/ui/trip-icon';
import BudgetSheet from '@/components/trip/budget-sheet';
import BalancesTab from '@/components/trip/balances-tab';
import ExpenseForm from '@/components/trip/expense-form';
import ExpensesTab from '@/components/trip/expenses-tab';
import ItineraryForm from '@/components/trip/itinerary-form';
import ItineraryTab from '@/components/trip/itinerary-tab';
import ReportsTab from '@/components/trip/reports-tab';
import ExpenseDetailSheet from '@/components/trip/expense-detail-sheet';
import SettleSheet from '@/components/trip/settle-sheet';
import TripMembersSheet from '@/components/trip/trip-members-sheet';
import TripSettingsSheet from '@/components/trip/trip-settings-sheet';
import TripShareSheet from '@/components/trip/trip-share-sheet';
import { BrandColors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useActiveTrip } from '@/hooks/use-active-trip';
import { deleteExpense, fetchExpenses } from '@/services/Firebase/expenseService';
import { runDueRecurring } from '@/services/Firebase/recurringService';
import RecurringList from '@/components/trip/recurring-list';
import { deleteItineraryItem, fetchItinerary } from '@/services/Firebase/itineraryService';
import {
  fetchSettlements,
  fetchTripBudget,
  respondToSettlement,
} from '@/services/Firebase/settlementService';
import { fetchTrip, leaveTrip, removeMemberFromTrip } from '@/services/Firebase/tripService';
import { fetchDelivery, setTripMuted } from '@/services/notifications/inbox';
import { useAuth } from '@/services/Firebase/useAuth';
import { Expense, ItineraryItem } from '@/types/expenses';
import { Trip, TripMember } from '@/types/trips';
import { TabKey, TRIP_TABS } from '@/types/trip-view';
import { computeTripTotals, simplifyDebts } from '@/utils/balance';
import { parseAmount, todayKey } from '@/utils/money';
import { tripIsOver } from '@/utils/tripList';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  LogOut,
  Plus,
  Scale,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type LocalTabKey = TabKey;

/** What the "are you sure?" dialog is currently asking about. */
type PendingConfirm =
  { kind: 'expense'; id: string; title: string } | { kind: 'plan'; id: string; title: string };

export default function TripDetailScreen() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { currentUser } = useAuth();

  // Which trip the dashboard shows. Reported to this screen so the star in the
  // header only appears when it would actually do something.
  const { activeTrip, selectTrip, loading: tripsLoading } = useActiveTrip(currentUser?.uid);
  const isActiveTrip = !!tripId && activeTrip?.id === tripId;

  /**
   * Makes the dashboard work on this trip.
   *
   * There is only ever one dashboard trip, so there is nothing to switch off -
   * picking another trip replaces this one. That is why the star only shows on
   * trips that are not already the dashboard's.
   */
  const handleMarkActive = () => {
    if (!tripId || isActiveTrip) return;
    selectTrip(tripId);
  };

  const [trip, setTrip] = useState<Trip | null>(null);
  const [expenses, setExpenses] = useState<Awaited<ReturnType<typeof fetchExpenses>>>([]);
  const [settlements, setSettlements] = useState<Awaited<ReturnType<typeof fetchSettlements>>>([]);
  const [itinerary, setItinerary] = useState<ItineraryItem[]>([]);
  const [budget, setBudget] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<LocalTabKey>('expenses');

  // See useActiveTrip: the spinner belongs to the first load only.
  const loadedOnce = useRef(false);

  // The trip last seen on this screen. Kept so a reload that comes back empty
  // (no connection and nothing saved) does not throw away a trip on screen.
  const tripRef = useRef<Trip | null>(null);
  tripRef.current = trip;

  const [expenseFormOpen, setExpenseFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [itineraryFormOpen, setItineraryFormOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<ItineraryItem | null>(null);
  const [itineraryDay, setItineraryDay] = useState<string | undefined>(undefined);
  const [settleOpen, setSettleOpen] = useState(false);
  const [editingSettlement, setEditingSettlement] = useState<
    Awaited<ReturnType<typeof fetchSettlements>>[number] | null
  >(null);
  const [settlePreset, setSettlePreset] = useState<{
    from?: string;
    to?: string;
    amount?: number;
  }>();
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState('');
  /** The expense whose detail sheet is open, by id. */
  const [detailExpenseId, setDetailExpenseId] = useState<string | null>(null);
  /** The member the owner just tapped to remove, once they confirm. */
  const [pendingRemove, setPendingRemove] = useState<TripMember | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState('');
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const loadTrip = useCallback(async () => {
    if (!tripId) {
      setError('This trip could not be found.');
      setLoading(false);
      loadedOnce.current = true;
      return;
    }

    try {
      setError('');
      // A trip already saved on the phone is shown at once; readPath asks the
      // server in the background and re-paints if anything really changed.
      const tripData = await fetchTrip(tripId);

      // Repeating expenses that came due while nobody had the trip open.
      if (tripData && currentUser?.uid) {
        await runDueRecurring(tripId, currentUser.uid).catch((err) =>
          console.warn('Could not add repeating expenses:', err),
        );
      }

      const [expenseData, settlementData, itineraryData, budgetData] = await Promise.all([
        fetchExpenses(tripId),
        fetchSettlements(tripId),
        fetchItinerary(tripId),
        fetchTripBudget(tripId),
      ]);

      if (!tripData && !tripRef.current) {
        setError('This trip could not be found.');
        setTrip(null);
        return;
      }

      if (tripData) setTrip(tripData);
      setExpenses(expenseData);
      setSettlements(settlementData);
      setItinerary(itineraryData);
      setBudget(parseAmount(budgetData?.amount) / 100);
    } catch (err) {
      console.error('Failed to load trip:', err);
      setError('Could not load this trip.');
    } finally {
      loadedOnce.current = true;
      setLoading(false);
    }
  }, [tripId, currentUser?.uid]);

  useFocusEffect(
    useCallback(() => {
      // The spinner is for the first load only; the saved copy answers at once
      // afterwards, so blanking the screen again would just be a flicker.
      if (!loadedOnce.current) setLoading(true);
      loadTrip();
    }, [loadTrip]),
  );

  const members: TripMember[] = useMemo(() => {
    const list = Object.values(trip?.members ?? {});
    return [...list].sort((a, b) => {
      if (a.role === b.role) return (a.fullname || '').localeCompare(b.fullname || '');
      return a.role === 'owner' ? -1 : 1;
    });
  }, [trip]);

  const memberIds = useMemo(() => members.map((member) => member.id), [members]);

  const totals = useMemo(
    () => computeTripTotals(memberIds, expenses, settlements),
    [memberIds, expenses, settlements],
  );

  /**
   * Balances for the people still in the trip.
   *
   * `computeBalances` also returns anyone else whose id appears on an expense,
   * which is how a removed member would come back as a row with no name. Since
   * removal is refused while their money is unsettled, dropping them here loses
   * nothing: a filtered-out member with a leftover paid/owed pair has a net of
   * zero (otherwise the removal would have been blocked), so every figure below
   * stays correct.
   */
  const visibleBalances = useMemo(() => {
    const ids = new Set(memberIds);
    return totals.balances.filter((balance) => ids.has(balance.memberId));
  }, [totals.balances, memberIds]);

  /** Net per member keyed by id, which is what the members sheet shows. */
  const netByMember = useMemo(() => {
    const map: Record<string, number> = {};
    visibleBalances.forEach((balance) => {
      map[balance.memberId] = balance.net;
    });
    return map;
  }, [visibleBalances]);

  const edges = useMemo(() => simplifyDebts(visibleBalances), [visibleBalances]);

  const currentUserId = currentUser?.uid ?? '';
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    if (!currentUserId || !tripId) return;
    fetchDelivery(currentUserId)
      .then((d) => setMuted(!!d.mutedTrips[tripId]))
      .catch(() => {});
  }, [currentUserId, tripId]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setTripMuted(currentUserId, tripId, next).catch((err) => {
      console.warn('Could not change the mute setting:', err);
      setMuted(!next);
    });
  };
  const isOwner = !!trip && trip.createdBy === currentUserId;
  const currency = trip?.currency || 'PHP';

  /**
   * Inviting is only useful while this trip is just you. Once a second person
   * is in, the invite prompt has done its job and only takes up the top of the
   * page, so both the row and the header icon hide from then on.
   */
  const showInvite = members.length <= 1;

  /**
   * A trip whose last date has passed is finished, so the page says so instead
   * of pretending it is still running. Nothing is locked: people still settle
   * up and fix old expenses after they get home.
   */
  const isOver = !!trip && tripIsOver(trip, todayKey());

  const handleDeleteItinerary = (item: ItineraryItem) => {
    setPendingConfirm({ kind: 'plan', id: item.id, title: item.title });
  };

  const handleDeleteExpense = (expenseId: string, title: string) => {
    setPendingConfirm({ kind: 'expense', id: expenseId, title });
  };

  /** Runs the delete the user just said yes to. */
  const runPendingConfirm = async () => {
    const request = pendingConfirm;
    if (!request || confirmBusy) return;

    setConfirmBusy(true);

    try {
      if (request.kind === 'expense') {
        await deleteExpense(tripId as string, request.id);
        setExpenses((previous) => previous.filter((entry) => entry.id !== request.id));
      } else {
        await deleteItineraryItem(tripId as string, request.id);
        setItinerary((previous) => previous.filter((entry) => entry.id !== request.id));
      }
      setPendingConfirm(null);
    } catch (err) {
      console.error('Failed to delete:', err);
    } finally {
      setConfirmBusy(false);
    }
  };

  /** Takes the signed-in user out of the trip. */
  const handleLeave = async () => {
    if (!tripId || !currentUserId || leaving) return;

    setLeaving(true);
    setLeaveError('');

    try {
      const result = await leaveTrip(tripId, currentUserId);
      setLeaveOpen(false);

      // A trip with nobody left is gone, so there is nothing to go back to.
      router.replace('/groups' as any);

      if (!result.tripDeleted && result.newOwner) {
        console.log(`${result.newOwner.fullname} is the new trip owner.`);
      }
    } catch (err: any) {
      console.error('Failed to leave trip:', err);
      setLeaveError(err?.message || 'Could not leave this trip. Please try again.');
    } finally {
      setLeaving(false);
    }
  };

  /** Removes the member the owner just confirmed. */
  const handleRemoveMember = async () => {
    const member = pendingRemove;
    if (!member || !tripId || !currentUserId || removing) return;

    setRemoving(true);
    setRemoveError('');

    try {
      await removeMemberFromTrip(tripId, member.id, currentUserId);

      // Drop them from the screen at once, so the list matches the removal
      // without waiting for the next trip reload.
      setTrip((previous) => {
        if (!previous) return previous;
        const nextMembers = { ...previous.members };
        delete nextMembers[member.id];
        return { ...previous, members: nextMembers };
      });

      setPendingRemove(null);
    } catch (err: any) {
      console.error('Failed to remove member:', err);
      setRemoveError(err?.message || 'Could not remove that member. Please try again.');
    } finally {
      setRemoving(false);
    }
  };

  return (
    <>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <TripScreenHeader
            title={trip?.name || 'Trip'}
            onBack={() => router.replace('/groups' as any)}
            leading={<TripIconBadge name={trip?.icon} colorKey={trip?.iconColor} size={28} />}
            right={
              <TripHeaderActions
                showStar={tab === 'expenses' && !tripsLoading && !isOver}
                isActiveTrip={isActiveTrip}
                onMarkActive={handleMarkActive}
                isOwner={isOwner}
                onSettings={() => setSettingsOpen(true)}
                showInvite={tab === 'expenses' && showInvite}
                onInvite={() => router.push(`/trips/${tripId}/invite` as any)}
                muted={muted}
                onToggleMute={toggleMute}
              />
            }
          />

          {loading ? (
            <ListSkeleton rows={4} rowHeight={80} />
          ) : error || !trip ? (
            <ErrorState message={error || 'This trip could not be found.'} onRetry={loadTrip} />
          ) : (
            <>
              <TripHero
                trip={trip}
                currency={currency}
                totalSpent={totals.spent}
                yourShare={
                  visibleBalances.find((balance) => balance.memberId === currentUserId)?.owed ?? 0
                }
                budget={budget}
                onOpenQr={() => setShareOpen(true)}
              />

              {isOver && (
                <Pressable
                  style={styles.overNotice}
                  onPress={() => router.push(`/trips/${tripId}/payments` as any)}
                  accessibilityRole="button"
                  accessibilityLabel="See the payments of this finished trip"
                >
                  <CheckCircle2 size={16} color={BrandColors.success} />
                  <Text style={styles.overText}>
                    This trip has ended. You can still settle up and fix anything recorded wrong.
                  </Text>
                  <ChevronRight size={15} color={BrandColors.secondary} />
                </Pressable>
              )}

              <TabSlider items={TRIP_TABS} value={tab} onChange={setTab} />

              {/* Who is on the trip, at the top where it belongs, then what
                  everyone added. Tapping the faces opens the full list, where
                  the owner can also remove someone whose money is settled. */}
              {tab === 'expenses' && (
                <>
                  <TripOverview
                    members={members}
                    isOwner={isOwner}
                    showInvite={showInvite}
                    netByMember={netByMember}
                    currency={currency}
                    onOpenMembers={() => {
                      setRemoveError('');
                      setMembersOpen(true);
                    }}
                    onOpenInvite={() => setShareOpen(true)}
                  />
                </>
              )}

              {tab === 'expenses' && (
                <ExpensesTab
                  expenses={expenses}
                  members={members}
                  currency={currency}
                  currentUserId={currentUserId}
                  onAdd={() => setExpenseFormOpen(true)}
                  onViewAll={() => router.push(`/trips/${tripId}/expenses` as any)}
                  onOpenExpense={(expense) => setDetailExpenseId(expense.id)}
                  onDelete={handleDeleteExpense}
                  onEdit={(expense) => {
                    setEditingExpense(expense);
                    setExpenseFormOpen(true);
                  }}
                />
              )}

              {tab === 'expenses' && (
                <RecurringList
                  tripId={tripId}
                  currency={currency}
                  currentUserId={currentUserId}
                  isOwner={isOwner}
                  reloadKey={expenses.length}
                />
              )}

              {tab === 'balances' && (
                <BalancesTab
                  members={members}
                  expenses={expenses}
                  settlements={settlements}
                  balances={visibleBalances}
                  edges={edges}
                  currency={currency}
                  currentUserId={currentUserId}
                  tripId={tripId as string}
                  tripName={trip?.name}
                  onRespond={async (payment, accept) => {
                    try {
                      const result = await respondToSettlement(
                        tripId as string,
                        payment.id,
                        currentUserId,
                        accept,
                      );
                      setSettlements((previous) =>
                        previous.map((item) =>
                          item.id === payment.id ? { ...item, ...result } : item,
                        ),
                      );
                    } catch (err) {
                      console.error('Could not answer the payment:', err);
                    }
                  }}
                  onViewAll={() => router.push(`/trips/${tripId}/payments` as any)}
                  onEditSettlement={(payment) => {
                    setEditingSettlement(payment);
                    setSettleOpen(true);
                  }}
                  onSettle={(preset) => {
                    setEditingSettlement(null);
                    setSettlePreset(preset);
                    setSettleOpen(true);
                  }}
                />
              )}

              {tab === 'itinerary' && (
                <ItineraryTab
                  items={itinerary}
                  currentUserId={currentUserId}
                  onDelete={handleDeleteItinerary}
                  isOwner={isOwner}
                  onEdit={(plan) => {
                    setEditingPlan(plan);
                    setItineraryFormOpen(true);
                  }}
                />
              )}

              {tab === 'reports' && (
                <ReportsTab
                  expenses={expenses}
                  members={members}
                  currency={currency}
                  totalSpent={totals.spent}
                  settledTotal={totals.settled}
                  tripName={trip?.name ?? ''}
                  settlements={settlements}
                />
              )}

              <Pressable
                style={styles.leaveButton}
                onPress={() => {
                  setLeaveError('');
                  setLeaveOpen(true);
                }}
                accessibilityRole="button"
              >
                <LogOut size={15} color={BrandColors.error} />
                <Text style={styles.leaveText}>Leave this trip</Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>

      {/* Floating action button: the main thing people do on a trip. */}
      {!loading && !error && trip && tab !== 'reports' && (
        <Pressable
          style={styles.fab}
          onPress={() => {
            if (tab === 'itinerary') {
              setItineraryDay(undefined);
              setItineraryFormOpen(true);
            } else if (tab === 'balances') {
              setSettlePreset(undefined);
              setEditingSettlement(null);
              setSettleOpen(true);
            } else {
              setExpenseFormOpen(true);
            }
          }}
        >
          {tab === 'itinerary' ? (
            <CalendarRange size={22} color={BrandColors.primary} />
          ) : tab === 'balances' ? (
            <Scale size={22} color={BrandColors.primary} />
          ) : (
            <Plus size={24} color={BrandColors.primary} />
          )}
        </Pressable>
      )}

      {!!trip && (
        <>
          <ExpenseForm
            visible={expenseFormOpen}
            onClose={() => {
              setExpenseFormOpen(false);
              setEditingExpense(null);
            }}
            expense={editingExpense}
            tripId={tripId as string}
            currency={currency}
            members={members}
            currentUserId={currentUserId}
            onSaved={(saved) => {
              setExpenses((previous) =>
                editingExpense
                  ? previous.map((entry) => (entry.id === saved.id ? saved : entry))
                  : [saved, ...previous],
              );
              setEditingExpense(null);
              setExpenseFormOpen(false);
            }}
          />

          <ItineraryForm
            visible={itineraryFormOpen}
            onClose={() => {
              setItineraryFormOpen(false);
              setEditingPlan(null);
            }}
            tripId={tripId as string}
            currentUserId={currentUserId}
            memberNames={Object.fromEntries(members.map((member) => [member.id, member.fullname]))}
            defaultDay={itineraryDay}
            item={editingPlan}
            onSaved={(saved) => {
              setItinerary((previous) =>
                [...previous.filter((entry) => entry.id !== saved.id), saved].sort((a, b) => {
                  if (a.day !== b.day) return a.day < b.day ? -1 : 1;
                  return (a.time || '99:99') < (b.time || '99:99') ? -1 : 1;
                }),
              );
              setItineraryFormOpen(false);
              setEditingPlan(null);
            }}
          />

          <SettleSheet
            visible={settleOpen}
            onClose={() => setSettleOpen(false)}
            tripId={tripId as string}
            currency={currency}
            members={members}
            edges={edges}
            currentUserId={currentUserId}
            preselect={settlePreset}
            settlement={editingSettlement}
            onSaved={(saved) => {
              setSettlements((previous) =>
                previous.some((item) => item.id === saved.id)
                  ? previous.map((item) => (item.id === saved.id ? saved : item))
                  : [saved, ...previous],
              );
            }}
          />

          <BudgetSheet
            visible={budgetOpen}
            onClose={() => setBudgetOpen(false)}
            tripId={tripId as string}
            currentUserId={currentUserId}
            currency={currency}
            currentBudget={budget}
            onSaved={(amount) => setBudget(amount)}
          />

          <TripShareSheet
            visible={shareOpen}
            onClose={() => setShareOpen(false)}
            tripName={trip.name}
            inviteCode={trip.inviteCode || ''}
            onInviteFriends={() => router.push(`/trips/${tripId}/invite` as any)}
          />

          <ExpenseDetailSheet
            expense={expenses.find((entry) => entry.id === detailExpenseId) ?? null}
            onClose={() => setDetailExpenseId(null)}
            members={members}
            currency={currency}
            currentUserId={currentUserId}
            onEdit={(expense) => {
              setEditingExpense(expense);
              setExpenseFormOpen(true);
            }}
          />

          <TripMembersSheet
            visible={membersOpen}
            onClose={() => setMembersOpen(false)}
            members={members}
            currentUserId={currentUserId}
            balances={netByMember}
            currency={currency}
            isOwner={isOwner}
            onRemove={(member) => {
              setRemoveError('');
              // Close the members list first: two sheets open at once stack
              // badly on iOS, where the second one can appear behind the first.
              setMembersOpen(false);
              setPendingRemove(member);
            }}
            onInvite={() => router.push(`/trips/${tripId}/invite` as any)}
          />

          {isOwner && (
            <TripSettingsSheet
              visible={settingsOpen}
              onClose={() => setSettingsOpen(false)}
              tripId={tripId as string}
              editorId={currentUserId}
              currentName={trip.name}
              currentCurrency={currency}
              currentIcon={trip.icon}
              currentIconColor={trip.iconColor}
              currentStartDate={trip.startDate}
              currentEndDate={trip.endDate}
              currentBudget={budget}
              onEditBudget={() => {
                setSettingsOpen(false);
                setBudgetOpen(true);
              }}
              onSaved={(settings) => {
                // Keep the screen in step with the save, so the header title, the
                // header icon and the money on every tab use the new settings at
                // once.
                setTrip((previous) =>
                  previous
                    ? {
                        ...previous,
                        name: settings.name,
                        currency: settings.currency,
                        icon: settings.icon,
                        iconColor: settings.iconColor,
                        startDate: settings.startDate || undefined,
                        endDate: settings.endDate || undefined,
                      }
                    : previous,
                );
              }}
            />
          )}
        </>
      )}

      {/* Leaving and removing cover everything, so their questions are asked
          outside the trip block. Both slide up from the bottom, next to the
          thumb, instead of covering the middle of the trip you were reading. */}
      <ConfirmSheet
        visible={!!pendingRemove}
        icon="remove"
        title={
          pendingRemove
            ? `Remove ${pendingRemove.fullname?.split(' ')[0] || 'this member'}?`
            : 'Remove?'
        }
        message={
          pendingRemove
            ? `${pendingRemove.fullname || 'This member'} loses access to this trip and its expenses. Their share of the spending stays as it is, so the trip only stays settled if they owe nothing and are owed nothing.`
            : ''
        }
        confirmLabel="Remove"
        cancelLabel="Keep them"
        busy={removing}
        onConfirm={handleRemoveMember}
        onCancel={() => {
          if (!removing) setPendingRemove(null);
        }}
      >
        {!!removeError && <Text style={styles.leaveError}>{removeError}</Text>}
      </ConfirmSheet>

      <ConfirmSheet
        visible={leaveOpen}
        icon="leave"
        title="Leave this trip?"
        message={
          isOwner && members.length > 1
            ? 'You own this trip, so the person who joined first will become the new owner. You will no longer see its expenses.\n\nAny money you still owe, or are owed, must be settled first.'
            : 'You will be removed from this trip and will no longer see its expenses.\n\nAny money you still owe, or are owed, must be settled first.'
        }
        confirmLabel="Leave trip"
        cancelLabel="Stay"
        busy={leaving}
        onConfirm={handleLeave}
        onCancel={() => {
          if (!leaving) setLeaveOpen(false);
        }}
      >
        {!!leaveError && <Text style={styles.leaveError}>{leaveError}</Text>}
      </ConfirmSheet>

      <ConfirmSheet
        visible={!!pendingConfirm}
        icon="delete"
        title={pendingConfirm ? `Delete "${pendingConfirm.title}"?` : 'Delete?'}
        message={
          pendingConfirm?.kind === 'plan'
            ? 'This plan will be removed for everyone in the trip.'
            : 'This expense will be removed for everyone in the trip.'
        }
        confirmLabel="Delete"
        cancelLabel="Keep it"
        busy={confirmBusy}
        onConfirm={runPendingConfirm}
        onCancel={() => {
          if (!confirmBusy) setPendingConfirm(null);
        }}
      />

      <NavBar />
    </>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    // Fills the screen when a tab is short, so no grey shows below the content.
    flexGrow: 1,
    backgroundColor: BrandColors.background,
    paddingBottom: 140,
  },
  container: {
    flex: 1,
    backgroundColor: BrandColors.background,
    paddingTop: 40,
    paddingHorizontal: 25,
    gap: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  header: {
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backWrapper: {
    position: 'absolute',
    left: -Spacing.two,
    zIndex: 1,
  },
  headerTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 20,
    color: BrandColors.primary,
    maxWidth: '62%',
  },
  centerBox: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
  },
  errorText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    color: BrandColors.error,
    textAlign: 'center',
  },
  dangerZone: {
    backgroundColor: BrandColors.surfaceAlt,
    gap: Spacing.two,
  },
  dangerTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    color: BrandColors.primary,
  },
  deleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  deleteText: {
    flex: 1,
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: BrandColors.primary,
  },
  deleteAction: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 11,
    color: BrandColors.error,
  },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    marginTop: Spacing.one,
  },
  leaveText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 13,
    color: BrandColors.error,
  },
  leaveError: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 13,
    color: BrandColors.error,
  },
  overNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: BrandColors.successBg,
    borderRadius: 12,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  overText: {
    flex: 1,
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    lineHeight: 16,
    color: BrandColors.primary,
  },
  fab: {
    position: 'absolute',
    right: 22,
    bottom: 100,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: BrandColors.base50,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
});
