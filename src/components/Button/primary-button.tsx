import { BrandColors, Spacing } from '@/constants/theme';
import { Pressable, StyleSheet, Text } from 'react-native';

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
  disabled = false }
  : PrimaryButtonProps) {
  return (
    <Pressable disabled={disabled} style={[styles.button, { backgroundColor: buttonColor }, { borderColor: borderColor }, { borderWidth: borderWidth }, disabled && styles.disabled]} onPress={onPress}>
      <Text style={[styles.buttonText, { color: textColor }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
    fontWeight: 'bold',
  },
  disabled: {
    opacity: 0.6,
  },
});