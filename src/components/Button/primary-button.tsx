import { BrandColors, Spacing } from '@/constants/theme';
import { Pressable, StyleSheet, Text } from 'react-native';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  buttonColor: string;
  textColor: string;
  borderColor: string;
  borderWidth: number;
}

export default function PrimaryButton({ 
  onPress, 
  title, 
  buttonColor, 
  textColor, 
  borderColor, 
  borderWidth }
  : PrimaryButtonProps) {
  return (
    <Pressable style={[styles.button, { backgroundColor: buttonColor }, { borderColor: borderColor }, { borderWidth: borderWidth }]} onPress={onPress}>
      <Text style={[styles.buttonText, { color: textColor }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    fontFamily: 'PlusJakartaSans-Regular',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    borderRadius: 15,
  },
  buttonText: {
    color: BrandColors.background,
    fontSize: 14,
    fontWeight: 'bold',
  },
});