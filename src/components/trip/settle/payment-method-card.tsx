import RatesCredit from '@/components/ui/rates-credit';
import TabSlider from '@/components/ui/tab-slider';
import { BrandColors, Spacing } from '@/constants/theme';
import type { PayMongoCheckoutState } from '@/hooks/use-paymongo-checkout';
import { formatMoney } from '@/utils/money';
import { CreditCard, Wallet } from 'lucide-react-native';
import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { themedStyles } from '@/constants/themed-styles';

/**
 * How the money moves, as tabs: cash in hand, a transfer to one of the
 * payee's own accounts (their "How to pay me"), or paying online through
 * PayMongo, which only the payer can do on their own phone.
 */
export type MethodKey = 'cash' | 'transfer' | 'online';

const CASH_TAB = { key: 'cash' as MethodKey, label: 'Cash' };
const TRANSFER_TAB = { key: 'transfer' as MethodKey, label: 'Transfer' };
const ONLINE_TAB = { key: 'online' as MethodKey, label: 'Pay online' };

interface PaymentMethodCardProps {
  method: MethodKey;
  onMethod: (method: MethodKey) => void;
  /** True when paying through PayMongo right now. */
  payOnline: boolean;
  /** Whether "Pay online" is offered: PayMongo is on and you are the payer. */
  onlineAvailable: boolean;
  /** The payee's accounts, shown under Transfer. */
  accounts?: ReactNode;
  /** "Kim", or "you": who is being paid. */
  payeeLabel: string;
  /** Editing a payment that was already made. */
  editing: boolean;
  payerLabel: string;
  amount: number;
  currency: string;
  checkout: PayMongoCheckoutState;
  /** The name of whoever an unfinished checkout was paying. */
  pendingPayee: string;
}

/**
 * How the money moves. Its own card, so it stands apart from the plain fields
 * around it. With Other picked, it explains the PayMongo checkout the Pay
 * button opens, and any checkout still waiting from before.
 */
export function PaymentMethodCard({
  method,
  onMethod,
  payOnline,
  onlineAvailable,
  editing,
  payerLabel,
  amount,
  currency,
  checkout,
  pendingPayee,
  accounts,
  payeeLabel,
}: PaymentMethodCardProps) {
  const tabs = onlineAvailable ? [CASH_TAB, TRANSFER_TAB, ONLINE_TAB] : [CASH_TAB, TRANSFER_TAB];
  const payerIsYou = payerLabel === 'You';
  const pesos =
    currency !== 'PHP' && checkout.pesoRate && amount > 0
      ? Math.round(amount * checkout.pesoRate * 100) / 100
      : null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.badge}>
          <Wallet size={18} color={BrandColors.onBrand} strokeWidth={2.2} />
        </View>
        <View style={styles.heading}>
          <Text style={styles.title}>Payment method</Text>
          <Text style={styles.subtitle}>How is this being paid?</Text>
        </View>
      </View>

      <TabSlider items={tabs} value={method} onChange={onMethod} />

      {method === 'transfer' ? (
        <>
          <Text style={styles.note}>
            {editing
              ? `Which of ${payeeLabel === 'you' ? 'your' : `${payeeLabel}’s`} accounts it went to.`
              : payerIsYou
                ? `Send it to one of ${payeeLabel}’s accounts, pick the one you used, and add a screenshot below as proof.`
                : `Pick which of ${payeeLabel === 'you' ? 'your' : `${payeeLabel}’s`} accounts ${payerLabel} sent it to.`}
          </Text>
          {accounts}
        </>
      ) : !payOnline ? (
        <Text style={styles.note}>
          Handed over in person. Tap Record payment once the cash has changed hands.
        </Text>
      ) : !checkout.ready ? (
        <Pressable
          style={({ pressed }) => [
            styles.panel,
            pressed && !!checkout.setupError && styles.pressed,
          ]}
          onPress={() => checkout.setupError && checkout.retrySetup()}
          disabled={!checkout.setupError}
          accessibilityRole="button"
          accessibilityLabel={`PayMongo unavailable. ${checkout.blocked}`}
        >
          {checkout.loading ? (
            <ActivityIndicator size="small" color={BrandColors.secondary} />
          ) : (
            <CreditCard size={18} color={BrandColors.secondary} />
          )}
          <Text style={styles.panelText}>{checkout.blocked}</Text>
          {!!checkout.setupError && <Text style={styles.panelAction}>Retry</Text>}
        </Pressable>
      ) : (
        <View style={styles.panel}>
          {checkout.busy ? (
            <ActivityIndicator size="small" color={BrandColors.primary} />
          ) : (
            <CreditCard size={18} color={BrandColors.primary} />
          )}
          <View style={styles.panelBody}>
            <Text style={styles.panelText}>
              {checkout.stage === 'checkout'
                ? 'Finish paying on the PayMongo page.'
                : checkout.stage === 'confirming'
                  ? 'Checking with PayMongo. This takes a few seconds.'
                  : checkout.pending
                    ? `Your ${formatMoney(checkout.pending.amount, currency)} payment to ${pendingPayee} is waiting for PayMongo. Tap Check payment.`
                    : `Tap Pay to open PayMongo and pay with ${checkout.methodsLine}. It is recorded with its PayMongo receipt.`}
            </Text>
            {pesos !== null && !checkout.pending && !checkout.busy && (
              <>
                <Text style={styles.charge}>
                  About {formatMoney(pesos, 'PHP')} will be charged at today&apos;s rate.
                </Text>
                <RatesCredit />
              </>
            )}
            {checkout.pending && !checkout.busy && (
              <Pressable onPress={checkout.clearPending} accessibilityRole="button" hitSlop={8}>
                <Text style={styles.reset}>Start a new payment instead</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = themedStyles(() => ({
  card: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: BrandColors.base50,
    backgroundColor: BrandColors.warningBg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BrandColors.base50,
  },
  heading: {
    flex: 1,
    gap: 1,
  },
  title: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 15,
    color: BrandColors.heading,
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: BrandColors.secondary,
  },
  note: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 17,
    color: BrandColors.primary,
  },
  panel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: BrandColors.background,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  panelBody: {
    flex: 1,
    gap: Spacing.one,
  },
  panelText: {
    flex: 1,
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    lineHeight: 17,
    color: BrandColors.primary,
  },
  charge: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 12,
    color: BrandColors.heading,
  },
  panelAction: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    color: BrandColors.heading,
  },
  reset: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 12,
    color: BrandColors.secondary,
    textDecorationLine: 'underline',
  },
  pressed: {
    opacity: 0.7,
  },
}));
