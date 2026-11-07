import ReceiptPicker from '@/components/trip/receipt-picker';
import { TextField } from '@/components/ui/text-input-field';
import DayField from '@/components/ui/day-field';
import TimeField from '@/components/ui/time-field';
import { BrandColors, Spacing } from '@/constants/theme';
import { daysOf, isInRange } from '@/utils/dateRange';
import { pickImage, takePhoto } from '@/utils/imagePicker';
import { formatDay, formatTime, parseDayKey } from '@/utils/money';
import { Image } from 'expo-image';
import { AlertTriangle, CalendarDays, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

/** A plan typed on the create screen, before the trip exists. */
export interface DraftPlan {
  title: string;
  day: string;
  time?: string;
  /** When it ends, HH:mm. Only kept with a start time. */
  endTime?: string;
  /** The plan's description. */
  notes?: string;
  /** Photos picked on this phone, uploaded when the trip is created. */
  photoUris?: string[];
}

interface PlanDraftsProps {
  plans: DraftPlan[];
  onChange: (plans: DraftPlan[]) => void;
  /** The trip's dates so far, '' when not picked yet. */
  startDate: string;
  endDate: string;
}

/** Up to two weeks of days show as chips; a longer trip picks from a calendar. */
const MAX_DAY_CHIPS = 14;

/** "Mon" and "Nov 10" for a day chip. */
const chipParts = (key: string) => {
  const date = parseDayKey(key);
  if (!date) return { weekday: '', day: key };
  return {
    weekday: new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date),
    day: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date),
  };
};

const byDayThenTime = (a: DraftPlan, b: DraftPlan) =>
  a.day === b.day ? (a.time || '99:99').localeCompare(b.time || '99:99') : a.day < b.day ? -1 : 1;

/**
 * The trip's first plans, typed before the trip is created.
 *
 * What is already added comes first. A new plan is written in a small card
 * opened by "Add a plan": a name, a day and an optional time. The day is one of
 * the trip's own days, as chips, so there is no calendar to wrestle with.
 */
export default function PlanDrafts({ plans, onChange, startDate, endDate }: PlanDraftsProps) {
  const range = { start: startDate, end: endDate };
  const tripDays = daysOf(range);
  const useChips = tripDays.length > 0 && tripDays.length <= MAX_DAY_CHIPS;

  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState('');
  const [day, setDay] = useState('');
  const [time, setTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [notes, setNotes] = useState('');
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [photoError, setPhotoError] = useState('');

  // The day shown as chosen: the picked one, else the trip's first day.
  const chosenDay = day || startDate || '';

  const openComposer = () => {
    setTitle('');
    setDay(startDate || '');
    setTime('');
    setEndTime('');
    setNotes('');
    setPhotoUris([]);
    setPhotoError('');
    setComposing(true);
  };

  const pickPhoto = async (source: 'camera' | 'library') => {
    setPhotoError('');
    try {
      const result =
        source === 'camera'
          ? await takePhoto({ quality: 0.7 })
          : await pickImage({ includeBase64: false, quality: 0.7, multiple: true });
      if (result.denied) {
        setPhotoError(
          source === 'camera'
            ? 'Camera access is off. Turn it on in your phone settings to take a photo.'
            : 'Photo access is off. Turn it on in your phone settings to pick a photo.',
        );
        return;
      }
      const uris = ((result as any).assets ?? (result.asset ? [result.asset] : [])).map(
        (asset: any) => asset.uri as string,
      );
      if (uris.length) setPhotoUris((previous) => [...previous, ...uris]);
    } catch (err) {
      console.error('Failed to pick a plan photo:', err);
      setPhotoError('Could not open your camera or photos.');
    }
  };

  const add = () => {
    if (!title.trim() || !chosenDay) return;
    onChange(
      [
        ...plans,
        {
          title: title.trim(),
          day: chosenDay,
          time: time || undefined,
          endTime: time && endTime ? endTime : undefined,
          notes: notes.trim() || undefined,
          photoUris: photoUris.length ? photoUris : undefined,
        },
      ].sort(byDayThenTime),
    );
    setComposing(false);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>Plans (optional)</Text>
        {plans.length > 0 && (
          <Text style={styles.count}>
            {plans.length} {plans.length === 1 ? 'plan' : 'plans'}
          </Text>
        )}
      </View>

      {plans.length === 0 && !composing && (
        <Text style={styles.hint}>
          Start the trip&apos;s itinerary now, like a check-in or a dinner. You can add more later.
        </Text>
      )}

      {plans.map((plan, index) => {
        const outside = !isInRange(range, plan.day);
        return (
          <View key={`${plan.title}-${plan.day}-${index}`} style={styles.planCard}>
            <View style={styles.planDate}>
              <Text style={styles.planWeekday}>{chipParts(plan.day).weekday}</Text>
              <Text style={styles.planDay}>{chipParts(plan.day).day}</Text>
            </View>
            <View style={styles.planBody}>
              <Text style={styles.planTitle} numberOfLines={1}>
                {plan.title}
              </Text>
              {outside ? (
                <View style={styles.warnRow}>
                  <AlertTriangle size={12} color={BrandColors.warning} />
                  <Text style={styles.warnText}>Outside the trip dates</Text>
                </View>
              ) : (
                <Text style={styles.planMeta} numberOfLines={1}>
                  {plan.time
                    ? formatTime(plan.time) + (plan.endTime ? ` – ${formatTime(plan.endTime)}` : '')
                    : 'Any time'}
                  {plan.photoUris?.length
                    ? ` · ${plan.photoUris.length} ${plan.photoUris.length === 1 ? 'photo' : 'photos'}`
                    : ''}
                </Text>
              )}
              {!!plan.notes && (
                <Text style={styles.planNotes} numberOfLines={2}>
                  {plan.notes}
                </Text>
              )}
            </View>
            {!!plan.photoUris?.length && (
              <Image
                source={{ uri: plan.photoUris[0] }}
                style={styles.planThumb}
                contentFit="cover"
              />
            )}
            <Pressable
              onPress={() => onChange(plans.filter((_, i) => i !== index))}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${plan.title}`}
            >
              <Trash2 size={16} color={BrandColors.error} />
            </Pressable>
          </View>
        );
      })}

      {composing ? (
        <View style={styles.composer}>
          <TextField
            title="What's the plan?"
            placeholder="e.g. Burnham Park picnic"
            value={title}
            onChangeText={setTitle}
          />

          {useChips ? (
            <View style={styles.group}>
              <Text style={styles.label}>Which day?</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chips}
              >
                {tripDays.map((key, index) => {
                  const on = key === chosenDay;
                  const parts = chipParts(key);
                  return (
                    <Pressable
                      key={key}
                      style={[styles.chip, on && styles.chipOn]}
                      onPress={() => setDay(key)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={`Day ${index + 1}, ${formatDay(key)}`}
                    >
                      <Text style={[styles.chipSmall, on && styles.chipTextOn]}>
                        Day {index + 1}
                      </Text>
                      <Text style={[styles.chipBig, on && styles.chipTextOn]}>{parts.day}</Text>
                      <Text style={[styles.chipSmall, on && styles.chipTextOn]}>
                        {parts.weekday}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : (
            <DayField
              label="Which day?"
              value={chosenDay}
              onChange={setDay}
              minDay={startDate || undefined}
              maxDay={startDate ? endDate || startDate : undefined}
            />
          )}

          <View style={styles.group}>
            <Text style={styles.label}>Time (optional)</Text>
            {/* Start and end side by side, as in the plan form inside a trip. */}
            <View style={styles.timeRow}>
              <View style={styles.timeHalf}>
                <TimeField label="Starts" value={time} onChange={setTime} />
              </View>
              <View style={styles.timeHalf}>
                <TimeField label="Ends" value={endTime} onChange={setEndTime} />
              </View>
            </View>
          </View>

          <TextField
            title="Description (optional)"
            placeholder="Meet-up point, budget, things to bring…"
            value={notes}
            onChangeText={setNotes}
            multiline
            minHeight={90}
          />

          <ReceiptPicker
            label="Photos (optional)"
            uris={photoUris}
            onRemove={(index) => setPhotoUris((previous) => previous.filter((_, i) => i !== index))}
            onPick={pickPhoto}
          />
          {!!photoError && <Text style={styles.photoError}>{photoError}</Text>}

          <View style={styles.actions}>
            <Pressable
              style={styles.cancel}
              onPress={() => setComposing(false)}
              accessibilityRole="button"
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.addButton, (!title.trim() || !chosenDay) && styles.addButtonOff]}
              onPress={add}
              disabled={!title.trim() || !chosenDay}
              accessibilityRole="button"
            >
              <Plus size={16} color={BrandColors.heading} />
              <Text style={styles.addText}>Add plan</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          style={({ pressed }) => [styles.addRow, pressed && styles.pressed]}
          onPress={openComposer}
          accessibilityRole="button"
        >
          <CalendarDays size={16} color={BrandColors.primary} />
          <Text style={styles.addRowText}>{plans.length ? 'Add another plan' : 'Add a plan'}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  timeRow: { flexDirection: 'row', gap: Spacing.two },
  timeHalf: { flex: 1 },
  wrap: { gap: Spacing.two },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: BrandColors.primary },
  count: { fontFamily: 'PlusJakartaSans-Medium', fontSize: 12, color: BrandColors.secondary },
  hint: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 12, color: BrandColors.secondary },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: BrandColors.surfaceAlt,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: Spacing.two,
  },
  planDate: {
    width: 52,
    alignItems: 'center',
    paddingVertical: Spacing.one,
    borderRadius: 10,
    backgroundColor: BrandColors.base200,
  },
  planWeekday: { fontFamily: 'PlusJakartaSans-Medium', fontSize: 10, color: BrandColors.primary },
  planDay: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 12, color: BrandColors.heading },
  planBody: { flex: 1, gap: 2 },
  planTitle: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: BrandColors.primary },
  planMeta: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 12, color: BrandColors.secondary },
  planNotes: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 12, color: BrandColors.primary },
  planThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: BrandColors.inputField,
  },
  photoError: { fontFamily: 'PlusJakartaSans-Medium', fontSize: 12, color: BrandColors.error },
  warnRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  warnText: { fontFamily: 'PlusJakartaSans-Medium', fontSize: 12, color: BrandColors.warning },
  composer: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: BrandColors.base50,
    backgroundColor: BrandColors.background,
  },
  group: { gap: Spacing.two },
  label: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: BrandColors.primary },
  chips: { gap: Spacing.two, paddingRight: Spacing.two },
  chip: {
    width: 64,
    alignItems: 'center',
    gap: 1,
    paddingVertical: Spacing.two,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BrandColors.border,
    backgroundColor: BrandColors.surfaceAlt,
  },
  chipOn: { backgroundColor: BrandColors.base50, borderColor: BrandColors.base50 },
  chipSmall: { fontFamily: 'PlusJakartaSans-Medium', fontSize: 10, color: BrandColors.secondary },
  chipBig: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 13, color: BrandColors.primary },
  chipTextOn: { color: BrandColors.heading },
  actions: { flexDirection: 'row', gap: Spacing.two },
  cancel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.two + 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  cancelText: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: BrandColors.secondary },
  addButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two + 2,
    borderRadius: 12,
    backgroundColor: BrandColors.base50,
  },
  addButtonOff: { opacity: 0.45 },
  addText: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: BrandColors.heading },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: BrandColors.base50,
  },
  addRowText: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: BrandColors.primary },
  pressed: { opacity: 0.7 },
});
