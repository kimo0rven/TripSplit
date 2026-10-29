import Avatar from '@/components/ui/avatar';
import { BrandColors, Spacing } from '@/constants/theme';
import { TripMember } from '@/types/trips';
import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

const AVATAR_SIZE = 44;
/** Avatar + ring border + ring padding, so the circle's own radius is exact. */
const RING_DIAMETER = AVATAR_SIZE + 8;

interface ParticipantPickerProps {
  members: TripMember[];
  /** The member ids currently chosen. */
  selectedIds: string[];
  onToggle: (memberId: string) => void;
  /** Labels the signed-in member so they can spot themselves at a glance. */
  currentUserId?: string;
}

/**
 * Pick people by their face, with no names.
 *
 * Dropping the labels keeps "Who paid?" and "Who shares the cost?" short
 * enough to read at once. The trade is that a plain face no longer says
 * whether it is chosen, so a tick badge marks the ones that are, and the
 * name stays as the screen-reader label for anyone not looking at pixels.
 */
export default function ParticipantPicker({
  members,
  selectedIds,
  onToggle,
  currentUserId,
}: ParticipantPickerProps) {
  return (
    <View style={styles.row}>
      {members.map((member) => {
        const on = selectedIds.includes(member.id);
        const label = member.id === currentUserId ? `${member.fullname} (you)` : member.fullname;
        return (
          <Pressable
            key={member.id}
            onPress={() => onToggle(member.id)}
            style={styles.chip}
            hitSlop={4}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={label}
          >
            <View style={[styles.ring, on && styles.ringOn]}>
              <Avatar name={member.fullname} size={AVATAR_SIZE} photoURL={member.photoURL} />
            </View>
            {on && (
              <View style={styles.tick}>
                <Check size={11} color={BrandColors.background} strokeWidth={3} />
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    // Padding rather than a bigger avatar: it widens the tap target to a
    // comfortable size without making the faces themselves heavier.
    padding: 3,
  },
  ring: {
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: RING_DIAMETER / 2,
    padding: 2,
  },
  ringOn: {
    borderColor: BrandColors.primary,
  },
  tick: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: BrandColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
