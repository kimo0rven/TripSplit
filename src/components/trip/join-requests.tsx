import Avatar from '@/components/ui/avatar';
import BottomSheet from '@/components/ui/bottom-sheet';
import { HelperText } from '@/components/ui/card';
import { BrandColors, Spacing } from '@/constants/theme';
import {
  approveJoinRequest,
  declineJoinRequest,
  fetchJoinRequests,
} from '@/services/Firebase/tripService';
import { JoinRequest, TripMember } from '@/types/trips';
import { useFocusEffect } from 'expo-router';
import { ChevronRight, UserPlus } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { themedStyles } from '@/constants/themed-styles';

interface JoinRequestsProps {
  tripId: string;
  ownerId: string;
  /** A new member, once let in, so the page can show them without a reload. */
  onApproved: (member: TripMember) => void;
}

const ago = (iso: string): string => {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (!Number.isFinite(minutes)) return '';
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
};

/**
 * For the owner: a banner when people are waiting to join, and the sheet to
 * let each one in or turn them away. Shows nothing while nobody is waiting.
 */
export default function JoinRequests({ tripId, ownerId, onApproved }: JoinRequestsProps) {
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    fetchJoinRequests(tripId)
      .then(setRequests)
      .catch((err) => console.warn('Could not load join requests:', err));
  }, [tripId]);

  useFocusEffect(load);

  const answer = async (request: JoinRequest, letIn: boolean) => {
    if (busyId) return;
    setBusyId(request.id);
    setError('');
    try {
      if (letIn) {
        onApproved(await approveJoinRequest(tripId, ownerId, request));
      } else {
        await declineJoinRequest(tripId, ownerId, request);
      }
      const left = requests.filter((item) => item.id !== request.id);
      setRequests(left);
      if (!left.length) setOpen(false);
    } catch (err: any) {
      console.error('Failed to answer a join request:', err);
      setError(err?.message || 'Could not answer that request.');
    } finally {
      setBusyId('');
    }
  };

  if (!requests.length) return null;

  const first = requests[0].fullname.split(' ')[0] || 'Someone';
  const label =
    requests.length === 1
      ? `${first} wants to join`
      : `${first} and ${requests.length - 1} more want to join`;

  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.banner, pressed && styles.pressed]}
        onPress={() => {
          setError('');
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${label}. Review`}
      >
        <View style={styles.bannerIcon}>
          <UserPlus size={16} color={BrandColors.primary} />
        </View>
        <View style={styles.bannerText}>
          <Text style={styles.bannerTitle}>{label}</Text>
          <Text style={styles.bannerHint}>Tap to let them in or turn them away</Text>
        </View>
        <ChevronRight size={16} color={BrandColors.secondary} />
      </Pressable>

      <BottomSheet
        visible={open}
        title="Requests to join"
        onClose={() => setOpen(false)}
        footer={error ? <HelperText tone="error">{error}</HelperText> : undefined}
      >
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          <HelperText>
            People you let in see every expense, payment, photo and plan in this trip.
          </HelperText>
          {requests.map((request) => {
            const busy = busyId === request.id;
            return (
              <View key={request.id} style={styles.row}>
                <View style={styles.person}>
                  <Avatar name={request.fullname} size={40} photoURL={request.photoURL} />
                  <View style={styles.personText}>
                    <Text style={styles.name} numberOfLines={1}>
                      {request.fullname}
                    </Text>
                    <Text style={styles.meta} numberOfLines={1}>
                      {[
                        request.invitedBy
                          ? `Invited by ${request.invitedByName?.split(' ')[0] || 'a member'}`
                          : request.email,
                        ago(request.requestedAt),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                </View>
                <View style={styles.buttons}>
                  <Pressable
                    style={({ pressed }) => [styles.decline, pressed && styles.pressed]}
                    onPress={() => answer(request, false)}
                    disabled={!!busyId}
                    accessibilityRole="button"
                    accessibilityLabel={`Turn ${request.fullname} away`}
                  >
                    <Text style={styles.declineText}>Decline</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.approve, pressed && styles.pressed]}
                    onPress={() => answer(request, true)}
                    disabled={!!busyId}
                    accessibilityRole="button"
                    accessibilityLabel={`Let ${request.fullname} in`}
                  >
                    <Text style={styles.approveText}>{busy ? 'Saving…' : 'Let in'}</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </ScrollView>
      </BottomSheet>
    </>
  );
}

const styles = themedStyles(() => ({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: BrandColors.infoBg,
    borderRadius: 12,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  bannerIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: BrandColors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerText: { flex: 1, gap: 1 },
  bannerTitle: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 13, color: BrandColors.primary },
  bannerHint: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 11, color: BrandColors.secondary },
  pressed: { opacity: 0.7 },
  list: { gap: Spacing.three, paddingBottom: Spacing.four },
  row: {
    gap: Spacing.two,
    backgroundColor: BrandColors.inputField,
    borderRadius: 15,
    padding: Spacing.three,
  },
  person: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  personText: { flex: 1, gap: 2 },
  name: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 15, color: BrandColors.primary },
  meta: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 12, color: BrandColors.secondary },
  buttons: { flexDirection: 'row', gap: Spacing.two },
  decline: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: Spacing.two,
    backgroundColor: BrandColors.errorBg,
  },
  declineText: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: BrandColors.error },
  approve: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: Spacing.two,
    backgroundColor: BrandColors.base50,
  },
  approveText: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: BrandColors.onBrand },
}));
