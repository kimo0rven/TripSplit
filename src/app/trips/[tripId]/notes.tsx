import Avatar from '@/components/ui/avatar';
import BackButton from '@/components/Button/back-button';
import EmptyState from '@/components/ui/empty-state';
import ErrorState from '@/components/ui/error-state';
import ListSkeleton from '@/components/ui/list-skeleton';
import { BrandColors, MaxContentWidth, Spacing } from '@/constants/theme';
import { fetchTrip } from '@/services/Firebase/tripService';
import { useAuth } from '@/services/Firebase/useAuth';
import { createNote, fetchNotes } from '@/services/Firebase/noteService';
import { TripNote } from '@/types/expenses';
import { Trip, TripMember } from '@/types/trips';
import { dayHeading } from '@/utils/money';
import { shortName } from '@/utils/format';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MessagesSquare, ImagePlus, Send, X } from 'lucide-react-native';
import { Image } from 'expo-image';
import { NOTE_PHOTO_LIMIT, canUploadPhotos } from '@/utils/funExtras';
import { isConnected } from '@/services/offline/offlineStore';
import { pickImage } from '@/utils/imagePicker';
import { uploadNotePhoto } from '@/services/Supabase/receiptService';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** The most one note may be, matched by the database rules. */
const MAX_LENGTH = 1000;

/** The local day a note was posted, as YYYY-MM-DD. */
const dayKeyOf = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

/**
 * When a note was posted, in the reader's own timezone.
 *
 * `createdAt` is a UTC timestamp, so it is read through Date rather than cut up
 * as a string: slicing would show the server's clock, not the time the person
 * watching actually remembers writing it.
 */
const clockOf = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const hours = date.getHours();
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  const suffix = hours < 12 ? 'am' : 'pm';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;

  return `${hour12}:${minutes}${suffix}`;
};

interface NoteGroup {
  key: string;
  label: string;
  notes: TripNote[];
}

/**
 * The trip's note feed, drawn as a conversation.
 *
 * Trips generate plenty of messages that are not money: "the van is booked for
 * 7am", "bring a jacket", "I found the keys". Putting those in an expense would
 * be wrong, and a group chat loses them by the next day. A note feed keeps them
 * next to the trip they belong to.
 *
 * Bubbles read the way people already read a group chat: your own words on the
 * right, everyone else on the left, oldest at the top and the newest at the
 * bottom where the composer sits.
 */
export default function TripNotesScreen() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { currentUser } = useAuth();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [notes, setNotes] = useState<TripNote[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  /**
   * A photo left out of a note that did post.
   *
   * Kept apart from `sendError` because it is not a failure - the words went
   * through - and colouring it red would tell the person their note vanished.
   */
  const [sendWarning, setSendWarning] = useState('');
  const postWarning = !sendError && !!sendWarning;
  /** Photos chosen for the note being written, as local file URIs. */
  const [photos, setPhotos] = useState<string[]>([]);
  /** The note photo opened full screen, if any. */
  const [viewing, setViewing] = useState<string | null>(null);
  const loadedOnce = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const jumpedToEnd = useRef(false);

  const currentUserId = currentUser?.uid ?? '';
  const insets = useSafeAreaInsets();

  /**
   * How much of the screen the keyboard is covering.
   *
   * The app draws edge to edge on Android, which means the window no longer
   * shrinks when the keyboard opens — it simply covers whatever is behind it.
   * So the screen measures the keyboard itself and lifts the composer by that
   * much, instead of trusting the system to move things.
   */
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const load = useCallback(async () => {
    if (!tripId) {
      setError('This trip could not be found.');
      setLoading(false);
      loadedOnce.current = true;
      return;
    }

    try {
      setError('');
      const [tripData, noteData] = await Promise.all([fetchTrip(tripId), fetchNotes(tripId)]);

      if (!tripData) {
        setError('This trip could not be found.');
        return;
      }

      setTrip(tripData);
      setNotes(noteData);
    } catch (err) {
      console.error('Could not load the notes:', err);
      setError('Could not load the notes.');
    } finally {
      loadedOnce.current = true;
      setLoading(false);
    }
  }, [tripId]);

  // The first load sets the spinner; the trip id never changes for this screen.
  useEffect(() => {
    load();
  }, [load]);

  // Pull to refresh: its own spinner, so the conversation never blanks.
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  // Follow the keyboard: lift the composer while it is open, and slide the
  // newest words back into view so a reply is never written blind. On iOS the
  // frame is followed as it moves, so dragging the keyboard down gives a
  // smooth slide rather than a jump when it finally closes.
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const shown = Keyboard.addListener(showEvent, (event) => {
      const { height, screenY } = event.endCoordinates;
      // Only the part of the keyboard actually on screen counts: an iOS keyboard
      // can be dragged partly down.
      const covered =
        Platform.OS === 'ios' ? Math.max(0, Dimensions.get('window').height - screenY) : height;

      setKeyboardHeight(covered);
      // The composer has not moved yet at this point, so scrolling now would
      // target the old height and leave the newest words behind the keyboard.
      // Waiting one frame lets the new padding land first.
      requestAnimationFrame(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      });
    });

    const hidden = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));

    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  const members: TripMember[] = Object.values(trip?.members ?? {});

  const nameOf = (id: string) => members.find((member) => member.id === id)?.fullname || 'Someone';
  const photoOf = (id: string) => members.find((member) => member.id === id)?.photoURL || undefined;

  /**
   * The notes in reading order, broken into days.
   *
   * A conversation runs oldest to newest, so the newest words sit just above
   * the composer instead of at the top of the screen.
   */
  const groups = useMemo<NoteGroup[]>(() => {
    const ordered = [...notes].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    const out: NoteGroup[] = [];

    for (const note of ordered) {
      const key = dayKeyOf(note.createdAt);
      const last = out[out.length - 1];

      if (last && last.key === key) last.notes.push(note);
      else out.push({ key, label: dayHeading(key), notes: [note] });
    }

    return out;
  }, [notes]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !tripId || sending) return;

    setSending(true);
    setSendError('');

    try {
      /*
        Photos go to cloud storage, which has no offline queue. Rather than
        hang forever in a dead zone, the note text is sent on its own and the
        photos are set aside with a plain warning.
      */
      let photoUrls: string[] | undefined;
      let photoWarning = '';
      const gate = canUploadPhotos(isConnected());

      if (photos.length > 0 && !gate.ok) {
        photoWarning = gate.reason;
        photoUrls = undefined;
      } else if (photos.length > 0) {
        /*
          An upload that fails drops its photo rather than the whole note. The
          words someone typed must not be thrown away because a picture did not
          make it, so the note posts and the warning says what was left out.
        */
        const uploaded = await Promise.all(
          photos.map(async (uri, index) => {
            try {
              return await uploadNotePhoto(uri, tripId, tripId + '-' + index);
            } catch (err) {
              console.error('A note photo could not be uploaded:', err);
              return null;
            }
          }),
        );

        const kept = uploaded.filter((uri): uri is string => !!uri);
        photoUrls = kept.length > 0 ? kept : undefined;
        if (kept.length < photos.length) {
          photoWarning =
            kept.length === 0
              ? 'The note was posted, but its photo could not be uploaded.'
              : `The note was posted with ${kept.length} of ${photos.length} photos.`;
        }
      }

      const note = await createNote(tripId, text, currentUserId, photoUrls);
      setNotes((previous) => [...previous, note]);
      setDraft('');
      setPhotos([]);
      setSendWarning(photoWarning);
      jumpedToEnd.current = false;
    } catch (err) {
      console.error('Could not post the note:', err);
      setSendError('That note could not be posted. Try again.');
    } finally {
      setSending(false);
    }
  };

  /** Adds one photo to the note being written. */
  const handleAddPhoto = async () => {
    if (photos.length >= NOTE_PHOTO_LIMIT) {
      setSendError(`A note can carry up to ${NOTE_PHOTO_LIMIT} photos.`);
      return;
    }

    const gate = canUploadPhotos(isConnected());
    if (!gate.ok) {
      setSendError(gate.reason);
      return;
    }

    try {
      const result = await pickImage({ includeBase64: false });
      if (result.asset?.uri) {
        setPhotos((previous) => [...previous, result.asset.uri]);
        setSendError('');
      }
    } catch (err) {
      console.error('Could not open the photos:', err);
    }
  };

  /** Land on the newest words, the way a chat opens. */
  const handleContentSize = () => {
    if (jumpedToEnd.current || notes.length === 0) return;
    jumpedToEnd.current = true;
    scrollRef.current?.scrollToEnd({ animated: false });
  };

  return (
    <View style={[styles.flex, { paddingBottom: keyboardHeight }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.two }]}>
        <View style={[styles.backWrapper, { top: insets.top + 2 }]}>
          <BackButton onPress={() => router.back()} />
        </View>
        <Text style={styles.headerTitle}>Notes</Text>
        {!!trip && (
          <Text style={styles.headerSub} numberOfLines={1}>
            {shortName(trip.name)} · {notes.length} {notes.length === 1 ? 'note' : 'notes'}
          </Text>
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        onContentSizeChange={handleContentSize}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.container}>
          {loading ? (
            <ListSkeleton rows={4} rowHeight={78} />
          ) : error ? (
            <ErrorState message={error} onRetry={load} />
          ) : notes.length === 0 ? (
            <EmptyState
              icon={MessagesSquare}
              title="No notes yet"
              message="Say the things the group needs to know that are not a cost — bookings, meeting points, reminders."
            />
          ) : (
            groups.map((group) => (
              <View key={group.key || 'undated'} style={styles.group}>
                <View style={styles.dayPill}>
                  <Text style={styles.dayLabel}>{group.label}</Text>
                </View>

                {group.notes.map((note, index) => {
                  const mine = note.createdBy === currentUserId;
                  const previous = index > 0 ? group.notes[index - 1] : undefined;
                  const senderName = nameOf(note.createdBy);
                  const postedAt = clockOf(note.createdAt);

                  // Other people's notes carry a face, so a note in the middle
                  // of a run still says who wrote it. Your own words need no
                  // marker: the right-hand bubble already says who is talking.
                  const startsRun = !previous || previous.createdBy !== note.createdBy;

                  return (
                    <View
                      key={note.id}
                      style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowTheirs]}
                      accessible
                      accessibilityLabel={`${senderName}, ${postedAt}: ${note.body}`}
                    >
                      {!mine && (
                        <View style={styles.faceSlot}>
                          <Avatar name={senderName} size={26} photoURL={photoOf(note.createdBy)} />
                        </View>
                      )}

                      <View style={styles.bubbleColumn}>
                        {!mine && startsRun && (
                          <Text style={styles.sender} numberOfLines={1}>
                            {senderName}
                          </Text>
                        )}

                        <View
                          style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}
                        >
                          <Text style={styles.body}>{note.body}</Text>

                          {!!note.photoUrls?.length && (
                            <View style={styles.notePhotos}>
                              {note.photoUrls.map((uri, photoIndex) => (
                                <Pressable
                                  key={`${uri}-${photoIndex}`}
                                  onPress={() => setViewing(uri)}
                                  accessibilityRole="imagebutton"
                                  accessibilityLabel="Open this note's photo"
                                >
                                  <Image
                                    source={{ uri }}
                                    style={styles.notePhoto}
                                    contentFit="cover"
                                  />
                                </Pressable>
                              ))}
                            </View>
                          )}
                          <Text
                            style={[styles.clock, mine ? styles.clockMine : styles.clockTheirs]}
                          >
                            {postedAt}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <View
        style={[
          styles.composer,
          {
            // Sit just above the keyboard while it is open; when it closes,
            // fall back to the phone's own bottom inset so the home-indicator
            // bar never covers the send button.
            paddingBottom:
              keyboardHeight > 0
                ? Spacing.two
                : Math.max(Spacing.four, insets.bottom + Spacing.two),
          },
        ]}
      >
        <View style={styles.composerInner}>
          <Pressable
            style={styles.photoButton}
            onPress={handleAddPhoto}
            accessibilityRole="button"
            accessibilityLabel="Attach a photo"
          >
            <ImagePlus size={18} color={BrandColors.secondary} />
          </Pressable>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Write a note for the group…"
            placeholderTextColor={BrandColors.secondary}
            multiline
            maxLength={MAX_LENGTH}
            accessibilityLabel="Note text"
          />
          <Pressable
            style={[styles.sendButton, (!draft.trim() || sending) && styles.sendDisabled]}
            onPress={handleSend}
            disabled={!draft.trim() || sending}
            accessibilityRole="button"
            accessibilityLabel="Post the note"
          >
            <Send size={17} color={BrandColors.primary} />
          </Pressable>
        </View>

        {photos.length > 0 && (
          <View style={styles.photoStrip}>
            {photos.map((uri, index) => (
              <View key={`${uri}-${index}`} style={styles.photoPreviewWrap}>
                <Image source={{ uri }} style={styles.photoPreview} contentFit="cover" />
                <Pressable
                  style={styles.photoRemove}
                  onPress={() => setPhotos((previous) => previous.filter((_, i) => i !== index))}
                  accessibilityRole="button"
                  accessibilityLabel="Remove this photo"
                >
                  <X size={11} color={BrandColors.background} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
        {!!sendError && <Text style={styles.sendError}>{sendError}</Text>}
        {postWarning && <Text style={styles.sendWarning}>{sendWarning}</Text>}
      </View>

      {/* A note photo opens full screen on tap: the strip is small enough to
          misread, and a receipt or a sign in the background needs a close look. */}
      <Modal
        visible={!!viewing}
        transparent
        animationType="fade"
        onRequestClose={() => setViewing(null)}
        statusBarTranslucent
      >
        <Pressable style={styles.viewer} onPress={() => setViewing(null)}>
          {!!viewing && (
            <Image source={{ uri: viewing }} style={styles.viewerImage} contentFit="contain" />
          )}
          <Text style={styles.viewerClose}>Close</Text>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: BrandColors.background },
  header: {
    paddingHorizontal: 25,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  backWrapper: { position: 'absolute', left: 15, zIndex: 1 },
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
  scrollContent: { paddingBottom: Spacing.three, paddingTop: Spacing.two },
  container: {
    paddingHorizontal: 25,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  group: { gap: Spacing.one },

  // The small date tag that separates one day's talk from the next.
  dayPill: {
    alignSelf: 'center',
    backgroundColor: BrandColors.surfaceAlt,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: 3,
    marginTop: Spacing.two,
    marginBottom: Spacing.one,
  },
  dayLabel: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 11,
    color: BrandColors.secondary,
  },

  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.one },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  faceSlot: { width: 26, alignItems: 'center' },
  bubbleColumn: { maxWidth: '78%', gap: 2 },

  sender: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 11,
    color: BrandColors.secondary,
    marginLeft: Spacing.two,
    marginBottom: 1,
  },

  bubble: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 18,
  },
  bubbleTheirs: {
    backgroundColor: BrandColors.surfaceAlt,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderBottomLeftRadius: 5,
  },
  bubbleMine: {
    backgroundColor: BrandColors.base50,
    borderBottomRightRadius: 5,
  },

  body: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: BrandColors.primary,
  },
  clock: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 10,
    alignSelf: 'flex-end',
    marginTop: 2,
  },
  clockMine: { color: '#8A6209' },
  clockTheirs: { color: BrandColors.secondary },

  notePhotos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    marginTop: Spacing.one,
  },
  notePhoto: {
    width: 96,
    height: 96,
    borderRadius: 10,
    backgroundColor: BrandColors.inputField,
  },
  photoButton: {
    width: 38,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  photoPreviewWrap: {
    position: 'relative',
  },
  photoPreview: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: BrandColors.inputField,
  },
  /* Sits on the picture's corner, so removing is one tap and never a menu. */
  photoRemove: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BrandColors.primary,
  },

  composer: {
    borderTopWidth: 1,
    borderTopColor: BrandColors.border,
    paddingHorizontal: 25,
    paddingTop: Spacing.two,
    gap: Spacing.one,
    backgroundColor: BrandColors.background,
  },
  composerInner: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 21,
    backgroundColor: BrandColors.surfaceAlt,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    color: BrandColors.primary,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BrandColors.base50,
  },
  sendDisabled: { opacity: 0.45 },
  sendError: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: BrandColors.error,
    textAlign: 'center',
  },
  /* A photo that was left out is a warning, not a failure: the note did post. */
  sendWarning: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: BrandColors.warning,
    textAlign: 'center',
  },

  viewer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  viewerImage: { width: '100%', height: '78%' },
  viewerClose: {
    marginTop: Spacing.three,
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 14,
    color: BrandColors.background,
  },
});
