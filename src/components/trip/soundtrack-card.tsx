import { FieldLabel } from '@/components/ui/choice-chips';
import { Card, HelperText } from '@/components/ui/card';
import { BrandColors, Spacing } from '@/constants/theme';
import { addTrack, deleteTrack, fetchTracks } from '@/services/Firebase/funService';
import { saveErrorMessage } from '@/services/offline/offlineStore';
import { TripMember } from '@/types/trips';
import { Track, isDuplicateTrack, parseTrack } from '@/utils/funExtras';
import { Music, Trash2 } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

interface SoundtrackCardProps {
  tripId: string;
  members: TripMember[];
  currentUserId: string;
  /** Whether this person may remove anyone's song, or only their own. */
  isOwner: boolean;
}

/**
 * One song per person, and the trip has a soundtrack.
 *
 * A tiny list on purpose: a soundtrack of forty songs is a playlist, and a
 * playlist is a different app. Limiting it to one line each keeps this a fun
 * card rather than a second job.
 */
export default function SoundtrackCard({
  tripId,
  members,
  currentUserId,
  isOwner,
}: SoundtrackCardProps) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!tripId) return;
    try {
      setTracks(await fetchTracks(tripId));
    } catch (err) {
      console.error('Could not load the soundtrack:', err);
    } finally {
      setLoaded(true);
    }
  }, [tripId]);

  useEffect(() => {
    load();
  }, [load]);

  const nameOf = (id: string) =>
    members.find((member) => member.id === id)?.fullname.split(' ')[0] ?? 'Someone';

  const handleAdd = async () => {
    const text = draft.trim();
    if (!text || busy) return;

    setBusy(true);
    setError('');

    try {
      const parsed = parseTrack(text);
      if (!parsed) return;
      if (isDuplicateTrack(tracks, parsed)) {
        setError('That song is already on the trip.');
        return;
      }

      const track = await addTrack(tripId, text, currentUserId);
      setTracks((previous) => [track, ...previous]);
      setDraft('');
    } catch (err) {
      console.error('Could not add the song:', err);
      setError(saveErrorMessage(err, 'That song could not be added. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (track: Track) => {
    const before = tracks;
    setTracks((previous) => previous.filter((entry) => entry.id !== track.id));
    try {
      await deleteTrack(tripId, track.id);
    } catch (err) {
      console.error('Could not remove the song:', err);
      setTracks(before);
    }
  };

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <Music size={16} color={BrandColors.primary} />
        <Text style={styles.title}>Trip soundtrack</Text>
      </View>

      <HelperText>
        The song this trip should be remembered by. Anyone can add one, and the recap shows it.
      </HelperText>

      {tracks.length > 0 && (
        <View style={styles.list}>
          {tracks.map((track) => {
            const mine = track.addedBy === currentUserId;
            const canRemove = mine || isOwner;
            return (
              <View key={track.id} style={styles.row}>
                <View style={styles.body}>
                  <Text style={styles.song} numberOfLines={1}>
                    {track.title}
                  </Text>
                  <Text style={styles.by} numberOfLines={1}>
                    {track.artist ? `${track.artist} · ` : ''}
                    added by {nameOf(track.addedBy)}
                    {mine ? ' (you)' : ''}
                  </Text>
                </View>
                {canRemove && (
                  <Pressable
                    onPress={() => handleRemove(track)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${track.title}`}
                  >
                    <Trash2 size={14} color={BrandColors.secondary} />
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      )}

      {loaded && tracks.length === 0 && (
        <Text style={styles.empty}>No song yet. Type one below and the trip has a theme.</Text>
      )}

      <FieldLabel>Add a song</FieldLabel>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={(text) => {
            setDraft(text);
            if (error) setError('');
          }}
          placeholder="Artist - Song, or just the song"
          placeholderTextColor={BrandColors.secondary}
          maxLength={130}
          returnKeyType="send"
          onSubmitEditing={handleAdd}
        />
        <Pressable
          onPress={handleAdd}
          disabled={!draft.trim() || busy}
          style={({ pressed }) => [
            styles.addButton,
            (!draft.trim() || busy) && styles.addDisabled,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
        >
          {busy ? (
            <ActivityIndicator size="small" color={BrandColors.primary} />
          ) : (
            <Text style={styles.addText}>Add</Text>
          )}
        </Pressable>
      </View>

      {!!error && <Text style={styles.error}>{error}</Text>}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: BrandColors.surfaceAlt,
    gap: Spacing.two,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  title: {
    flex: 1,
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 15,
    color: BrandColors.primary,
  },
  list: {
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: BrandColors.background,
    borderRadius: 12,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  body: {
    flex: 1,
    gap: 1,
  },
  song: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    color: BrandColors.primary,
  },
  by: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    color: BrandColors.secondary,
  },
  empty: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: BrandColors.secondary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  input: {
    flex: 1,
    minWidth: 0,
    backgroundColor: BrandColors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BrandColors.border,
    paddingHorizontal: Spacing.three,
    paddingVertical: 9,
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 13,
    color: BrandColors.primary,
  },
  addButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: BrandColors.base50,
  },
  addDisabled: {
    opacity: 0.4,
  },
  addText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    color: BrandColors.primary,
  },
  error: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 11,
    color: BrandColors.error,
  },
  pressed: {
    opacity: 0.6,
  },
});
