import { BrandColors, Spacing } from '@/constants/theme';
import { Check, Circle } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface Step {
  label: string;
  done: boolean;
  onPress: () => void;
}

/** A short checklist for new users; hides itself once every step is done. */
export default function GettingStarted({ steps }: { steps: Step[] }) {
  if (steps.every((step) => step.done)) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Getting started</Text>
      {steps.map((step) => (
        <Pressable
          key={step.label}
          style={styles.row}
          onPress={step.onPress}
          disabled={step.done}
          accessibilityRole="button"
        >
          {step.done ? (
            <Check size={18} color={BrandColors.success} />
          ) : (
            <Circle size={18} color={BrandColors.secondary} />
          )}
          <Text style={[styles.text, step.done && styles.done]}>{step.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: BrandColors.background,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  title: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: BrandColors.primary },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  text: { fontFamily: 'PlusJakartaSans-Medium', fontSize: 13, color: BrandColors.primary },
  done: { color: BrandColors.secondary, textDecorationLine: 'line-through' },
});
