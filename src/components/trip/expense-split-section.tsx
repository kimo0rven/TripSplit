import InlineInput from '@/components/trip/inline-input';
import ParticipantPicker from '@/components/trip/participant-picker';
import { HelperText } from '@/components/ui/card';
import { FieldLabel } from '@/components/ui/choice-chips';
import TabSlider, { TabSliderItem } from '@/components/ui/tab-slider';
import { SplitMode } from '@/types/expenses';
import { TripMember } from '@/types/trips';
import { formatMoney } from '@/utils/money';
import { percentTotal, splitText } from '@/utils/split';
import { Pressable, Text, View } from 'react-native';

import { styles } from './expense-form-styles';

/** How the bill is shared. Itemised sits with the other three because it is
 *  one more answer to the same question, not a separate switch. */
type SplitChoice = SplitMode | 'itemised';

const SPLIT_TABS: readonly TabSliderItem<SplitChoice>[] = [
  { key: 'equal', label: 'Equal' },
  { key: 'percentage', label: 'Percent' },
  { key: 'custom', label: 'Custom' },
  { key: 'itemised', label: 'Itemised' },
];

interface SplitSectionProps {
  members: TripMember[];
  currency: string;
  /** Labels the signed-in member when picking people by face. */
  currentUserId?: string;
  participants: string[];
  onToggleParticipant: (memberId: string) => void;
  onSelectAll: () => void;
  allSelected: boolean;
  splitMode: SplitMode;
  onChangeMode: (mode: SplitMode) => void;
  /** True when the bill is entered line by line, so each item picks its own sharers. */
  itemised: boolean;
  onToggleItemised: (value: boolean) => void;
  splitValues: Record<string, number>;
  /** The raw text of the box being typed in. */
  splitTexts: Record<string, string>;
  /** Rows typed into; the rest adjust on their own. */
  splitEdited: string[];
  onChangeSplitValue: (memberId: string, text: string) => void;
  /** Each member's computed share, in cents. */
  previewShares: Record<string, number>;
  /** Cents still unassigned or over the total. */
  previewLeft: number;
  onAutoBalance: () => void;
}

/**
 * "Who shares the cost?" - who owes a part of the bill, which can be a
 * different set of people from whoever paid.
 *
 * The four ways to share it live in one switcher: equal, by percent, by hand,
 * or line by line with an itemised receipt.
 */
export default function ExpenseSplitSection({
  members,
  currency,
  currentUserId,
  participants,
  onToggleParticipant,
  onSelectAll,
  allSelected,
  splitMode,
  onChangeMode,
  itemised,
  onToggleItemised,
  splitValues,
  splitTexts,
  splitEdited,
  onChangeSplitValue,
  previewShares,
  previewLeft,
  onAutoBalance,
}: SplitSectionProps) {
  const totalShares =
    Object.values(previewShares).reduce((sum, value) => sum + value, 0) + previewLeft;
  /** A member's custom amount as a percent of the bill, for context. */
  const percentOf = (id: string) =>
    totalShares > 0 ? Math.round(((previewShares[id] ?? 0) / totalShares) * 1000) / 10 : 0;

  // Percent splits are judged in percent, which is what was typed.
  const percentSum = percentTotal(participants, splitValues);
  const percentGap = Math.round((100 - percentSum) * 100) / 100;
  const off = splitMode === 'percentage' ? Math.abs(percentGap) > 0.05 : Math.abs(previewLeft) > 1;
  const summary =
    splitMode === 'percentage'
      ? off
        ? percentGap > 0
          ? `Adds up to ${percentSum}%. ${percentGap}% (${formatMoney(Math.max(previewLeft, 0) / 100, currency)}) still to give someone.`
          : `Adds up to ${percentSum}%, ${-percentGap}% too much. Lower someone’s percent.`
        : 'Adds up to 100%.'
      : off
        ? `${formatMoney(Math.abs(previewLeft) / 100, currency)} ${
            previewLeft > 0
              ? 'still to give someone'
              : 'more than the total. Lower someone’s amount.'
          }`
        : 'Adds up to the total.';

  return (
    <View style={styles.group}>
      <FieldLabel
        right={
          // Picking people one by one makes no sense on an itemised bill -
          // each line chooses its own sharers further down.
          itemised ? undefined : (
            <Pressable onPress={onSelectAll} hitSlop={8}>
              <Text style={styles.linkText}>{allSelected ? 'Clear' : 'Select all'}</Text>
            </Pressable>
          )
        }
      >
        Who shares the cost?
      </FieldLabel>

      <Text style={styles.sectionHint}>
        {itemised
          ? 'Add each item below, then choose who shared that item.'
          : 'The people who owe a part of this bill. This can be different from who paid.'}
      </Text>

      {!itemised && (
        <ParticipantPicker
          members={members}
          selectedIds={participants}
          onToggle={onToggleParticipant}
          currentUserId={currentUserId}
        />
      )}

      <TabSlider
        items={SPLIT_TABS}
        value={itemised ? 'itemised' : splitMode}
        onChange={(value) => {
          if (value === 'itemised') {
            onToggleItemised(true);
            return;
          }
          onToggleItemised(false);
          onChangeMode(value);
        }}
      />

      {!itemised && splitMode !== 'equal' && (
        <View style={styles.splitEditor}>
          <Text style={styles.sectionHint}>
            {splitMode === 'percentage'
              ? 'Type anyone’s percent. The people you haven’t typed share the rest.'
              : 'Type anyone’s amount. The people you haven’t typed share the rest.'}
          </Text>
          {members
            .filter((member) => participants.includes(member.id))
            .map((member) => (
              <View key={member.id} style={styles.splitRow}>
                {/* The name and its money share one column, so a long name
                              can never squeeze the input field into the number. */}
                <View style={styles.splitLeft}>
                  <Text style={styles.splitName} numberOfLines={1}>
                    {member.fullname}
                  </Text>
                  <Text style={styles.splitShare} numberOfLines={1}>
                    {splitMode === 'percentage'
                      ? formatMoney((previewShares[member.id] ?? 0) / 100, currency)
                      : `${percentOf(member.id)}% of the bill`}
                    {splitEdited.length > 0 && !splitEdited.includes(member.id) ? ' · adjusts' : ''}
                  </Text>
                </View>
                <View style={styles.splitInputWrap}>
                  <InlineInput
                    value={splitTexts[member.id] ?? splitText(splitValues[member.id] ?? 0)}
                    placeholder="0"
                    onChangeText={(text) => onChangeSplitValue(member.id, text)}
                  />
                  <Text style={styles.splitUnit}>
                    {splitMode === 'percentage' ? '%' : currency}
                  </Text>
                </View>
              </View>
            ))}

          <HelperText tone={off ? 'error' : 'success'}>{summary}</HelperText>

          <Pressable style={styles.splitEvenPayers} onPress={onAutoBalance}>
            <Text style={styles.splitEvenText}>Split evenly again</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
