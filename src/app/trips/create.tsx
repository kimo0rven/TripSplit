import BackButton from '@/components/Button/back-button';
import PrimaryButton from '@/components/Button/primary-button';
import Avatar from '@/components/ui/avatar';
import BigButtonOptions from '@/components/ui/big-button-options';
import DateCalendar from '@/components/ui/date-calendar';
import { TextField } from '@/components/ui/text-input-field';
import TimeField from '@/components/ui/time-field';
import TripDatesField from '@/components/ui/trip-dates-field';
import TripIconPicker from '@/components/ui/trip-icon-picker';
import { TripIconBadge } from '@/components/ui/trip-icon';
import { currencies } from '@/constants/currencies';
import { DEFAULT_TRIP_COLOR } from '@/constants/trip-colors';
import { DEFAULT_TRIP_ICON } from '@/constants/trip-icons';
import { BrandColors, MaxContentWidth, Spacing } from '@/constants/theme';
import { fetchUserFriends } from '@/services/Firebase/friendService';
import { createTrip } from '@/services/Firebase/tripService';
import { useAuth } from '@/services/Firebase/useAuth';
import { FriendProfile } from '@/types/friends';
import { formatDay, formatTime, parseAmount, todayKey } from '@/utils/money';
import { useRouter } from 'expo-router';
import { Check, Plus, Trash2, UserPlus } from 'lucide-react-native';
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

const TRIP_CURRENCIES = currencies;

/** A plan being typed on the create screen, before the trip exists. */
interface DraftPlan {
  title: string;
  day: string;
  time?: string;
}

export default function CreateTripScreen() {
  const router = useRouter();
  const { currentUser } = useAuth();

  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('PHP');
  const [icon, setIcon] = useState(DEFAULT_TRIP_ICON);
  const [iconColor, setIconColor] = useState(DEFAULT_TRIP_COLOR);
  const [budget, setBudget] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  /** Starting plans; each needs a name and a day, the time is optional. */
  const [plans, setPlans] = useState<DraftPlan[]>([]);
  const [planTitle, setPlanTitle] = useState('');
  const [planDay, setPlanDay] = useState(todayKey());
  const [planTime, setPlanTime] = useState('');
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

  const addPlan = () => {
    if (!planTitle.trim()) return;
    setPlans((previous) => [
      ...previous,
      { title: planTitle.trim(), day: planDay, time: planTime || undefined },
    ]);
    setPlanTitle('');
    setPlanTime('');
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

      const trip = await createTrip({
        name,
        currency,
        icon,
        iconColor,
        startDate,
        endDate,
        budget: parseAmount(budget) > 0 ? parseAmount(budget) / 100 : undefined,
        itinerary: plans.map((plan) => ({
          title: plan.title,
          day: plan.day,
          ...(plan.time ? { time: plan.time } : {}),
        })),
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

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Currency</Text>
            <BigButtonOptions
              choices={TRIP_CURRENCIES}
              selectedValue={currency}
              onSelect={(choice) => setCurrency(choice.value)}
              maxHeight={220}
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

          <View style={styles.section}>
            <TextField
              title="Budget (optional)"
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
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Plans (optional)</Text>
              {plans.length > 0 && (
                <Text style={styles.selectedCount}>
                  {plans.length} {plans.length === 1 ? 'plan' : 'plans'} added
                </Text>
              )}
            </View>

            {plans.map((plan, index) => (
              <View key={`${plan.title}-${index}`} style={styles.planRow}>
                <View style={styles.planBody}>
                  <Text style={styles.planTitle} numberOfLines={1}>
                    {plan.title}
                  </Text>
                  <Text style={styles.planMeta} numberOfLines={1}>
                    {formatDay(plan.day)}
                    {plan.time ? ` · ${formatTime(plan.time)}` : ''}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setPlans((previous) => previous.filter((_, i) => i !== index))}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${plan.title}`}
                >
                  <Trash2 size={16} color={BrandColors.error} />
                </Pressable>
              </View>
            ))}

            <TextField
              title="What is the plan?"
              placeholder="e.g. Burnham Park picnic"
              value={planTitle}
              onChangeText={setPlanTitle}
            />

            <View style={styles.group}>
              <Text style={styles.fieldLabel}>Which day?</Text>
              <DateCalendar value={planDay} onChange={setPlanDay} />
            </View>

            <View style={styles.group}>
              <Text style={styles.fieldLabel}>Time (optional)</Text>
              <TimeField value={planTime} onChange={setPlanTime} />
            </View>

            <Pressable
              style={[styles.addPlanButton, !planTitle.trim() && styles.addPlanButtonOff]}
              onPress={addPlan}
              disabled={!planTitle.trim()}
            >
              <Plus size={16} color={BrandColors.primary} />
              <Text style={styles.addPlanText}>Add this plan</Text>
            </Pressable>
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
  group: {
    gap: Spacing.two,
  },
  fieldLabel: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    color: BrandColors.primary,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: BrandColors.surfaceAlt,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 12,
    padding: Spacing.three,
  },
  planBody: {
    flex: 1,
    gap: 2,
  },
  planTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    color: BrandColors.primary,
  },
  planMeta: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    color: BrandColors.secondary,
  },
  addPlanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    backgroundColor: BrandColors.base50,
    borderRadius: 12,
    paddingVertical: Spacing.three,
  },
  addPlanButtonOff: {
    // Kept visible so the button does not jump around while a name is typed,
    // but clearly not pressable until there is something to add.
    opacity: 0.45,
  },
  addPlanText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    color: BrandColors.primary,
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
