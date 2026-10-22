import { FieldLabel } from '@/components/ui/choice-chips';
import { BrandColors, Spacing } from '@/constants/theme';
import { Image } from 'expo-image';
import { Camera, Images, Trash2 } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface ReceiptPickerProps {
  uris: string[];
  onRemove: (index: number) => void;
  onPick: (source: 'camera' | 'library') => void;
  label?: string;
}

/** The receipt photos on an expense, with buttons to take or choose more. */
export default function ReceiptPicker({ uris, onRemove, onPick, label = 'Receipt photos' }: ReceiptPickerProps) {
  return (
    <View style={styles.group}>
      <FieldLabel>{label}</FieldLabel>
      {uris.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.receiptStrip}>
            {uris.map((uri, index) => (
              <View key={`${uri}-${index}`} style={styles.receiptPreview}>
                <Image source={{ uri }} style={styles.receiptImage} contentFit="cover" />
                <Pressable style={styles.receiptRemove} onPress={() => onRemove(index)}>
                  <Trash2 size={14} color={BrandColors.background} />
                  <Text style={styles.receiptRemoveText}>Remove</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
      <View style={styles.receiptChoiceRow}>
        <Pressable style={styles.receiptButton} onPress={() => onPick('camera')}>
          <Camera size={18} color={BrandColors.primary} />
          <Text style={styles.receiptButtonText}>Take photo</Text>
        </Pressable>
        <Pressable style={styles.receiptButton} onPress={() => onPick('library')}>
          <Images size={18} color={BrandColors.primary} />
          <Text style={styles.receiptButtonText}>
            {uris.length > 0 ? 'Add more' : 'Choose photos'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: Spacing.two,
  },
  receiptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: BrandColors.base50,
    borderRadius: 12,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    flex: 1,
  },
  receiptButtonText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 13,
    color: BrandColors.primary,
  },
  receiptChoiceRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  receiptImage: {
    width: 160,
    height: 160,
    borderRadius: 12,
    backgroundColor: BrandColors.inputField,
  },
  receiptPreview: {
    gap: Spacing.two,
    width: 160,
  },
  receiptRemove: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    alignSelf: 'flex-start',
    backgroundColor: BrandColors.error,
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  receiptRemoveText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 11,
    color: BrandColors.background,
  },
  receiptStrip: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
});
