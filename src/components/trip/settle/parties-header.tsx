import Avatar from '@/components/ui/avatar';
import { FieldLabel } from '@/components/ui/choice-chips';
import { BrandColors, Spacing } from '@/constants/theme';
import type { DebtEdge } from '@/types/expenses';
import { formatMoney } from '@/utils/money';
import { ArrowRight } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface Person {
  id: string;
  /** "You" for the signed-in person, else their first name. */
  label: string;
  fullname: string;
  photoURL?: string;
}

interface PartiesHeaderProps {
  headline: string;
  payer: Person | null;
  payee: Person | null;
}

/** "You are paying Ana", then both faces with an arrow from payer to payee. */
export function PartiesHeader({ headline, payer, payee }: PartiesHeaderProps) {
  return (
    <>
      <Text style={styles.headline}>{headline}</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Party person={payer} />
          <View style={styles.arrow}>
            <ArrowRight size={20} color={BrandColors.primary} strokeWidth={2.4} />
          </View>
          <Party person={payee} />
        </View>
        {!payee && <Text style={styles.subline}>You are all settled up on this trip.</Text>}
      </View>
    </>
  );
}

function Party({ person }: { person: Person | null }) {
  return (
    <View style={styles.party}>
      {person ? (
        <Avatar name={person.fullname} size={52} photoURL={person.photoURL} />
      ) : (
        <View style={styles.empty} />
      )}
      <Text style={styles.name} numberOfLines={1}>
        {person ? person.label : '—'}
      </Text>
    </View>
  );
}

interface DebtSwitcherProps {
  debts: DebtEdge[];
  from: string;
  to: string;
  currency: string;
  labelOf: (id: string) => string;
  onPick: (debt: DebtEdge) => void;
}

/** Lets the plain "Settle up" button move between the debts you are part of. */
export function DebtSwitcher({ debts, from, to, currency, labelOf, onPick }: DebtSwitcherProps) {
  return (
    <View style={styles.switcher}>
      <FieldLabel>Settle a different debt</FieldLabel>
      {debts.map((debt) => {
        const isOn = debt.from === from && debt.to === to;
        return (
          <Pressable
            key={`${debt.from}-${debt.to}`}
            style={({ pressed }) => [
              styles.debtRow,
              isOn && styles.debtRowOn,
              pressed && styles.pressed,
            ]}
            onPress={() => onPick(debt)}
            accessibilityRole="button"
            accessibilityState={{ selected: isOn }}
          >
            <Text style={styles.debtText}>
              {labelOf(debt.from)} → {labelOf(debt.to)}
            </Text>
            <Text style={styles.debtAmount}>{formatMoney(debt.amount, currency)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  headline: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 18,
    color: BrandColors.heading,
    textAlign: 'center',
  },
  card: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: 16,
    backgroundColor: BrandColors.surfaceAlt,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
  },
  party: {
    alignItems: 'center',
    gap: 2,
    width: 96,
  },
  empty: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: BrandColors.disabled,
  },
  name: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    color: BrandColors.heading,
    marginTop: 4,
  },
  arrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BrandColors.base50,
  },
  subline: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 13,
    color: BrandColors.secondary,
    textAlign: 'center',
  },
  switcher: {
    gap: Spacing.two,
  },
  debtRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: BrandColors.surfaceAlt,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  debtRowOn: {
    borderWidth: 1.5,
    borderColor: BrandColors.base50,
    backgroundColor: BrandColors.base200,
  },
  debtText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: BrandColors.primary,
  },
  debtAmount: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 12,
    color: BrandColors.primary,
  },
  pressed: {
    opacity: 0.7,
  },
});
