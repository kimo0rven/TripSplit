import ReceiptPicker from '@/components/trip/receipt-picker';
import ParticipantPicker from '@/components/trip/participant-picker';
import PrimaryButton from '@/components/Button/primary-button';
import BottomSheet from '@/components/ui/bottom-sheet';
import { HelperText } from '@/components/ui/card';
import DateCalendar from '@/components/ui/date-calendar';
import { TextField } from '@/components/ui/text-input-field';
import TimeField from '@/components/ui/time-field';
import { BrandColors, Spacing } from '@/constants/theme';
import { createItineraryItem, updateItineraryItem } from '@/services/Firebase/itineraryService';
import { uploadItineraryPhoto } from '@/services/Supabase/receiptService';
import { ItineraryItem } from '@/types/expenses';
import { TripMember } from '@/types/trips';
import { pickImage, takePhoto } from '@/utils/imagePicker';
import { toMinutes } from '@/utils/itinerary';
import { todayKey } from '@/utils/money';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface ItineraryFormProps {
  visible: boolean;
  onClose: () => void;
  tripId: string;
  currentUserId: string;
  /** Everyone's name, so the edit log can say who changed what. */
  memberNames?: Record<string, string>;
  /** Everyone in the trip, so the plan can say who is coming. */
  members?: TripMember[];
  /** Pre-fills the day when adding from inside a day group. */
  defaultDay?: string;
  /** When set, the form edits this plan instead of adding a new one. */
  item?: ItineraryItem | null;
  onSaved: (item: ItineraryItem) => void;
}

export default function ItineraryForm({
  visible,
  onClose,
  tripId,
  currentUserId,
  memberNames = {},
  members = [],
  defaultDay,
  item,
  onSaved,
}: ItineraryFormProps) {
  const [title, setTitle] = useState('');
  const [day, setDay] = useState(defaultDay || todayKey());
  const [time, setTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [attendeeIds, setAttendeeIds] = useState<string[]>([]);
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Fill the fields from the plan being edited each time the form opens.
  useEffect(() => {
    if (!visible || !item) return;
    setTitle(item.title);
    setDay(item.day);
    setTime(item.time ?? '');
    setEndTime(item.endTime ?? '');
    setLocation(item.location ?? '');
    setNotes(item.notes ?? '');
    setAttendeeIds(item.attendeeIds ?? []);
    setPhotoUris(item.photoUrls ?? []);
    setError('');
    setSaving(false);
  }, [visible, item]);

  const reset = () => {
    setTitle('');
    setDay(defaultDay || todayKey());
    setTime('');
    setEndTime('');
    setLocation('');
    setNotes('');
    setAttendeeIds([]);
    setPhotoUris([]);
    setError('');
    setSaving(false);
  };

  const handleClose = () => {
    if (saving) return;
    reset();
    onClose();
  };

  const handlePickPhoto = async (source: 'camera' | 'library') => {
    try {
      const result =
        source === 'camera'
          ? await takePhoto({ quality: 0.7 })
          : await pickImage({ includeBase64: false, quality: 0.7, multiple: true });

      if (result.denied) {
        setError(
          source === 'camera'
            ? 'Camera access is off. Turn it on in your phone settings to take a photo.'
            : 'Photo access is off. Turn it on in your phone settings to pick a photo.',
        );
        return;
      }

      const uris = ((result as any).assets ?? (result.asset ? [result.asset] : [])).map(
        (a: any) => a.uri,
      );
      if (uris.length) setPhotoUris((previous) => [...previous, ...uris]);
    } catch (err) {
      console.error('Failed to pick a plan photo:', err);
      setError('Could not open your camera or photos.');
    }
  };

  const handleSave = async () => {
    if (saving) return;
    setError('');

    if (!title.trim()) {
      setError('Give this plan a name.');
      return;
    }

    // A plan that ends before it starts would show a negative duration.
    const start = toMinutes(time);
    const end = toMinutes(endTime);
    if (start !== null && end !== null && end <= start) {
      setError('The end time needs to be later than the start time.');
      return;
    }

    setSaving(true);
    try {
      const photoUrls: string[] = [];
      for (const uri of photoUris) {
        // Photos that are already uploaded keep their link.
        if (/^https?:\/\//.test(uri)) {
          photoUrls.push(uri);
          continue;
        }
        try {
          photoUrls.push(await uploadItineraryPhoto(uri, tripId));
        } catch (uploadError) {
          console.error('Failed to upload plan photo:', uploadError);
          setError(
            `A photo could not be uploaded, so the plan was not saved. (${
              (uploadError as any)?.message ?? 'unknown error'
            })`,
          );
          setSaving(false);
          return;
        }
      }

      if (item) {
        const changes = { title, day, time, endTime, location, notes, attendeeIds, photoUrls };
        // The log is written from what the plan said before this edit, so it
        // can show the old value beside the new one.
        const entry = await updateItineraryItem(tripId, item.id, changes, item, {
          currency: '',
          names: memberNames,
          by: currentUserId,
          byName: memberNames[currentUserId] || 'Someone',
        });
        const {
          time: _t,
          endTime: _e,
          location: _l,
          notes: _n,
          attendeeIds: _a,
          photoUrls: _p,
          history: _h,
          ...base
        } = item;
        const saved: ItineraryItem = {
          ...base,
          title: title.trim(),
          day,
          ...(time.trim() ? { time: time.trim() } : {}),
          ...(endTime.trim() ? { endTime: endTime.trim() } : {}),
          ...(location.trim() ? { location: location.trim() } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
          ...(attendeeIds.length ? { attendeeIds } : {}),
          ...(photoUrls.length ? { photoUrls } : {}),
          ...(entry ? { history: [entry, ...(item.history ?? [])] } : { history: item.history }),
        };
        reset();
        onSaved(saved);
        return;
      }

      const saved = await createItineraryItem(tripId, {
        title,
        day,
        time,
        endTime,
        location,
        notes,
        attendeeIds,
        photoUrls,
        createdBy: currentUserId,
      });
      reset();
      onSaved(saved);
    } catch (err: any) {
      console.error('Failed to save itinerary item:', err);
      setError(err?.message || 'Could not save that plan.');
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      title={item ? 'Edit plan' : 'Add to itinerary'}
      onClose={handleClose}
      footer={
        <>
          {!!error && <HelperText tone="error">{error}</HelperText>}
          <PrimaryButton
            title={saving ? 'Saving…' : item ? 'Save changes' : 'Save plan'}
            onPress={handleSave}
            buttonColor={BrandColors.base50}
            textColor={BrandColors.primary}
            borderColor={BrandColors.base50}
            borderWidth={0}
            disabled={saving}
          />
        </>
      }
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
      >
        <TextField
          title="What is the plan?"
          placeholder="e.g. Burnham Park picnic"
          value={title}
          onChangeText={setTitle}
        />

        <ReceiptPicker
          label="Photos (optional)"
          uris={photoUris}
          onRemove={(index) => setPhotoUris((previous) => previous.filter((_, i) => i !== index))}
          onPick={handlePickPhoto}
        />

        <View style={styles.group}>
          <Text style={styles.label}>Which day?</Text>
          <DateCalendar value={day} onChange={setDay} />
        </View>

        <View style={styles.group}>
          <Text style={styles.label}>Time (optional)</Text>
          <TimeField value={time} onChange={setTime} />
        </View>

        <View style={styles.group}>
          <Text style={styles.label}>Ends (optional)</Text>
          <TimeField value={endTime} onChange={setEndTime} />
          <HelperText>
            Add an end time and the plan shows how long it runs, instead of a single moment.
          </HelperText>
        </View>

        {members.length > 1 && (
          <View style={styles.group}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Who is coming? (optional)</Text>
              {attendeeIds.length > 0 && (
                <Pressable
                  onPress={() => setAttendeeIds([])}
                  hitSlop={8}
                  accessibilityRole="button"
                >
                  <Text style={styles.clearLink}>Everyone</Text>
                </Pressable>
              )}
            </View>
            <ParticipantPicker
              members={members}
              selectedIds={attendeeIds.length ? attendeeIds : members.map((m) => m.id)}
              currentUserId={currentUserId}
              onToggle={(memberId) => {
                // An empty list means the whole trip is coming. The first tap
                // turns that into an explicit list minus the person tapped, so
                // ticking a face always does what it looks like it does.
                const base = attendeeIds.length ? attendeeIds : members.map((m) => m.id);
                const next = base.includes(memberId)
                  ? base.filter((id) => id !== memberId)
                  : [...base, memberId];
                setAttendeeIds(next.length === members.length ? [] : next);
              }}
            />
            <HelperText>
              {attendeeIds.length === 0
                ? 'Everyone in the trip, unless you pick who is not coming.'
                : `${attendeeIds.length} of ${members.length} coming.`}
            </HelperText>
          </View>
        )}

        <TextField
          title="Place (optional)"
          placeholder="e.g. Session Road"
          value={location}
          onChangeText={setLocation}
        />
        <TextField
          title="Description (optional)"
          placeholder="What's the plan? Meet-up point, budget, things to bring…"
          value={notes}
          onChangeText={setNotes}
          multiline
          minHeight={140}
        />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: Spacing.four,
    paddingBottom: Spacing.four,
  },
  group: {
    gap: Spacing.two,
  },
  label: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    color: BrandColors.primary,
    marginBottom: 2,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  clearLink: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 12,
    color: BrandColors.info,
  },
});
