import BackButton from '@/components/Button/back-button';
import PrimaryButton from '@/components/Button/primary-button';
import Avatar from '@/components/ui/avatar';
import { TextfieldLeftIcon } from '@/components/ui/text-input-field';
import TripShareSheet from '@/components/trip/trip-share-sheet';
import { BrandColors, MaxContentWidth, Spacing } from '@/constants/theme';
import { fetchUserFriends } from '@/services/Firebase/friendService';
import {
  fetchTrip,
  fetchTripMembers,
  inviteByEmail,
  inviteFriendToTrip,
} from '@/services/Firebase/tripService';
import { useAuth } from '@/services/Firebase/useAuth';
import { FriendProfile } from '@/types/friends';
import { buildTripQr } from '@/utils/qr';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Copy, Mail, QrCode as QrIcon, Search, Share2, UserPlus } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default function InviteMembersScreen() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { currentUser } = useAuth();

  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [inviteCode, setInviteCode] = useState('');
  const [tripName, setTripName] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [invitingEmail, setInvitingEmail] = useState(false);

  const [search, setSearch] = useState('');
  const [qrOpen, setQrOpen] = useState(false);

  const load = useCallback(async () => {
    if (!currentUser?.uid || !tripId) {
      setLoading(false);
      return;
    }

    try {
      setError('');
      const [friendList, members, trip] = await Promise.all([
        fetchUserFriends(currentUser.uid),
        fetchTripMembers(tripId),
        fetchTrip(tripId),
      ]);
      setFriends(friendList);
      setMemberIds(members.map((member) => member.id));
      setInviteCode(trip?.inviteCode || '');
      setTripName(trip?.name || '');
    } catch (err) {
      console.error('Failed to load invite data:', err);
      setError('Could not load your friends right now.');
    } finally {
      setLoading(false);
    }
  }, [currentUser?.uid, tripId]);

  useEffect(() => {
    load();
  }, [load]);

  // Filter the friend list as the user types, by name or email.
  const visibleFriends = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return friends;
    return friends.filter(
      (friend) =>
        friend.fullname?.toLowerCase().includes(needle) ||
        friend.email?.toLowerCase().includes(needle),
    );
  }, [friends, search]);

  const shareInvite = async () => {
    if (!inviteCode) return;

    // The link works in any chat app: tapping it opens TripSplit and asks the
    // person to join. The code is there too, in case they prefer typing it.
    const link = buildTripQr(inviteCode);

    try {
      await Share.share({
        message: `Join my trip on TripSplit: ${link}\nOr type invite code ${inviteCode} in the app.`,
      });
    } catch (err) {
      console.error('Failed to share invite:', err);
    }
  };

  const copyCode = async () => {
    if (!inviteCode) return;

    try {
      // A browser has a clipboard API; a phone does not, so there we share the
      // text instead and let the person paste it where they like.
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(inviteCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        return;
      }
      await shareInvite();
    } catch {
      // Clipboard permissions can be refused; sharing is the fallback.
      await shareInvite();
    }
  };

  const handleInviteFriend = async (friend: FriendProfile) => {
    if (busyId || memberIds.includes(friend.id)) return;

    setBusyId(friend.id);
    setStatus('');
    setError('');

    try {
      const result = await inviteFriendToTrip(tripId as string, {
        id: friend.id,
        fullname: friend.fullname,
        email: friend.email,
        photoURL: friend.photoURL,
      });

      if (!result.success) {
        setError(result.message);
      } else {
        setMemberIds((prev) => [...prev, friend.id]);
        setStatus(result.message);
      }
    } catch (err) {
      console.error('Failed to invite friend:', err);
      setError('Could not add that friend. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const handleInviteEmail = async () => {
    if (!email.trim() || invitingEmail) return;

    setInvitingEmail(true);
    setStatus('');
    setError('');

    try {
      const result = await inviteByEmail(tripId as string, email);
      if (!result.success) {
        setError(result.message);
      } else {
        setStatus(result.message);
        if (result.member) {
          setMemberIds((prev) => [...prev, result.member!.id]);
        }
        setEmail('');
      }
    } catch (err) {
      console.error('Failed to invite by email:', err);
      setError('Could not send that invite. Please try again.');
    } finally {
      setInvitingEmail(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <View style={styles.backWrapper}>
          <BackButton onPress={() => router.back()} />
        </View>
        <Text style={styles.headerTitle}>Invite Members</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>Trip invite code</Text>
            <Text style={styles.codeValue} selectable>
              {inviteCode || '—'}
            </Text>
            {!!inviteCode && (
              <View style={styles.codeActions}>
                <Pressable style={styles.codeAction} onPress={copyCode}>
                  <Copy size={15} color={BrandColors.primary} />
                  <Text style={styles.codeActionText}>{copied ? 'Copied' : 'Copy'}</Text>
                </Pressable>
                <Pressable style={styles.codeAction} onPress={shareInvite}>
                  <Share2 size={15} color={BrandColors.primary} />
                  <Text style={styles.codeActionText}>Share</Text>
                </Pressable>
                {/* The QR used to sit below this card in full, taking a big
                    square of the page even when nobody wanted it. It now opens
                    the same slide-up sheet the trip card uses. */}
                <Pressable style={styles.codeAction} onPress={() => setQrOpen(true)}>
                  <QrIcon size={15} color={BrandColors.primary} />
                  <Text style={styles.codeActionText}>QR</Text>
                </Pressable>
              </View>
            )}
          </View>

          <View style={styles.byEmailSection}>
            <Text style={styles.sectionTitle}>Invite by email</Text>
            <Text style={styles.sectionHint}>Add someone who already has a TripSplit account.</Text>
            <View style={styles.emailRow}>
              <View style={styles.emailField}>
                <TextfieldLeftIcon
                  title=""
                  placeholder="friend@email.com"
                  value={email}
                  onChangeText={setEmail}
                  leftIcon={Mail}
                />
              </View>
              <Pressable
                style={[styles.addButton, (!email.trim() || invitingEmail) && styles.addDisabled]}
                onPress={handleInviteEmail}
                disabled={!email.trim() || invitingEmail}
              >
                {invitingEmail ? (
                  <ActivityIndicator color={BrandColors.background} size="small" />
                ) : (
                  <UserPlus size={20} color={BrandColors.background} />
                )}
              </Pressable>
            </View>
          </View>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or pick from friends</Text>
            <View style={styles.divider} />
          </View>

          {!!error && <Text style={styles.errorText}>{error}</Text>}
          {!!status && <Text style={styles.statusText}>{status}</Text>}

          {friends.length > 0 && (
            <TextfieldLeftIcon
              title=""
              placeholder="Search friends"
              value={search}
              onChangeText={setSearch}
              leftIcon={Search}
            />
          )}

          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator color={BrandColors.base50} />
            </View>
          ) : friends.length === 0 ? (
            <View style={styles.centerBox}>
              <Search size={24} color={BrandColors.secondary} />
              <Text style={styles.emptyText}>
                No friends to show yet. Invite someone by email above, or share the invite code at
                the top of this page.
              </Text>
            </View>
          ) : visibleFriends.length === 0 ? (
            <View style={styles.centerBox}>
              <Search size={24} color={BrandColors.secondary} />
              <Text style={styles.emptyText}>No friends match your search.</Text>
            </View>
          ) : (
            <View style={styles.friendList}>
              {visibleFriends.map((friend) => {
                const isMember = memberIds.includes(friend.id);
                const isBusy = busyId === friend.id;

                return (
                  <View key={friend.id} style={styles.friendRow}>
                    <Avatar name={friend.fullname} size={40} photoURL={friend.photoURL} />
                    <View style={styles.friendInfo}>
                      <Text style={styles.friendName} numberOfLines={1}>
                        {friend.fullname}
                      </Text>
                      <Text style={styles.friendEmail} numberOfLines={1}>
                        {friend.email}
                      </Text>
                    </View>

                    {isMember ? (
                      <View style={styles.addedBadge}>
                        <Check size={14} color={BrandColors.success} />
                        <Text style={styles.addedText}>Added</Text>
                      </View>
                    ) : (
                      <Pressable
                        style={[styles.inviteButton, isBusy && styles.addDisabled]}
                        onPress={() => handleInviteFriend(friend)}
                        disabled={isBusy}
                      >
                        {isBusy ? (
                          <ActivityIndicator color={BrandColors.primary} size="small" />
                        ) : (
                          <Text style={styles.inviteButtonText}>Invite</Text>
                        )}
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          title="Done"
          onPress={() => router.replace(`/trips/${tripId}` as any)}
          buttonColor={BrandColors.base50}
          textColor={BrandColors.primary}
          borderColor={BrandColors.base50}
          borderWidth={0}
        />
      </View>

      {/* The same sheet the trip card opens, minus its "invite from your
          friends" button - this is already that page. */}
      <TripShareSheet
        visible={qrOpen}
        onClose={() => setQrOpen(false)}
        tripName={tripName}
        inviteCode={inviteCode}
      />
    </KeyboardAvoidingView>
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
  scrollContent: {
    paddingBottom: Spacing.five,
  },
  content: {
    paddingHorizontal: 25,
    paddingTop: Spacing.five,
    gap: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  byEmailSection: {
    gap: Spacing.two,
  },
  codeCard: {
    backgroundColor: BrandColors.surfaceAlt,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 16,
    paddingVertical: Spacing.four,
    alignItems: 'center',
    gap: Spacing.one,
  },
  codeLabel: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: BrandColors.secondary,
  },
  codeValue: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 30,
    letterSpacing: 6,
    color: BrandColors.primary,
  },
  codeActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  codeAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    backgroundColor: BrandColors.base200,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  codeActionText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 12,
    color: BrandColors.primary,
  },
  sectionTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    color: BrandColors.primary,
  },
  sectionHint: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: BrandColors.secondary,
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  emailField: {
    flex: 1,
  },
  addButton: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: BrandColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addDisabled: {
    opacity: 0.5,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: BrandColors.border,
  },
  dividerText: {
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
  centerBox: {
    paddingVertical: Spacing.five,
    alignItems: 'center',
    gap: Spacing.two,
  },
  emptyText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13,
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
  inviteButton: {
    backgroundColor: BrandColors.base50,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    minWidth: 64,
    alignItems: 'center',
  },
  inviteButtonText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    color: BrandColors.primary,
  },
  addedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    backgroundColor: BrandColors.successBg,
    borderRadius: 10,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },
  addedText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: BrandColors.success,
  },
  footer: {
    paddingHorizontal: 25,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.five,
  },
});
