import { BrandColors, isBrandYellow, Spacing } from '@/constants/theme';
import { Pressable, Text } from 'react-native';
import { themedStyles } from '@/constants/themed-styles';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  buttonColor: string;
  textColor: string;
  borderColor: string;
  borderWidth: number;
  disabled?: boolean;
}

export default function PrimaryButton({
  onPress,
  title,
  buttonColor,
  textColor,
  borderColor,
  borderWidth,
  disabled = false,
}: PrimaryButtonProps) {
  return (
    <Pressable
      disabled={disabled}
      style={[
        styles.button,
        { backgroundColor: buttonColor },
        { borderColor: borderColor },
        { borderWidth: borderWidth },
        disabled && styles.disabled,
      ]}
      onPress={onPress}
    >
      {/* On the brand yellow the text is always dark, in light and dark mode. */}
      <Text
        style={[
          styles.buttonText,
          { color: isBrandYellow(buttonColor) ? BrandColors.onBrand : textColor },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const styles = themedStyles(() => ({
  button: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    borderRadius: 15,
  },
  buttonText: {
    fontFamily: 'PlusJakartaSans-Bold',
    color: BrandColors.background,
    fontSize: 14,
  },
  disabled: {
    opacity: 0.6,
  },
}));
