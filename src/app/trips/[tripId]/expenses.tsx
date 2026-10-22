import ErrorState from '@/components/ui/error-state';
import ListSkeleton from '@/components/ui/list-skeleton';
import BackButton from '@/components/Button/back-button';
import ExpenseCards from '@/components/trip/expense-cards';
import ExpenseDetailSheet from '@/components/trip/expense-detail-sheet';
import ExpenseForm from '@/components/trip/expense-form';
import ConfirmSheet from '@/components/ui/confirm-sheet';
import EmptyState from '@/components/ui/empty-state';
import { BrandColors, MaxContentWidth, Spacing } from '@/constants/theme';
import { deleteExpense, fetchExpenses } from '@/services/Firebase/expenseService';
import { fetchTrip } from '@/services/Firebase/tripService';
import { useAuth } from '@/services/Firebase/useAuth';
import { Expense } from '@/types/expenses';
import { Trip, TripMember } from '@/types/trips';
import { formatMoney } from '@/utils/money';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Plus, Receipt } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

/**
 * Every expense of one trip.
 *
 * The trip's own Expenses tab shows only the newest few; this is where the
 * whole history lives. The dashboard's "View all" opens this same page.
 */
export default function AllExpensesScreen() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { currentUser } = useAuth();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [expenses, setExpenses] = useState<Awaited<ReturnType<typeof fetchExpenses>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  // The spinner belongs to the first load only; afterwards the saved copy is
  // already on screen and blanking it would just flicker.
  const loadedOnce = useRef(false);

  const load = useCallback(async () => {
    if (!tripId) {
      setError('This trip could not be found.');
      setLoading(false);
      loadedOnce.current = true;
      return;
    }

    try {
      setError('');
      const [tripData, expenseData] = await Promise.all([fetchTrip(tripId), fetchExpenses(tripId)]);
      if (tripData) setTrip(tripData);
      setExpenses(expenseData);
    } catch (err) {
      console.error('Failed to load expenses:', err);
      setError('Could not load these expenses.');
    } finally {
      loadedOnce.current = true;
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    if (!loadedOnce.current) setLoading(true);
    load();
  }, [load]);

  const members: TripMember[] = useMemo(() => {
    const list = Object.values(trip?.members ?? {});
    return [...list].sort((a, b) => {
      if (a.role === b.role) return (a.fullname || '').localeCompare(b.fullname || '');
      return a.role === 'owner' ? -1 : 1;
    });
  }, [trip]);

  const currentUserId = currentUser?.uid ?? '';
  const currency = trip?.currency || 'PHP';
  const total = expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);

  const runDelete = async () => {
    if (!pendingDelete || !tripId || deleting) return;

    setDeleting(true);
    try {
      await deleteExpense(tripId, pendingDelete.id);
      setExpenses((previous) => previous.filter((entry) => entry.id !== pendingDelete.id));
      setPendingDelete(null);
    } catch (err) {
      console.error('Failed to delete expense:', err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <View style={styles.backWrapper}>
          <BackButton onPress={() => router.back()} />
        </View>
        <Text style={styles.headerTitle}>All expenses</Text>
        {!!trip && (
          <Text style={styles.headerSub} numberOfLines={1}>
            {trip.name} · {expenses.length} {expenses.length === 1 ? 'entry' : 'entries'} ·{' '}
            {formatMoney(total, currency)}
          </Text>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          {loading ? (
            <ListSkeleton rows={5} rowHeight={72} />
          ) : error ? (
            <ErrorState message={error} onRetry={load} />
          ) : expenses.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No expenses yet"
              message="Once someone adds an expense, it shows up here in full."
              actionLabel="Add expense"
              onAction={() => setFormOpen(true)}
            />
          ) : (
            <>
              <ExpenseCards
                expenses={expenses}
                members={members}
                currency={currency}
                currentUserId={currentUserId}
                canChange={() => true}
                onPress={(expense) => setDetailId(expense.id)}
                onDelete={(id, title) => setPendingDelete({ id, title })}
                onEdit={(expense) => {
                  setEditingExpense(expense);
                  setFormOpen(true);
                }}
              />
              <Text style={styles.footNote}>
                Anyone in this trip can edit or delete an expense. Every change is kept in the
                expense's edit log.
              </Text>
            </>
          )}
        </View>
      </ScrollView>

      {/* Adding here saves straight into this trip, so the page can be used on
          its own without hopping back to the trip screen. */}
      {!loading && !error && (
        <Pressable
          style={styles.fab}
          onPress={() => setFormOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Add an expense"
        >
          <Plus size={24} color={BrandColors.primary} />
        </Pressable>
      )}

      {!!trip && (
        <ExpenseForm
          visible={formOpen}
          onClose={() => {
            setFormOpen(false);
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
            setFormOpen(false);
          }}
        />
      )}

      <ExpenseDetailSheet
        expense={expenses.find((entry) => entry.id === detailId) ?? null}
        onClose={() => setDetailId(null)}
        members={members}
        currency={currency}
        currentUserId={currentUserId}
        onEdit={(expense) => {
          setEditingExpense(expense);
          setFormOpen(true);
        }}
      />

      <ConfirmSheet
        visible={!!pendingDelete}
        icon="delete"
        title={pendingDelete ? `Delete "${pendingDelete.title}"?` : 'Delete?'}
        message="This expense will be removed for everyone in the trip."
        confirmLabel="Delete"
        cancelLabel="Keep it"
        busy={deleting}
        onConfirm={runDelete}
        onCancel={() => {
          if (!deleting) setPendingDelete(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: BrandColors.background,
  },
  header: {
    paddingTop: 40,
    paddingHorizontal: 25,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  backWrapper: {
    position: 'absolute',
    left: 15,
    top: 34,
    zIndex: 1,
  },
  headerTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 20,
    color: BrandColors.primary,
  },
  headerSub: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: BrandColors.secondary,
  },
  scrollContent: {
    paddingBottom: 140,
  },
  container: {
    paddingTop: Spacing.four,
    paddingHorizontal: 25,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
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
  footNote: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    lineHeight: 16,
    color: BrandColors.secondary,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: 22,
    bottom: 30,
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
