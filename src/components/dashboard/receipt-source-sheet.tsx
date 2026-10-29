import BottomSheet from '@/components/ui/bottom-sheet';
import { HelperText } from '@/components/ui/card';
import { BrandColors, Spacing } from '@/constants/theme';
import { shortName } from '@/utils/format';
import { Camera, Images, Receipt } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface ReceiptSourceSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Which trip the photo will be saved on. */
  tripName?: string;
  onPick: (source: 'camera' | 'library') => void;
}

/**
 * Asks where the receipt photo should come from: the camera, or photos that
 * are already on the phone.
 *
 * The photo itself does not go anywhere yet - it is handed to the expense form,
 * which saves it on the trip together with the amount it belongs to.
 */
export default function ReceiptSourceSheet({
  visible,
  onClose,
  tripName,
  onPick,
}: ReceiptSourceSheetProps) {
  return (
    <BottomSheet visible={visible} title="Receipt photo" onClose={onClose}>
      <View style={styles.wrap}>
        <HelperText>
          {tripName
            ? `The photo is saved on “${shortName(tripName)}”, attached to the expense you add next.`
            : 'Take a photo of the receipt, then add the expense it belongs to.'}
        </HelperText>

        <Pressable
          style={styles.option}
          onPress={() => onPick('camera')}
          accessibilityRole="button"
        >
          <View style={styles.optionIcon}>
            <Camera size={20} color={BrandColors.primary} />
          </View>
          <View style={styles.optionBody}>
            <Text style={styles.optionTitle}>Take a photo</Text>
            <Text style={styles.optionHint}>Point the camera at the receipt</Text>
          </View>
        </Pressable>

        <Pressable
          style={styles.option}
          onPress={() => onPick('library')}
          accessibilityRole="button"
        >
          <View style={styles.optionIcon}>
            <Images size={20} color={BrandColors.primary} />
          </View>
          <View style={styles.optionBody}>
            <Text style={styles.optionTitle}>Choose from photos</Text>
            <Text style={styles.optionHint}>Pick a picture already on this phone</Text>
          </View>
        </Pressable>

        <View style={styles.note}>
          <Receipt size={14} color={BrandColors.secondary} />
          <Text style={styles.noteText}>
            A receipt photo on its own is not an expense. Add the amount next and it is kept with
            the trip for everyone to see.
          </Text>
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.three,
    paddingBottom: Spacing.four,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 16,
    padding: Spacing.three,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: BrandColors.base200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionBody: {
    flex: 1,
    gap: 2,
  },
  optionTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    color: BrandColors.primary,
  },
  optionHint: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: BrandColors.secondary,
  },
  note: {
    flexDirection: 'row',
    gap: Spacing.two,
    backgroundColor: BrandColors.surfaceAlt,
    borderRadius: 12,
    padding: Spacing.three,
  },
  noteText: {
    flex: 1,
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    lineHeight: 17,
    color: BrandColors.secondary,
  },
});
