import EmptyState from '@/components/ui/empty-state';
import ListSkeleton from '@/components/ui/list-skeleton';
import NavBar from '@/components/Navbar/Nav';
import FriendSheet from '@/components/friends/friend-sheet';
import SettleSheet from '@/components/trip/settle-sheet';
import Avatar from '@/components/ui/avatar';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import ConfirmSheet from '@/components/ui/confirm-sheet';
import PageHeader from '@/components/ui/page-header';
import { TextfieldLeftIcon } from '@/components/ui/text-input-field';
import { BrandColors, Spacing } from '@/constants/theme';
import { fetchExpenses } from '@/services/Firebase/expenseService';
import {
  acceptFriendRequest,
  fetchIncomingRequests,
  fetchOutgoingRequests,
  fetchUserFriends,
  removeFriend,
  removeFriendRequest,
} from '@/services/Firebase/friendService';
import { fetchSettlements } from '@/services/Firebase/settlementService';
import { fetchTrip } from '@/services/Firebase/tripService';
import { useAuth } from '@/services/Firebase/useAuth';
import { DebtEdge } from '@/types/expenses';
import { FriendProfile, FriendRequest } from '@/types/friends';
import { Trip, TripMember } from '@/types/trips';
import { computeBalances, simplifyDebts } from '@/utils/balance';
import { useFocusEffect, useRouter } from 'expo-router';
import { Check, Clock, Search, UserPlus, Users, X } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

/** Everything the settle-up sheet needs, gathered when Pay is tapped. */
interface PayContext {
  trip: Trip;
  members: TripMember[];
  edges: DebtEdge[];
  currency: string;
  friendId: string;
}

export default function FriendsScreen() {
  const { currentUser } = useAuth();
  const router = useRouter();

  const [searchEmail, setSearchEmail] = useState('');
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  // See useActiveTrip: the spinner belongs to the first load only.
  const loadedOnce = useRef(false);

  // Confirmations. `pendingAccept` asks the receiver; `removingRequest`
  // covers refusing and cancelling a request.
  const [pendingAccept, setPendingAccept] = useState<FriendRequest | null>(null);
  const [removingRequest, setRemovingRequest] = useState<{
    request: FriendRequest;
    mode: 'decline' | 'cancel';
  } | null>(null);
  const [busy, setBusy] = useState(false);

  // The friend sheet: one friend's details, what you owe each other, and the
  // Pay / Cancel / Remove friend buttons.
  const [sheetFriend, setSheetFriend] = useState<FriendProfile | null>(null);
  const [pendingRemoveFriend, setPendingRemoveFriend] = useState<FriendProfile | null>(null);
  const [removingFriend, setRemovingFriend] = useState(false);
  const [removeFriendError, setRemoveFriendError] = useState('');
  // Set once the trip behind a payment has loaded, which opens the settle form.
  const [payContext, setPayContext] = useState<PayContext | null>(null);

  const loadFriends = useCallback(async () => {
    if (!currentUser?.uid) {
      setLoading(false);
      loadedOnce.current = true;
      return;
    }

    try {
      setError('');
      const friendList = await fetchUserFriends(currentUser.uid);
      setFriends(friendList);

      // Requests live under their own rules. Until those are published the
      // reads are refused, so treat that as "no requests" instead of showing
      // an error over the whole page - the friends list itself still works.
      const [incomingList, outgoingList] = await Promise.all([
        fetchIncomingRequests(currentUser.uid).catch(() => [] as FriendRequest[]),
        fetchOutgoingRequests(currentUser.uid).catch(() => [] as FriendRequest[]),
      ]);
      setIncoming(incomingList);
      setOutgoing(outgoingList);
    } catch (err) {
      console.error('Failed to fetch friends:', err);
      setError('Could not load your friends right now.');
    } finally {
      loadedOnce.current = true;
      setLoading(false);
    }
  }, [currentUser?.uid]);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await loadFriends();
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      // The spinner is for the first load only. After that the saved copy comes
      // back at once, so hiding the list again would only be a flicker.
      if (!loadedOnce.current) setLoading(true);
      loadFriends();
    }, [loadFriends]),
  );

  // Filter the list as the user types, by name or email.
  const visibleFriends = useMemo(() => {
    const needle = searchEmail.trim().toLowerCase();
    if (!needle) return friends;
    return friends.filter(
      (friend) =>
        friend.fullname?.toLowerCase().includes(needle) ||
        friend.email?.toLowerCase().includes(needle),
    );
  }, [friends, searchEmail]);

  // Requests from people who are already friends are stale; hide them.
  const friendIds = useMemo(() => new Set(friends.map((f) => f.id)), [friends]);
  const visibleIncoming = useMemo(
    () => incoming.filter((r) => !friendIds.has(r.fromId)),
    [incoming, friendIds],
  );
  const visibleOutgoing = useMemo(
    () => outgoing.filter((r) => !friendIds.has(r.toId)),
    [outgoing, friendIds],
  );

  /** The receiver says yes. */
  const handleAccept = async () => {
    if (!pendingAccept || !currentUser?.uid || busy) return;

    setBusy(true);
    setError('');
    setStatus('');

    try {
      await acceptFriendRequest(currentUser.uid, pendingAccept.fromId);
      setStatus(`You and ${pendingAccept.fromName || 'they'} are now friends.`);
      setPendingAccept(null);
      await loadFriends();
    } catch (err: any) {
      console.error('Failed to accept friend request:', err);
      setError(err?.message || 'Could not accept that request.');
      setPendingAccept(null);
    } finally {
      setBusy(false);
    }
  };

  /** The receiver says no, or the sender takes back a request. */
  const handleRemoveRequest = async () => {
    if (!removingRequest || !currentUser?.uid || busy) return;

    setBusy(true);
    setError('');
    setStatus('');

    try {
      const otherId =
        removingRequest.mode === 'decline'
          ? removingRequest.request.fromId
          : removingRequest.request.toId;

      await removeFriendRequest(currentUser.uid, otherId);
      setStatus(removingRequest.mode === 'decline' ? 'Request declined.' : 'Request cancelled.');
      setRemovingRequest(null);
      await loadFriends();
    } catch (err: any) {
      console.error('Failed to remove friend request:', err);
      setError(err?.message || 'Could not remove that request.');
      setRemovingRequest(null);
    } finally {
      setBusy(false);
    }
  };

  /** The sheet's Remove button: confirm first, then unlink both sides. */
  const handleRemoveFriend = async () => {
    if (!pendingRemoveFriend?.id || !currentUser?.uid || removingFriend) return;

    setRemovingFriend(true);
    setRemoveFriendError('');

    try {
      await removeFriend(currentUser.uid, pendingRemoveFriend.id);
      setPendingRemoveFriend(null);
      setSheetFriend(null);
      setStatus(`${pendingRemoveFriend.fullname || 'They'} is no longer on your friends list.`);
      await loadFriends();
    } catch (err: any) {
      console.error('Failed to remove friend:', err);
      setRemoveFriendError(err?.message || 'Could not remove that friend.');
    } finally {
      setRemovingFriend(false);
    }
  };

  /**
   * Pay: the settle form needs the trip's members and its simplified debts, so
   * they are read here and the form opens once they arrive.
   */
  const handlePay = async (friend: FriendProfile, tripId: string) => {
    if (!currentUser?.uid) return;

    setError('');

    try {
      const [trip, expenses, settlements] = await Promise.all([
        fetchTrip(tripId),
        fetchExpenses(tripId),
        fetchSettlements(tripId),
      ]);

      if (!trip) {
        setSheetFriend(null);
        setError('That trip could not be found.');
        return;
      }

      const members = Object.values(trip.members ?? {});
      const balances = computeBalances(
        members.map((member) => member.id),
        expenses,
        settlements,
      );

      const context: PayContext = {
        trip,
        members,
        edges: simplifyDebts(balances),
        currency: trip.currency || 'PHP',
        friendId: friend.id,
      };

      // The friend sheet closes first and the payment form opens just after.
      // Asking iOS to dismiss one modal and present another in the same frame
      // is what leaves the second one invisible.
      setSheetFriend(null);
      setTimeout(() => setPayContext(context), 260);
    } catch (err: any) {
      console.error('Failed to open the payment form:', err);
      setSheetFriend(null);
      setError(err?.message || 'Could not open the payment form.');
    }
  };

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.container}>
          <PageHeader title="Friends" />

          {/* One slim row instead of a whole form, so the list gets the room. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add a friend"
            style={styles.addFriendButton}
            onPress={() => router.push('/friends/add' as any)}
          >
            <Text style={styles.addFriendText}>Add a friend</Text>
            <UserPlus size={18} color={BrandColors.heading} />
          </Pressable>

          {!!error && <Text style={styles.errorText}>{error}</Text>}
          {!!status && <Text style={styles.statusText}>{status}</Text>}

          {visibleIncoming.length > 0 && (
            <View style={styles.listSection}>
              <View style={styles.listHeader}>
                <Text style={styles.sectionTitle}>Requests for you</Text>
                <Text style={styles.count}>{visibleIncoming.length}</Text>
              </View>
              <Text style={styles.sectionHint}>
                These people want to be friends. Accept to add them to your list.
              </Text>

              <View style={styles.friendList}>
                {visibleIncoming.map((request) => (
                  <View key={request.fromId} style={styles.requestRow}>
                    <Avatar name={request.fromName} size={44} photoURL={request.fromPhotoURL} />
                    <View style={styles.friendInfo}>
                      <Text style={styles.friendName} numberOfLines={1}>
                        {request.fromName || 'Someone'}
                      </Text>
                      <Text style={styles.friendEmail} numberOfLines={1}>
                        {request.fromEmail}
                      </Text>
                    </View>

                    <Pressable
                      accessibilityLabel={`Accept ${request.fromName || 'request'}`}
                      style={styles.acceptButton}
                      onPress={() => setPendingAccept(request)}
                    >
                      <Check size={18} color={BrandColors.background} />
                    </Pressable>
                    <Pressable
                      accessibilityLabel={`Decline ${request.fromName || 'request'}`}
                      style={styles.declineButton}
                      onPress={() => setRemovingRequest({ request, mode: 'decline' })}
                    >
                      <X size={18} color={BrandColors.error} />
                    </Pressable>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={styles.listSection}>
            <View style={styles.listHeader}>
              <Text style={styles.sectionTitle}>Your friends</Text>
              {friends.length > 0 && <Text style={styles.count}>{friends.length}</Text>}
            </View>

            {friends.length > 0 && (
              <TextfieldLeftIcon
                title=""
                placeholder="Search friends"
                value={searchEmail}
                onChangeText={setSearchEmail}
                leftIcon={Search}
              />
            )}

            {loading ? (
              <ListSkeleton rows={4} rowHeight={64} />
            ) : friends.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No friends yet"
                message="Tap Add a friend to send someone a request, or share your QR code for them to scan."
              />
            ) : visibleFriends.length === 0 ? (
              <Text style={styles.emptyText}>No friends match your search.</Text>
            ) : (
              <View style={styles.friendList}>
                {visibleFriends.map((friend) => (
                  <Pressable
                    key={friend.id}
                    style={({ pressed }) => [styles.friendRow, pressed && styles.rowPressed]}
                    onPress={() => setSheetFriend(friend)}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${friend.fullname || friend.email || 'this friend'}`}
                  >
                    <Avatar name={friend.fullname} size={44} photoURL={friend.photoURL} />
                    <View style={styles.friendInfo}>
                      <Text style={styles.friendName} numberOfLines={1}>
                        {friend.fullname || friend.email || 'Friend'}
                      </Text>
                      <Text style={styles.friendEmail} numberOfLines={1}>
                        {friend.email}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {visibleOutgoing.length > 0 && (
            <View style={styles.listSection}>
              <Text style={styles.sectionTitle}>Waiting to be accepted</Text>
              <Text style={styles.sectionHint}>
                You sent these requests. They become friends once they accept.
              </Text>

              <View style={styles.friendList}>
                {visibleOutgoing.map((request) => (
                  <View key={request.toId} style={styles.friendRow}>
                    <Avatar name={request.toName} size={44} photoURL={request.toPhotoURL} />
                    <View style={styles.friendInfo}>
                      <Text style={styles.friendName} numberOfLines={1}>
                        {request.toName || request.toEmail || 'Someone'}
                      </Text>
                      <View style={styles.waitingRow}>
                        <Clock size={12} color={BrandColors.secondary} />
                        <Text style={styles.friendEmail} numberOfLines={1}>
                          Waiting to accept
                        </Text>
                      </View>
                    </View>
                    <Pressable
                      accessibilityLabel="Cancel request"
                      style={styles.cancelRequestButton}
                      onPress={() => setRemovingRequest({ request, mode: 'cancel' })}
                    >
                      <Text style={styles.cancelRequestText}>Cancel</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
      <NavBar />

      {/* Receiver's confirmation, before the friendship is created. */}
      <ConfirmDialog
        visible={!!pendingAccept}
        title="Accept friend request?"
        message={
          pendingAccept
            ? `Add ${pendingAccept.fromName || pendingAccept.fromEmail} to your friends? You will be able to add each other to trips and split expenses.`
            : ''
        }
        confirmLabel="Accept"
        cancelLabel="Not now"
        busy={busy}
        onConfirm={handleAccept}
        onCancel={() => {
          if (busy) return;
          setPendingAccept(null);
        }}
      />

      {/* Refusing or cancelling removes the request. */}
      <ConfirmDialog
        visible={!!removingRequest}
        title={removingRequest?.mode === 'decline' ? 'Decline request?' : 'Cancel request?'}
        message={
          removingRequest?.mode === 'decline'
            ? `This removes ${removingRequest?.request.fromName || 'the request'} from your list. They can send another request later.`
            : `This takes back your request to ${removingRequest?.request.toName || 'them'}. You can send another one later.`
        }
        confirmLabel={removingRequest?.mode === 'decline' ? 'Decline' : 'Cancel request'}
        cancelLabel="Keep it"
        destructive
        busy={busy}
        onConfirm={handleRemoveRequest}
        onCancel={() => {
          if (busy) return;
          setRemovingRequest(null);
        }}
      />

      {/* One friend: their face, what you owe each other, and the three
          buttons. Pay hands the trip over to the settle-up form below. */}
      <FriendSheet
        visible={!!sheetFriend}
        onClose={() => setSheetFriend(null)}
        friend={sheetFriend}
        currentUserId={currentUser?.uid ?? ''}
        onRemove={(friend) => {
          setRemoveFriendError('');
          // Close the friend card first, so the question is asked on its own
          // rather than on top of another sheet.
          setSheetFriend(null);
          setPendingRemoveFriend(friend);
        }}
        onPay={handlePay}
      />

      <ConfirmSheet
        visible={!!pendingRemoveFriend}
        icon="remove"
        title={`Remove ${pendingRemoveFriend?.fullname?.split(' ')[0] || 'this friend'}?`}
        message={
          pendingRemoveFriend
            ? `You will both be taken off each other's friends list. Anything you owe each other stays as it is, and you can send another request later.`
            : ''
        }
        confirmLabel="Remove"
        cancelLabel="Keep friend"
        busy={removingFriend}
        onConfirm={handleRemoveFriend}
        onCancel={() => {
          if (!removingFriend) setPendingRemoveFriend(null);
        }}
      >
        {!!removeFriendError && <Text style={styles.errorText}>{removeFriendError}</Text>}
      </ConfirmSheet>

      {/* The same settle-up sheet the trip screen uses, opened from here so a
          payment can be recorded without hunting for the trip first. */}
      {payContext && (
        <SettleSheet
          visible={!!payContext}
          onClose={() => setPayContext(null)}
          tripId={payContext.trip.id}
          currency={payContext.currency}
          members={payContext.members}
          edges={payContext.edges}
          currentUserId={currentUser?.uid ?? ''}
          preselect={{
            to: payContext.friendId,
            amount:
              payContext.edges.find(
                (edge) => edge.from === currentUser?.uid && edge.to === payContext.friendId,
              )?.amount ?? 0,
          }}
          onSaved={() => {
            setPayContext(null);
            setStatus('Payment recorded.');
            loadFriends();
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    // flexGrow lets the white panel fill the screen even when the list is
    // short, so the grey page never shows below the content.
    flexGrow: 1,
    backgroundColor: BrandColors.background,
    paddingBottom: 100,
  },
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    backgroundColor: BrandColors.background,
    paddingTop: 40,
    paddingHorizontal: 25,
    // The same gap the sections use inside themselves, so the space above a
    // section heading matches the space below it.
    gap: Spacing.three,
  },
  addFriendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: BrandColors.base500,
    backgroundColor: BrandColors.base500,
  },
  addFriendText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 15,
    color: BrandColors.heading,
  },
  sectionTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 15,
    color: BrandColors.primary,
  },
  sectionHint: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: BrandColors.secondary,
  },

  errorText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13,
    color: BrandColors.error,
    textAlign: 'center',
  },
  statusText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13,
    color: BrandColors.success,
    textAlign: 'center',
  },
  listSection: {
    gap: Spacing.three,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  count: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    color: BrandColors.secondary,
  },
  emptyText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    color: BrandColors.secondary,
    textAlign: 'center',
  },
  friendList: {
    gap: Spacing.two,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: BrandColors.background,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 15,
    padding: Spacing.three,
  },
  rowPressed: {
    backgroundColor: BrandColors.surfaceAlt,
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: BrandColors.background,
    borderWidth: 1,
    borderColor: BrandColors.info,
    borderRadius: 15,
    padding: Spacing.three,
  },
  friendInfo: {
    flex: 1,
    gap: Spacing.half,
  },
  friendName: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    color: BrandColors.primary,
  },
  friendEmail: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: BrandColors.secondary,
  },
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
  },
  acceptButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: BrandColors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: BrandColors.errorBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelRequestButton: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  cancelRequestText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: BrandColors.secondary,
  },
});
