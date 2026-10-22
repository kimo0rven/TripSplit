import InlineInput from '@/components/trip/inline-input';
import { HelperText } from '@/components/ui/card';
import { FieldLabel } from '@/components/ui/choice-chips';
import { BrandColors, Spacing } from '@/constants/theme';
import { TripMember } from '@/types/trips';
import { formatMoney } from '@/utils/money';
import { Plus, X } from 'lucide-react-native';
import { Dispatch, SetStateAction } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export interface DraftItem {
  id: string;
  name: string;
  amount: string;
  sharedBy: string[];
}

interface ItemisedEditorProps {
  items: DraftItem[];
  setItems: Dispatch<SetStateAction<DraftItem[]>>;
  members: TripMember[];
  allIds: string[];
  currency: string;
  /** memberId -> cents each person owes from the items. */
  itemShares: Record<string, number>;
  nameOf: (id: string) => string;
  updateItem: (id: string, patch: Partial<Omit<DraftItem, 'id'>>) => void;
}

/** One card per receipt line: its name, price, and who shared it. */
export default function ItemisedEditor({
  items,
  setItems,
  members,
  allIds,
  currency,
  itemShares,
  nameOf,
  updateItem,
}: ItemisedEditorProps) {
  return (
    <View style={styles.group}>
      <FieldLabel>Items</FieldLabel>
      {items.map((item) => (
        <View key={item.id} style={styles.itemCard}>
          <View style={styles.itemTop}>
            <View style={styles.itemName}>
              <InlineInput
                value={item.name}
                placeholder="Item name"
                text
                onChangeText={(text) => updateItem(item.id, { name: text })}
              />
            </View>
            <View style={styles.payerInput}>
              <Text style={styles.payerCurrency}>{currency}</Text>
              <InlineInput
                value={item.amount}
                placeholder="0.00"
                onChangeText={(text) => updateItem(item.id, { amount: text })}
              />
            </View>
            <Pressable
              onPress={() => setItems((previous) => previous.filter((i) => i.id !== item.id))}
              hitSlop={8}
              accessibilityLabel="Remove item"
            >
              <X size={18} color={BrandColors.secondary} />
            </Pressable>
          </View>
          <View style={styles.participantGrid}>
            {members.map((member) => {
              const on = item.sharedBy.includes(member.id);
              return (
                <Pressable
                  key={member.id}
                  style={[styles.participant, on && styles.participantOn]}
                  onPress={() =>
                    updateItem(item.id, {
                      sharedBy: on
                        ? item.sharedBy.filter((id) => id !== member.id)
                        : [...item.sharedBy, member.id],
                    })
                  }
                >
                  <Text
                    style={[styles.participantName, on && styles.participantNameOn]}
                    numberOfLines={1}
                  >
                    {member.fullname.split(' ')[0]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
      <Pressable
        style={styles.splitEvenPayers}
        onPress={() =>
          setItems((previous) => [
            ...previous,
            {
              id: Math.random().toString(36).slice(2, 10),
              name: '',
              amount: '',
              sharedBy: [...allIds],
            },
          ])
        }
      >
        <Plus size={14} color={BrandColors.info} />
        <Text style={styles.splitEvenText}>Add item</Text>
      </Pressable>
      <HelperText>
        {Object.entries(itemShares)
          .map(([id, value]) => nameOf(id).split(' ')[0] + ' ' + formatMoney(value / 100, currency))
          .join(' · ') || 'Each person pays for the items they shared.'}
      </HelperText>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: Spacing.two,
  },
  itemCard: {
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 14,
    padding: Spacing.two,
  },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  itemName: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 8,
    backgroundColor: BrandColors.surfaceAlt,
  },
  participant: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BrandColors.border,
    maxWidth: '48%',
  },
  participantGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  participantName: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: BrandColors.secondary,
  },
  participantNameOn: {
    color: BrandColors.primary,
    fontFamily: 'PlusJakartaSans-Bold',
  },
  participantOn: {
    borderColor: BrandColors.base50,
    backgroundColor: BrandColors.base200,
  },
  payerCurrency: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    color: BrandColors.secondary,
    paddingLeft: 6,
    flexShrink: 0,
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
});
