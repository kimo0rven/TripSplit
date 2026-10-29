import InlineInput from '@/components/trip/inline-input';
import ParticipantPicker from '@/components/trip/participant-picker';
import Avatar from '@/components/ui/avatar';
import { HelperText } from '@/components/ui/card';
import { FieldLabel } from '@/components/ui/choice-chips';
import { BrandColors } from '@/constants/theme';
import { TripMember } from '@/types/trips';
import { formatMoney } from '@/utils/money';
import { Users } from 'lucide-react-native';
import { Pressable, Switch, Text, View } from 'react-native';

import { styles } from './expense-form-styles';

interface PayerSectionProps {
  members: TripMember[];
  currency: string;
  currentUserId: string;
  multiplePayers: boolean;
  onToggleMultiple: (value: boolean) => void;
  payerAmounts: Record<string, string>;
  onChangePayerAmount: (memberId: string, text: string) => void;
  soloPayerId: string;
  onPickSoloPayer: (memberId: string) => void;
  /** Total already entered across every payer, in currency units. */
  paidPreviewTotal: number;
  /** The bill's total, in currency units. */
  totalAmount: number;
  onSplitEvenly: () => void;
  nameOf: (id: string) => string;
}

/**
 * "Who paid?" - the money going out.
 *
 * Deliberately worded and laid out differently from the "who shares the cost"
 * section below it, because the two ask about different people and used to be
 * mistaken for the same question.
 */
export default function PayerSection({
  members,
  currency,
  currentUserId,
  multiplePayers,
  onToggleMultiple,
  payerAmounts,
  onChangePayerAmount,
  soloPayerId,
  onPickSoloPayer,
  paidPreviewTotal,
  totalAmount,
  onSplitEvenly,
  nameOf,
}: PayerSectionProps) {
  return (
    <View style={styles.group}>
      <FieldLabel>Who paid?</FieldLabel>
      <Text style={styles.sectionHint}>
        The money left someone's pocket. If one person covered the whole bill, leave the switch off.
      </Text>

      <View style={styles.switchRow}>
        <View style={styles.switchTextWrap}>
          <Text style={styles.switchLabel}>More than one person paid</Text>
          <Text style={styles.switchHint}>
            Turn this on when two or more of you chipped in for the same bill.
          </Text>
        </View>
        <Switch
          value={multiplePayers}
          onValueChange={onToggleMultiple}
          trackColor={{ false: BrandColors.border, true: BrandColors.base400 }}
          thumbColor={multiplePayers ? BrandColors.base50 : BrandColors.background}
          {...({ activeThumbColor: BrandColors.base50 } as object)}
        />
      </View>

      {multiplePayers ? (
        <View style={styles.payerList}>
          {members.map((member) => (
            <View key={member.id} style={styles.payerRow}>
              <Avatar name={member.fullname} size={32} photoURL={member.photoURL} />
              <Text style={styles.payerName} numberOfLines={1}>
                {member.fullname}
              </Text>
              <View style={styles.payerInput}>
                <Text style={styles.payerCurrency}>{currency}</Text>
                <InlineInput
                  value={payerAmounts[member.id] ?? ''}
                  placeholder="0.00"
                  onChangeText={(text) => onChangePayerAmount(member.id, text)}
                />
              </View>
            </View>
          ))}
          <Pressable style={styles.splitEvenPayers} onPress={onSplitEvenly}>
            <Users size={14} color={BrandColors.info} />
            <Text style={styles.splitEvenText}>Split the total evenly between everyone</Text>
          </Pressable>
          <HelperText tone={Math.abs(paidPreviewTotal - totalAmount) > 0.01 ? 'error' : 'success'}>
            Paid so far {formatMoney(paidPreviewTotal, currency)} of{' '}
            {formatMoney(totalAmount, currency)}
          </HelperText>
        </View>
      ) : (
        <View style={styles.payerList}>
          <ParticipantPicker
            members={members}
            selectedIds={[soloPayerId]}
            onToggle={onPickSoloPayer}
            currentUserId={currentUserId}
          />
          <HelperText>{nameOf(soloPayerId)} paid the whole bill.</HelperText>
        </View>
      )}
    </View>
  );
}
