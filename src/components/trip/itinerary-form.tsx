import ReceiptPicker from '@/components/trip/receipt-picker';
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
import { pickImage, takePhoto } from '@/utils/imagePicker';
import { todayKey } from '@/utils/money';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

interface ItineraryFormProps {
  visible: boolean;
  onClose: () => void;
  tripId: string;
  currentUserId: string;
  /** Everyone's name, so the edit log can say who changed what. */
  memberNames?: Record<string, string>;
  /** Pre-fills the day when adding from inside a day group. */
  defaultDay?: string;
  /** When set, the form edits this plan instead of adding a new one. */
  item?: ItineraryItem | null;
  onSaved: (item: ItineraryItem) => void;
}

/** Times people actually plan around, offered as one-tap chips. */
const TIME_PRESETS = ['07:00', '09:00', '12:00', '15:00', '18:00', '20:00'];

export default function ItineraryForm({
  visible,
  onClose,
  tripId,
  currentUserId,
  memberNames = {},
  defaultDay,
  item,
  onSaved,
}: ItineraryFormProps) {
  const [title, setTitle] = useState('');
  const [day, setDay] = useState(defaultDay || todayKey());
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Fill the fields from the plan being edited each time the form opens.
  useEffect(() => {
    if (!visible || !item) return;
    setTitle(item.title);
    setDay(item.day);
    setTime(item.time ?? '');
    setLocation(item.location ?? '');
    setNotes(item.notes ?? '');
    setPhotoUris(item.photoUrls ?? []);
    setError('');
    setSaving(false);
  }, [visible, item]);

  const reset = () => {
    setTitle('');
    setDay(defaultDay || todayKey());
    setTime('');
    setLocation('');
    setNotes('');
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
        const changes = { title, day, time, location, notes, photoUrls };
        // The log is written from what the plan said before this edit, so it
        // can show the old value beside the new one.
        const entry = await updateItineraryItem(tripId, item.id, changes, item, {
          currency: '',
          names: memberNames,
          by: currentUserId,
          byName: memberNames[currentUserId] || 'Someone',
        });
        const { time: _t, location: _l, notes: _n, photoUrls: _p, history: _h, ...base } = item;
        const saved: ItineraryItem = {
          ...base,
          title: title.trim(),
          day,
          ...(time.trim() ? { time: time.trim() } : {}),
          ...(location.trim() ? { location: location.trim() } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
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
        location,
        notes,
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
          <TimeField value={time} onChange={setTime} presets={TIME_PRESETS} />
        </View>

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
});
