import SquareButton from '@/components/Button/square-button';
import { BrandColors, isBrandYellow, Spacing } from '@/constants/theme';
import { quickactions } from '@/constants/quickactions';
import { Text, View } from 'react-native';
import { themedStyles } from '@/constants/themed-styles';

/** The row of round shortcut buttons: expense, settle up, receipt, note, invite. */
export default function QuickActions({ handlers }: { handlers: Record<string, () => void> }) {
  return (
    <View style={styles.homescreenButtonsContainer}>
      {quickactions.map((action) => (
        <View key={action.id} style={styles.actionItem}>
          <SquareButton
            title={
              <action.Icon
                color={isBrandYellow(action.btnColor) ? BrandColors.onBrand : BrandColors.primary}
                size={22}
              />
            }
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

const styles = themedStyles(() => ({
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
}));
