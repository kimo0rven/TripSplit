import PrimaryButton from '@/components/Button/primary-button';
import Avatar from '@/components/ui/avatar';
import BottomSheet from '@/components/ui/bottom-sheet';
import { BrandColors, Spacing } from '@/constants/theme';
import { TripMember } from '@/types/trips';
import { formatMoney } from '@/utils/money';
import { Crown, UserMinus, UserPlus } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface TripMembersSheetProps {
  visible: boolean;
  onClose: () => void;
  members: TripMember[];
  /** Who these balances belong to, so the list can say "you". */
  currentUserId: string;
  /** Each member's net in money: positive means they are owed it. */
  balances: Record<string, number>;
  currency: string;
  isOwner: boolean;
  /** Asks to remove someone. The screen owns the "are you sure?" question. */
  onRemove: (member: TripMember) => void;
  /** Opens the invite screen. */
  onInvite: () => void;
}

/**
 * Everyone in the trip, with what each of them is owed or owes.
 *
 * The member strip on the trip screen only had room for five faces and a
 * count, so this is where the full list lives. The owner gets a remove button
 * on everyone except themselves - removing yourself is what "Leave this trip"
 * is for, and it has to hand the trip over properly.
 */
export default function TripMembersSheet({
  visible,
  onClose,
  members,
  currentUserId,
  balances,
  currency,
  isOwner,
  onRemove,
  onInvite,
}: TripMembersSheetProps) {
  return (
    <BottomSheet visible={visible} title="Members" onClose={onClose}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.hint}>
          {isOwner
            ? 'You own this trip, so you can remove anyone whose money is already settled.'
            : 'Only the trip owner can remove someone. To take yourself out, use "Leave this trip" on the trip screen.'}
        </Text>

        <View style={styles.list}>
          {members.map((member) => {
            const net = balances[member.id] ?? 0;
            const isMe = member.id === currentUserId;
            const isOwnerRow = member.role === 'owner';

            return (
              <View key={member.id} style={styles.row}>
                <Avatar name={member.fullname} size={40} photoURL={member.photoURL} />

                <View style={styles.info}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name} numberOfLines={1}>
                      {member.fullname || member.email || 'Member'}
                      {isMe ? ' (you)' : ''}
                    </Text>
                    {isOwnerRow && (
                      <View style={styles.ownerBadge}>
                        <Crown size={10} color={BrandColors.base700} />
                        <Text style={styles.ownerText}>Owner</Text>
                      </View>
                    )}
                  </View>

                  {!!member.email && (
                    <Text style={styles.email} numberOfLines={1}>
                      {member.email}
                    </Text>
                  )}

                  <Text
                    style={[
                      styles.balance,
                      net > 0 && styles.balancePositive,
                      net < 0 && styles.balanceNegative,
                    ]}
                  >
                    {Math.abs(net) < 0.01
                      ? 'Settled up'
                      : net > 0
                        ? `is owed ${formatMoney(net, currency)}`
                        : `owes ${formatMoney(-net, currency)}`}
                  </Text>
                </View>

                {/* The owner cannot remove themselves here; leaving is its own
                    flow because it hands the trip over and clears the index. */}
                {isOwner && !isOwnerRow && !isMe && (
                  <Pressable
                    style={styles.removeButton}
                    onPress={() => onRemove(member)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${member.fullname || 'this member'}`}
                  >
                    <UserMinus size={16} color={BrandColors.error} />
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>

        <PrimaryButton
          title="Invite someone"
          onPress={() => {
            onClose();
            onInvite();
          }}
          buttonColor={BrandColors.surfaceAlt}
          textColor={BrandColors.primary}
          borderColor={BrandColors.border}
          borderWidth={1}
        />

        {isOwner && (
          <View style={styles.noteRow}>
            <UserPlus size={13} color={BrandColors.secondary} />
            <Text style={styles.note}>
              Someone you remove can rejoin with the invite code, so settle up before removing them
              if that is not what you want.
            </Text>
          </View>
        )}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.three,
    paddingBottom: Spacing.four,
  },
  hint: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13,
    lineHeight: 20,
    color: BrandColors.secondary,
  },
  list: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: BrandColors.background,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 15,
    padding: Spacing.three,
  },
  info: {
    flex: 1,
    gap: Spacing.half,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  name: {
    flexShrink: 1,
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    color: BrandColors.primary,
  },
  ownerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: BrandColors.base200,
    borderRadius: 8,
    paddingHorizontal: Spacing.one,
    paddingVertical: 1,
  },
  ownerText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 10,
    color: BrandColors.base700,
  },
  email: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: BrandColors.secondary,
  },
  balance: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 11,
    color: BrandColors.secondary,
  },
  balancePositive: {
    color: BrandColors.success,
  },
  balanceNegative: {
    color: BrandColors.error,
  },
  removeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: BrandColors.errorBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  note: {
    flex: 1,
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    lineHeight: 16,
    color: BrandColors.secondary,
  },
});
