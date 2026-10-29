import { BrandColors, Spacing } from '@/constants/theme';
import { TripMember } from '@/types/trips';
import { ReactionMap, REACTIONS, reactionRows, toggleReaction } from '@/utils/funExtras';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface ReactionStripProps {
  /** The expense's stored reactions, or undefined when nobody reacted. */
  reactions?: ReactionMap;
  members: TripMember[];
  currentUserId: string;
  /**
   * Called with the whole new map, ready to store.
   * Omit this on read-only screens: the strip then draws without being tappable.
   */
  onChange?: (next: ReactionMap) => void;
  /** Smaller faces for the short list on the trip page. */
  compact?: boolean;
}

/**
 * The reactions on one expense.
 *
 * The same six emoji always show when the strip is editable, so tapping is
 * predictable: the button you want is always in the same place. Once someone
 * has reacted, the counts appear above the row.
 *
 * Tapping your own reaction removes it, and picking a different one moves your
 * single reaction rather than adding a second.
 */
export default function ReactionStrip({
  reactions,
  members,
  currentUserId,
  onChange,
  compact = false,
}: ReactionStripProps) {
  const rows = reactionRows(reactions, members, currentUserId);
  const editable = !!onChange;

  if (!editable && rows.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {rows.length > 0 && (
        <View style={styles.rows}>
          {rows.map((row) => (
            <View
              key={row.emoji}
              style={[styles.chip, row.mine && styles.chipMine]}
              accessible
              accessibilityLabel={`${row.emoji} ${row.count}, ${row.names.join(', ')}`}
            >
              <Text style={styles.emoji}>{row.emoji}</Text>
              <Text style={[styles.count, row.mine && styles.countMine]}>{row.count}</Text>
            </View>
          ))}
        </View>
      )}

      {editable && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.picker}
        >
          {REACTIONS.map((emoji) => {
            const mine = rows.some((row) => row.emoji === emoji && row.mine);
            return (
              <Pressable
                key={emoji}
                onPress={() => onChange?.(toggleReaction(reactions ?? {}, emoji, currentUserId))}
                style={({ pressed }) => [
                  styles.pick,
                  compact && styles.pickCompact,
                  mine && styles.pickMine,
                  pressed && styles.pressed,
                ]}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityState={{ selected: mine }}
                accessibilityLabel={`React ${emoji}`}
              >
                <Text style={styles.pickEmoji}>{emoji}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.one,
  },
  rows: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: BrandColors.inputField,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  chipMine: {
    backgroundColor: BrandColors.base200,
  },
  emoji: {
    fontSize: 12,
  },
  count: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 11,
    color: BrandColors.secondary,
  },
  countMine: {
    color: BrandColors.base700,
  },
  picker: {
    gap: Spacing.one,
  },
  pick: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BrandColors.surfaceAlt,
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  pickCompact: {
    width: 26,
    height: 26,
    borderRadius: 9,
  },
  pickMine: {
    backgroundColor: BrandColors.base200,
    borderColor: BrandColors.base400,
  },
  pressed: {
    opacity: 0.6,
  },
  pickEmoji: {
    fontSize: 14,
  },
});
