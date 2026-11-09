import { BrandColors } from '@/constants/theme';
import { TextInput } from 'react-native';
import { themedStyles } from '@/constants/themed-styles';

/** A small bordered-free input used inside rows: numbers by default, or plain text. */
export default function TextInputInline({
  value,
  onChangeText,
  placeholder,
  text,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  text?: boolean;
}) {
  return (
    <TextInput
      style={[inlineStyles.input, text && { textAlign: 'left' }]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={BrandColors.secondary}
      keyboardType={text ? 'default' : 'decimal-pad'}
    />
  );
}

const inlineStyles = themedStyles(() => ({
  input: {
    flex: 1,
    // Without minWidth a web text box refuses to shrink below its default
    // size, so long numbers spill out over the % or currency sign.
    minWidth: 0,
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 14,
    color: BrandColors.primary,
    textAlign: 'right',
    fontFamily: 'PlusJakartaSans-Medium',
  },
}));
