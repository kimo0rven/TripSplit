import Avatar from '@/components/ui/avatar';
import { BrandColors } from '@/constants/theme';
import { TripMember } from '@/types/trips';
import { StyleSheet, Text, View } from 'react-native';

interface MemberFacesProps {
  members: TripMember[];
  /** How many faces fit before the rest are counted as "+2". */
  max?: number;
  size?: number;
  /**
   * The colour of the card behind the faces. Each face wears a ring in this
   * colour, so overlapping circles read as separate faces instead of one blob.
   */
  ringColor?: string;
}

/**
 * A row of overlapping faces, owner first.
 *
 * The caller is expected to have sorted `members` already, so the same people
 * appear in the same order every time the screen is drawn.
 */
export default function MemberFaces({
  members,
  max = 3,
  size = 26,
  ringColor = BrandColors.background,
}: MemberFacesProps) {
  const shown = members.slice(0, max);
  const extra = members.length - shown.length;
  const overlap = Math.round(size * 0.35);

  return (
    <View style={styles.faces}>
      {shown.map((member, index) => (
        <View
          key={member.id}
          style={[
            styles.ring,
            { borderColor: ringColor, borderRadius: size / 2 + 2 },
            index > 0 && { marginLeft: -overlap },
          ]}
        >
          <Avatar name={member.fullname} size={size} photoURL={member.photoURL} />
        </View>
      ))}
      {extra > 0 && (
        <View
          style={[
            styles.ring,
            styles.more,
            {
              borderColor: ringColor,
              borderRadius: (size + 4) / 2,
              width: size + 4,
              height: size + 4,
            },
            shown.length > 0 && { marginLeft: -overlap },
          ]}
        >
          <Text style={[styles.moreText, { fontSize: size * 0.4 }]}>+{extra}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  faces: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ring: {
    borderWidth: 2,
  },
  more: {
    backgroundColor: BrandColors.base400,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreText: {
    fontFamily: 'PlusJakartaSans-Bold',
    color: BrandColors.primary,
  },
});
