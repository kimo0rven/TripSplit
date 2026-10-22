import SquareButton from '@/components/Button/square-button';
import { BrandColors, Spacing } from '@/constants/theme';
import { quickactions } from '@/constants/quickactions';
import { StyleSheet, Text, View } from 'react-native';

/** The row of round shortcut buttons: add expense, settle up, scan receipt, invite. */
export default function QuickActions({ handlers }: { handlers: Record<string, () => void> }) {
  return (
    <View style={styles.homescreenButtonsContainer}>
      {quickactions.map((action) => (
        <View key={action.id} style={styles.actionItem}>
          <SquareButton
            title={<action.Icon color={BrandColors.primary} size={22} />}
            buttonColor={action.btnColor}
            textColor={BrandColors.primary}
            borderColor="transparent"
            borderWidth={0}
            onPress={handlers[action.id]}
          />
          <Text style={styles.actionLabel}>{action.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  homescreenButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: Spacing.one,
  },
  actionItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  actionLabel: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    textAlign: 'center',
    color: BrandColors.primary,
  },
});
