import { BrandColors, Spacing } from '@/constants/theme';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

export interface Currency {
  name: string;
  value: string;
}

interface BigButtonOptionsProps {
  choices: Currency[];
  selectedValue?: string;
  onSelect: (currency: Currency) => void;
  maxHeight?: number;
}

export default function BigButtonOptions({
  choices,
  selectedValue,
  onSelect,
  maxHeight = 280,
}: BigButtonOptionsProps) {
  return (
    <ScrollView
      style={[styles.scrollContainer, { maxHeight }]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled={true}
    >
      {choices.map((choice) => {
        const isSelected = choice.value === selectedValue;

        return (
          <Pressable
            key={choice.value}
            style={[
              styles.optionButton,
              isSelected && styles.selectedOptionButton,
            ]}
            onPress={() => onSelect(choice)}
          >
            <Text style={[styles.optionText, isSelected && styles.selectedOptionText]}>
              {choice.name} ({choice.value})
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    width: '100%',
  },
  contentContainer: {
    gap: Spacing.two,
  },
  optionButton: {
    padding: Spacing.three,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BrandColors.base50,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  selectedOptionButton: {
    backgroundColor: BrandColors.base50,
  },
  optionText: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 16,
    color: BrandColors.primary,
  },
  selectedOptionText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});