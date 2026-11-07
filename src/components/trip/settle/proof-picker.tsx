import { FieldLabel } from '@/components/ui/choice-chips';
import { BrandColors, Spacing } from '@/constants/theme';
import { pickImage, takePhoto } from '@/utils/imagePicker';
import { Image } from 'expo-image';
import { Camera, Images, Trash2 } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface ProofPickerProps {
  uris: string[];
  onChange: (uris: string[]) => void;
  onError: (message: string) => void;
}

/** Photos of a cash handover or transfer, taken or picked. */
export function ProofPicker({ uris, onChange, onError }: ProofPickerProps) {
  const pick = async (source: 'camera' | 'library') => {
    try {
      const result =
        source === 'camera'
          ? await takePhoto({ quality: 0.7 })
          : await pickImage({ includeBase64: false, quality: 0.7 });
      if (result.denied) {
        onError(
          source === 'camera'
            ? 'Camera access is off. Turn it on in your phone settings.'
            : 'Photo access is off. Turn it on in your phone settings.',
        );
        return;
      }
      const uri = result.asset?.uri;
      if (uri) onChange([...uris, uri]);
    } catch (err) {
      console.error('Failed to pick a proof photo:', err);
      onError('Could not open your camera or photos.');
    }
  };

  return (
    <View style={styles.group}>
      <FieldLabel>Proof of payment (optional)</FieldLabel>
      {uris.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.strip}>
            {uris.map((uri, index) => (
              <View key={uri + index} style={styles.item}>
                <Image source={{ uri }} style={styles.image} contentFit="cover" />
                <Pressable
                  style={styles.remove}
                  onPress={() => onChange(uris.filter((_, i) => i !== index))}
                  accessibilityLabel="Remove photo"
                >
                  <Trash2 size={14} color={BrandColors.background} />
                </Pressable>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
      <View style={styles.row}>
        <Pressable style={styles.button} onPress={() => pick('camera')}>
          <Camera size={16} color={BrandColors.primary} />
          <Text style={styles.buttonText}>Take photo</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={() => pick('library')}>
          <Images size={16} color={BrandColors.primary} />
          <Text style={styles.buttonText}>{uris.length > 0 ? 'Add another' : 'Choose photo'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: Spacing.two },
  strip: { flexDirection: 'row', gap: Spacing.two },
  item: { width: 96, height: 96 },
  image: {
    width: 96,
    height: 96,
    borderRadius: 12,
    backgroundColor: BrandColors.inputField,
  },
  remove: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: BrandColors.error,
    borderRadius: 8,
    padding: 5,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 20,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  buttonText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: BrandColors.secondary,
  },
});
