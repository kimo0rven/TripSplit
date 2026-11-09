import Avatar from '@/components/ui/avatar';
import { FieldLabel } from '@/components/ui/choice-chips';
import { BrandColors, Spacing } from '@/constants/theme';
import type { DebtEdge } from '@/types/expenses';
import { formatMoney } from '@/utils/money';
import { CheckCircle2 } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { themedStyles } from '@/constants/themed-styles';

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
  /** The amount being paid right now, as picked below. */
  amount?: number;
  /** What the payer still owes the payee, already less pending payments. */
  owed?: number;
  /** Money sent between them still waiting for the payee to confirm. */
  pending?: number;
  currency?: string;
}

/**
 * The top of Settle up, drawn like a payment slip: the amount being sent,
 * big, then who it goes from and to. The amount follows what is picked below,
 * so the slip always shows the payment exactly as it will be recorded.
 */
export function PartiesHeader({
  headline,
  payer,
  payee,
  amount = 0,
  owed = 0,
  pending = 0,
  currency = 'PHP',
}: PartiesHeaderProps) {
  if (!payee) {
    return (
      <View style={[styles.ticket, styles.settled]}>
        <CheckCircle2 size={28} color={BrandColors.success} />
        <Text style={styles.settledTitle}>{headline}</Text>
        <Text style={styles.settledText}>You are all settled up on this trip.</Text>
      </View>
    );
  }

  const kicker =
    payer?.label === 'You'
      ? 'You’re sending'
      : payee.label === 'You'
        ? 'You’re receiving'
        : `${payer?.label ?? 'Someone'} is sending`;
  const details = [
    owed > 0.005 ? `of ${formatMoney(owed, currency)} still owed` : 'nothing left owed',
    pending > 0.005 ? `${formatMoney(pending, currency)} pending` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.ticket}>
      {/* The main part: what is being sent, on the brand yellow. */}
      <View style={styles.top}>
        <View style={styles.topRow}>
          <Text style={styles.kicker}>{kicker}</Text>
          <Text style={styles.kicker}>Payment slip</Text>
        </View>
        <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>
          {formatMoney(amount, currency)}
        </Text>
        <Text style={styles.details}>{details}</Text>
      </View>

      {/* The tear line: a notch cut out of each side and a row of dashes. */}
      <View style={styles.tear}>
        <View style={[styles.notch, styles.notchLeft]} />
        <View style={styles.dashes} />
        <View style={[styles.notch, styles.notchRight]} />
      </View>

      {/* The stub: who it goes from and to, like the part you keep. */}
      <View style={styles.stub}>
        <View style={styles.bottom}>
          <Party person={payer} role="From" />
          <View style={styles.connector} />
          <Party person={payee} role="To" />
        </View>
      </View>

      {/* A scalloped bottom edge, as if torn from a roll. */}
      <View style={styles.scallops} pointerEvents="none">
        {Array.from({ length: 18 }, (_, index) => (
          <View key={index} style={styles.scallop} />
        ))}
      </View>
    </View>
  );
}

function Party({ person, role }: { person: Person | null; role: string }) {
  return (
    <View style={styles.party}>
      {person ? (
        <Avatar name={person.fullname} size={38} photoURL={person.photoURL} />
      ) : (
        <View style={styles.empty} />
      )}
      <Text style={styles.role}>{role}</Text>
      <Text style={styles.name} numberOfLines={1}>
        {person ? (person.label === 'You' ? 'You' : person.fullname) : '—'}
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
  /** Faces for each row, when known. */
  personOf?: (id: string) => Person | null;
  onPick: (debt: DebtEdge) => void;
}

/** Lets the plain "Settle up" button move between the debts you are part of. */
export function DebtSwitcher({
  debts,
  from,
  to,
  currency,
  labelOf,
  personOf,
  onPick,
}: DebtSwitcherProps) {
  return (
    <View style={styles.switcher}>
      <FieldLabel>Or settle a different debt</FieldLabel>
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
            <View style={styles.debtFaces}>
              <Avatar
                name={personOf?.(debt.from)?.fullname ?? labelOf(debt.from)}
                photoURL={personOf?.(debt.from)?.photoURL}
                size={26}
              />
              <View style={styles.debtFaceSecond}>
                <Avatar
                  name={personOf?.(debt.to)?.fullname ?? labelOf(debt.to)}
                  photoURL={personOf?.(debt.to)?.photoURL}
                  size={26}
                />
              </View>
            </View>
            <Text style={styles.debtText} numberOfLines={1}>
              {labelOf(debt.from)} → {labelOf(debt.to)}
            </Text>
            <Text style={styles.debtAmount}>{formatMoney(debt.amount, currency)}</Text>
            <View style={[styles.radio, isOn && styles.radioOn]}>
              {isOn && <View style={styles.radioDot} />}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Matches the sheet behind the slip, so the notches look cut out. */
const NOTCH = 24;
const SCALLOP = 12;

const styles = themedStyles(() => ({
  ticket: {
    borderRadius: 18,
    overflow: 'hidden',
    paddingBottom: SCALLOP / 2,
    backgroundColor: BrandColors.inputField,
  },
  top: {
    backgroundColor: BrandColors.base50,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    gap: 2,
  },
  topRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.one,
  },
  kicker: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: BrandColors.onBrand,
    opacity: 0.65,
  },
  amount: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 38,
    color: BrandColors.onBrand,
  },
  details: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: BrandColors.onBrand,
    opacity: 0.75,
    textAlign: 'center',
  },
  // The notches are the sheet's own colour, so they read as holes.
  tear: {
    flexDirection: 'row',
    alignItems: 'center',
    height: NOTCH,
    marginTop: -NOTCH / 2,
    marginBottom: -NOTCH / 2,
    zIndex: 1,
  },
  notch: {
    width: NOTCH,
    height: NOTCH,
    borderRadius: NOTCH / 2,
    backgroundColor: BrandColors.background,
  },
  notchLeft: { marginLeft: -NOTCH / 2 },
  notchRight: { marginRight: -NOTCH / 2 },
  dashes: {
    flex: 1,
    marginHorizontal: Spacing.one,
    borderTopWidth: 2,
    borderStyle: 'dashed',
    borderColor: BrandColors.background,
  },
  stub: {
    paddingTop: Spacing.three + NOTCH / 2,
    paddingBottom: Spacing.two,
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
  },
  bottom: { flexDirection: 'row', alignItems: 'flex-start' },
  party: { flex: 1, alignItems: 'center', gap: 2 },
  // A dotted line from one face to the other, level with the faces.
  connector: {
    width: 48,
    marginTop: 19,
    borderTopWidth: 2,
    borderStyle: 'dotted',
    borderColor: BrandColors.secondary,
  },
  scallops: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -SCALLOP / 2,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  scallop: {
    width: SCALLOP,
    height: SCALLOP,
    borderRadius: SCALLOP / 2,
    backgroundColor: BrandColors.background,
  },
  empty: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: BrandColors.disabled,
  },
  role: {
    marginTop: 4,
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: BrandColors.secondary,
  },
  name: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    color: BrandColors.heading,
    maxWidth: '100%',
  },
  settled: {
    alignItems: 'center',
    gap: Spacing.one,
    padding: Spacing.four,
    paddingBottom: Spacing.four,
  },
  settledTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 16,
    color: BrandColors.heading,
  },
  settledText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13,
    color: BrandColors.secondary,
  },
  switcher: {
    gap: Spacing.two,
  },
  debtRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: BrandColors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: BrandColors.border,
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  debtFaces: { flexDirection: 'row', alignItems: 'center' },
  debtFaceSecond: {
    marginLeft: -8,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: BrandColors.surfaceAlt,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: BrandColors.disabled,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: BrandColors.base50 },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: BrandColors.base50 },
  debtRowOn: { borderColor: BrandColors.base50 },
  debtText: {
    flex: 1,
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 13,
    color: BrandColors.primary,
  },
  debtAmount: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    color: BrandColors.primary,
  },
  pressed: {
    opacity: 0.7,
  },
}));
