import { BrandColors, Spacing } from '@/constants/theme';
import { StyleSheet } from 'react-native';

/**
 * Styles shared by the expense form and the two sections pulled out of it
 * (who paid, who shares the cost). Kept in one place so the three files
 * cannot drift apart.
 */
export const styles = StyleSheet.create({
  scroll: { gap: Spacing.four, paddingBottom: Spacing.four },
  repeatHint: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 12, color: BrandColors.secondary },
  itemTotal: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 22, color: BrandColors.primary },
  group: {
    gap: Spacing.two,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: BrandColors.surfaceAlt,
    borderRadius: 12,
    padding: Spacing.three,
  },
  switchTextWrap: {
    flex: 1,
    gap: 2,
  },
  switchLabel: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    color: BrandColors.primary,
  },
  switchHint: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    color: BrandColors.secondary,
  },
  sectionHint: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: BrandColors.secondary,
  },
  payerList: {
    gap: Spacing.two,
  },
  payerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 12,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  payerName: {
    flex: 1,
    minWidth: 0,
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 13,
    color: BrandColors.primary,
  },
  payerInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 8,
    backgroundColor: BrandColors.surfaceAlt,
    width: 120,
    flexShrink: 0,
  },
  payerCurrency: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    color: BrandColors.secondary,
    paddingLeft: 6,
    flexShrink: 0,
  },
  splitEvenPayers: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.one,
  },
  splitEvenText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: BrandColors.info,
  },
  linkText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: BrandColors.info,
  },
  moreLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginBottom: 6,
  },
  /** The chosen category when it is not one of the five everyday chips. */
  fullCategory: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    alignSelf: 'flex-start',
    borderRadius: 20,
    backgroundColor: BrandColors.surfaceAlt,
    paddingLeft: Spacing.two,
    paddingRight: Spacing.three,
    paddingVertical: Spacing.one,
  },
  fullCategoryIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullCategoryText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    color: BrandColors.primary,
  },
  splitEditor: {
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 12,
    padding: Spacing.three,
    backgroundColor: BrandColors.surfaceAlt,
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  splitLeft: {
    flex: 1,
    // minWidth lets this column shrink inside the row. Without it the text
    // box keeps its full width and draws over the input beside it.
    minWidth: 0,
    gap: 2,
  },
  splitName: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 13,
    color: BrandColors.primary,
  },
  splitInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 8,
    backgroundColor: BrandColors.background,
    width: 112,
    flexShrink: 0,
  },
  splitUnit: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    color: BrandColors.secondary,
    paddingRight: 6,
    flexShrink: 0,
  },
  splitShare: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: BrandColors.secondary,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: BrandColors.infoBg,
    borderRadius: 12,
    padding: Spacing.three,
  },
  summaryText: {
    flex: 1,
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: BrandColors.primary,
  },
});
