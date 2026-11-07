import BackButton from '@/components/Button/back-button';
import PrimaryButton from '@/components/Button/primary-button';
import Avatar from '@/components/ui/avatar';
import PlanDrafts, { type DraftPlan } from '@/components/trip/plan-drafts';
import { TextField } from '@/components/ui/text-input-field';
import CurrencyField from '@/components/ui/currency-field';
import TripDatesField from '@/components/ui/trip-dates-field';
import TripIconPicker from '@/components/ui/trip-icon-picker';
import { TripIconBadge } from '@/components/ui/trip-icon';
import { DEFAULT_TRIP_COLOR } from '@/constants/trip-colors';
import { DEFAULT_TRIP_ICON } from '@/constants/trip-icons';
import { BrandColors, MaxContentWidth, Spacing } from '@/constants/theme';
import { fetchUserFriends } from '@/services/Firebase/friendService';
import { createTrip } from '@/services/Firebase/tripService';
import { newId } from '@/services/offline/offlineStore';
import { uploadItineraryPhoto } from '@/services/Supabase/receiptService';
import { useAuth } from '@/services/Firebase/useAuth';
import { FriendProfile } from '@/types/friends';
import { parseAmount } from '@/utils/money';
import { useRouter } from 'expo-router';
import { Check, UserPlus } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

/** Most trips are in pesos; a trip abroad can pick its own currency. */
const DEFAULT_CURRENCY = 'PHP';

export default function CreateTripScreen() {
  const router = useRouter();
  const { currentUser } = useAuth();

  const [name, setName] = useState('');
  const [icon, setIcon] = useState(DEFAULT_TRIP_ICON);
  const [iconColor, setIconColor] = useState(DEFAULT_TRIP_COLOR);
  const [budget, setBudget] = useState('');
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  /** Starting plans; each needs a name and a day, the time is optional. */
  const [plans, setPlans] = useState<DraftPlan[]>([]);
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadFriends = async () => {
      if (!currentUser?.uid) {
        setLoadingFriends(false);
        return;
      }

      try {
        const data = await fetchUserFriends(currentUser.uid);
        setFriends(data);
      } catch (err) {
        console.error('Failed to load friends:', err);
      } finally {
        setLoadingFriends(false);
      }
    };

    loadFriends();
  }, [currentUser?.uid]);

  const toggleFriend = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleCreate = async () => {
    if (!name.trim() || !startDate || saving) return;

    setSaving(true);
    setError('');

    try {
      if (!currentUser?.uid) throw new Error('You need to be signed in.');

      const owner = {
        id: currentUser.uid,
        fullname: currentUser.displayName || currentUser.email?.split('@')[0] || 'You',
        email: currentUser.email || '',
        ...(currentUser.photoURL ? { photoURL: currentUser.photoURL } : {}),
      };

      const members = friends
        .filter((friend) => selectedIds.includes(friend.id))
        .map((friend) => ({
          id: friend.id,
          fullname: friend.fullname,
          email: friend.email,
          photoURL: friend.photoURL,
        }));

      // Plan photos are uploaded under the trip's own folder, so the trip's id is
      // made here first. A photo that cannot be uploaded stops the save, the same
      // as on an expense: a plan quietly missing its photos would be worse.
      const tripId = newId();
      const itinerary = [];
      for (const plan of plans) {
        const photoUrls: string[] = [];
        for (const uri of plan.photoUris ?? []) {
          try {
            photoUrls.push(await uploadItineraryPhoto(uri, tripId));
          } catch (uploadError: any) {
            throw new Error(
              `A photo for "${plan.title}" could not be uploaded, so the trip was not created. (${
                uploadError?.message || 'Upload failed'
              })`,
            );
          }
        }
        itinerary.push({
          title: plan.title,
          day: plan.day,
          ...(plan.time ? { time: plan.time } : {}),
          ...(plan.time && plan.endTime ? { endTime: plan.endTime } : {}),
          ...(plan.notes ? { notes: plan.notes } : {}),
          ...(photoUrls.length ? { photoUrls } : {}),
        });
      }

      const trip = await createTrip({
        id: tripId,
        name,
        currency,
        icon,
        iconColor,
        startDate,
        endDate,
        budget: parseAmount(budget) > 0 ? parseAmount(budget) / 100 : undefined,
        itinerary,
        owner,
        members,
      });

      router.replace(`/trips/${trip.id}` as any);
    } catch (err: any) {
      console.error('Failed to create trip:', err);
      setError(err?.message || 'Could not create the trip. Please try again.');
      setSaving(false);
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
        <Text style={styles.headerTitle}>New Trip</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <TextField
            title="Trip name"
            placeholder="e.g. Baguio Weekend"
            value={name}
            onChangeText={setName}
          />

          <View style={styles.section}>
            <View style={styles.iconHeader}>
              <Text style={styles.sectionTitle}>Icon</Text>
              {/* The live badge shows what the trip will look like in the list
                  before it is created, so the colour and picture are chosen
                  against the real thing rather than a swatch. */}
              <TripIconBadge name={icon} colorKey={iconColor} size={44} />
            </View>
            <TripIconPicker
              value={icon}
              onSelect={setIcon}
              colorValue={iconColor}
              onSelectColor={setIconColor}
            />
          </View>

          <TripDatesField
            startDate={startDate}
            endDate={endDate}
            onChange={(dates) => {
              setStartDate(dates.startDate);
              setEndDate(dates.endDate);
            }}
          />

          <CurrencyField
            value={currency}
            onChange={setCurrency}
            hint={
              <Text style={styles.sectionHint}>
                What the trip’s amounts are kept in. Expenses paid in another currency can still be
                entered and are converted at that day’s rate.
              </Text>
            }
          />

          <View style={styles.section}>
            <TextField
              title={`Budget in ${currency} (optional)`}
              placeholder="e.g. 15000"
              value={budget}
              onChangeText={setBudget}
              keyboardType="numeric"
            />
            <Text style={styles.sectionHint}>
              A target to aim at. Reports will show how much of it is used.
            </Text>
          </View>

          {/* Plans can be typed in now, so the trip's itinerary starts with a
              plan rather than an empty page. They are saved with the trip. */}
          <View style={styles.section}>
            <PlanDrafts plans={plans} onChange={setPlans} startDate={startDate} endDate={endDate} />
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Invite friends</Text>
              {selectedIds.length > 0 && (
                <Text style={styles.selectedCount}>{selectedIds.length} selected</Text>
              )}
            </View>

            {loadingFriends ? (
              <View style={styles.friendsLoading}>
                <ActivityIndicator color={BrandColors.base50} />
              </View>
            ) : friends.length === 0 ? (
              <View style={styles.noFriends}>
                <UserPlus size={22} color={BrandColors.secondary} />
                <Text style={styles.noFriendsText}>
                  You have no friends yet. Add them from the Friends tab, or invite them later with
                  the trip's code.
                </Text>
              </View>
            ) : (
              <View style={styles.friendList}>
                {friends.map((friend) => {
                  const isSelected = selectedIds.includes(friend.id);
                  return (
                    <Pressable
                      key={friend.id}
                      style={[styles.friendRow, isSelected && styles.friendRowSelected]}
                      onPress={() => toggleFriend(friend.id)}
                    >
                      <Avatar name={friend.fullname} size={40} />
                      <View style={styles.friendInfo}>
                        <Text style={styles.friendName} numberOfLines={1}>
                          {friend.fullname}
                        </Text>
                        <Text style={styles.friendEmail} numberOfLines={1}>
                          {friend.email}
                        </Text>
                      </View>
                      <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                        {isSelected && <Check size={16} color={BrandColors.background} />}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {!!error && <Text style={styles.errorText}>{error}</Text>}
        <PrimaryButton
          title={saving ? 'Creating…' : 'Create trip'}
          onPress={handleCreate}
          buttonColor={BrandColors.base50}
          textColor={BrandColors.primary}
          borderColor={BrandColors.base50}
          borderWidth={0}
          disabled={!name.trim() || !startDate || saving}
        />
      </View>
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
    paddingBottom: Spacing.six,
  },
  content: {
    paddingHorizontal: 25,
    paddingTop: Spacing.five,
    gap: Spacing.five,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  section: {
    gap: Spacing.three,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  selectedCount: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: BrandColors.info,
  },
  friendsLoading: {
    paddingVertical: Spacing.four,
    alignItems: 'center',
  },
  noFriends: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: BrandColors.surfaceAlt,
    borderRadius: 15,
    padding: Spacing.three,
  },
  noFriendsText: {
    flex: 1,
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13,
    color: BrandColors.secondary,
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
  friendRowSelected: {
    borderColor: BrandColors.base50,
    backgroundColor: BrandColors.surfaceAlt,
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
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: BrandColors.disabled,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: BrandColors.base50,
    borderColor: BrandColors.base50,
  },
  footer: {
    paddingHorizontal: 25,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.two,
  },
  errorText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13,
    color: BrandColors.error,
    textAlign: 'center',
  },
});
