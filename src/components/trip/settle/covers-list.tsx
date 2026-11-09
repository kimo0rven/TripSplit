import { BrandColors, Spacing } from '@/constants/theme';
import { formatDay, formatMoney } from '@/utils/money';
import type { CoveredShare } from '@/utils/coverage';
import { Receipt } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { themedStyles } from '@/constants/themed-styles';

interface CoversListProps {
  title: string;
  /** Who the shares belong to, for the "of X's share" line: "your" or "Ana's". */
  owner: string;
  items: CoveredShare[];
  currency: string;
  /** Shown when the payment pays for no expense share. */
  empty?: string;
}

/** Rows shown before the rest are counted as "and N more". */
const MAX_ROWS = 6;

/**
 * The expenses a payment pays for. Debts are simplified, so the person paid is
 * not always the one who paid the bill: this shows the payer's own shares the
 * money goes to, oldest first.
 */
export function CoversList({ title, owner, items, currency, empty }: CoversListProps) {
  if (!items.length && !empty) return null;
  const shown = items.slice(0, MAX_ROWS);
  const more = items.length - shown.length;
  const money = (value: number) => formatMoney(value, currency);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {items.length === 0 ? (
        <Text style={styles.empty}>{empty}</Text>
      ) : (
        <View style={styles.card}>
          {shown.map((item, index) => {
            const part = item.covered < item.share - 0.004;
            return (
              <View
                key={item.expenseId}
                style={[styles.row, index > 0 && styles.rowBorder]}
                accessible
                accessibilityLabel={`${item.title}, ${formatDay(item.spentOn)}: ${money(item.covered)}${
                  part ? ` of ${owner} ${money(item.share)} share` : ', whole share'
                }`}
              >
                <View style={styles.icon}>
                  <Receipt size={14} color={BrandColors.secondary} />
                </View>
                <View style={styles.text}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {formatDay(item.spentOn)} ·{' '}
                    {part
                      ? `part of ${owner} ${money(item.share)} share`
                      : `${owner} share, paid in full`}
                  </Text>
                </View>
                <Text style={styles.amount}>{money(item.covered)}</Text>
              </View>
            );
          })}
          {more > 0 && (
            <Text style={styles.more}>
              and {more} more {more === 1 ? 'expense' : 'expenses'}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = themedStyles(() => ({
  wrap: { gap: Spacing.two },
  title: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: BrandColors.primary },
  empty: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 12, color: BrandColors.secondary },
  card: {
    backgroundColor: BrandColors.inputField,
    borderRadius: 15,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BrandColors.border },
  icon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BrandColors.background,
  },
  text: { flex: 1, gap: 2 },
  name: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: BrandColors.primary },
  meta: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 12, color: BrandColors.secondary },
  amount: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: BrandColors.primary },
  more: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: BrandColors.secondary,
    paddingVertical: Spacing.two,
  },
}));
