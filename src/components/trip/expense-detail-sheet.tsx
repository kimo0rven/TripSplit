import Avatar from '@/components/ui/avatar';
import BottomSheet from '@/components/ui/bottom-sheet';
import { categoryLook } from '@/constants/expense-categories';
import { BrandColors, Spacing } from '@/constants/theme';
import { Expense } from '@/types/expenses';
import { categoryLabel } from '@/utils/balance';
import { formatDay, formatLongDay, formatMoney, formatTime, receiptsOf } from '@/utils/money';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Clock, History, Pencil } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

/** Just the fields needed to show someone in this sheet. */
interface MemberLike {
  id: string;
  fullname: string;
  photoURL?: string;
}

interface ExpenseDetailSheetProps {
  /** The expense to show, or null when the sheet is closed. */
  expense: Expense | null;
  onClose: () => void;
  members: MemberLike[];
  currency: string;
  currentUserId: string;
  /**
   * Set for anyone who may change this expense. The detail sheet is the only
   * place with an Edit button, so a person reading an expense can act on it
   * without hunting for the card's small link.
   */
  onEdit?: (expense: Expense) => void;
}

const SPLIT_LABEL: Record<string, string> = {
  equal: 'Split equally',
  percentage: 'Split by percentage',
  custom: 'Split by exact amounts',
};

/**
 * Everything one expense holds, shown when its card is tapped.
 *
 * The cards themselves stay short - title, date, amount, who paid - and the
 * detail lives here: the receipt photo, each payer's contribution, everyone's
 * share, and the note.
 */
export default function ExpenseDetailSheet({
  expense,
  onClose,
  members,
  currency,
  currentUserId,
  onEdit,
}: ExpenseDetailSheetProps) {
  const router = useRouter();
  const [viewing, setViewing] = useState<string | null>(null);

  const nameOf = (id: string) => {
    if (id === currentUserId) return 'You';
    return members.find((member) => member.id === id)?.fullname || 'Someone';
  };

  const look = categoryLook(expense?.category);
  const CategoryIcon = look.icon;

  // Only people who actually put money in, biggest first.
  const payers = Object.entries(expense?.paidBy ?? {})
    .filter(([, amount]) => Math.round(amount * 100) > 0)
    .sort((a, b) => b[1] - a[1]);

  // Only people who owe a part of it, biggest first.
  const shares = Object.entries(expense?.shares ?? {})
    .filter(([, amount]) => Math.round(amount * 100) > 0)
    .sort((a, b) => b[1] - a[1]);

  const percents = expense?.splitDetail?.input ?? {};
  const showPercent = expense?.splitMode === 'percentage';

  return (
    <BottomSheet visible={!!expense} title={expense?.title ?? ''} onClose={onClose}>
      {!!expense && (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.hero}>
            <View style={[styles.heroIcon, { backgroundColor: look.bg }]}>
              <CategoryIcon size={24} color={look.tint} />
            </View>
            <View style={styles.heroInfo}>
              <Text style={styles.heroAmount}>{formatMoney(expense.amount, currency)}</Text>
              <Text style={styles.heroMeta} numberOfLines={1}>
                {categoryLabel(expense.category)}
              </Text>
              <View style={styles.whenRow}>
                <Clock size={12} color={BrandColors.secondary} />
                <Text style={styles.heroMeta}>
                  {formatLongDay(expense.spentOn)}
                  {expense.spentTime ? ` · ${formatTime(expense.spentTime)}` : ' · no time set'}
                </Text>
              </View>
            </View>
          </View>

          {receiptsOf(expense).length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.receiptStrip}>
                {receiptsOf(expense).map((uri) => (
                  <Pressable
                    key={uri}
                    onPress={() => setViewing(uri)}
                    accessibilityRole="imagebutton"
                    accessibilityLabel="Open receipt photo"
                  >
                    <Image
                      source={{ uri }}
                      style={[
                        styles.receipt,
                        receiptsOf(expense).length === 1 ? styles.receiptSingle : null,
                      ]}
                      contentFit="cover"
                    />
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          )}

          {!!expense.items?.length && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Items</Text>
              {expense.items.map((item) => (
                <View key={item.id} style={styles.row}>
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.rowSub} numberOfLines={1}>
                      {(item.sharedBy ?? []).map((id) => nameOf(id).split(' ')[0]).join(', ')}
                    </Text>
                  </View>
                  <Text style={styles.rowAmount}>{formatMoney(item.amount, currency)}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              {payers.length === 1 ? 'Paid by' : `Paid by ${payers.length} people`}
            </Text>
            {payers.length === 0 ? (
              <Text style={styles.emptyLine}>Nobody recorded as paying this.</Text>
            ) : (
              payers.map(([id, amount]) => (
                <View key={id} style={styles.row}>
                  <Avatar
                    name={members.find((m) => m.id === id)?.fullname ?? '?'}
                    size={32}
                    photoURL={members.find((m) => m.id === id)?.photoURL}
                  />
                  <Text style={styles.rowName} numberOfLines={1}>
                    {nameOf(id)}
                  </Text>
                  <Text style={styles.rowAmount}>{formatMoney(amount, currency)}</Text>
                </View>
              ))
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{SPLIT_LABEL[expense.splitMode] ?? 'Split'}</Text>
            {shares.length === 0 ? (
              <Text style={styles.emptyLine}>No one was assigned a share.</Text>
            ) : (
              shares.map(([id, amount]) => {
                const percent = percents[id];
                return (
                  <View key={id} style={styles.row}>
                    <Avatar
                      name={members.find((m) => m.id === id)?.fullname ?? '?'}
                      size={32}
                      photoURL={members.find((m) => m.id === id)?.photoURL}
                    />
                    <View style={styles.rowInfo}>
                      <Text style={styles.rowName} numberOfLines={1}>
                        {nameOf(id)}
                      </Text>
                      {showPercent && typeof percent === 'number' && (
                        <Text style={styles.rowSub}>{percent}%</Text>
                      )}
                    </View>
                    <Text style={styles.rowAmount}>{formatMoney(amount, currency)}</Text>
                  </View>
                );
              })
            )}
          </View>

          {!!expense.notes && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Notes</Text>
              <Text style={styles.notes}>{expense.notes}</Text>
            </View>
          )}

          {/* The log itself lives on its own page: printing every entry here
              pushed the rest of the expense off the screen. */}
          {!!expense.history?.length && (
            <Pressable
              style={styles.logLink}
              onPress={() =>
                router.push({
                  pathname: '/edit-log',
                  params: {
                    title: expense.title,
                    subtitle: formatMoney(expense.amount, currency),
                    history: JSON.stringify(expense.history),
                  },
                } as any)
              }
              accessibilityRole="link"
              accessibilityLabel="Open the edit log"
            >
              <History size={15} color={BrandColors.info} />
              <Text style={styles.logLinkText}>
                Edit log ({expense.history.length}{' '}
                {expense.history.length === 1 ? 'change' : 'changes'})
              </Text>
            </Pressable>
          )}

          {!!onEdit && (
            <Pressable
              style={styles.editButton}
              onPress={() => {
                const target = expense;
                onClose();
                onEdit(target);
              }}
              accessibilityRole="button"
              accessibilityLabel="Edit this expense"
            >
              <Pencil size={15} color={BrandColors.primary} />
              <Text style={styles.editText}>Edit expense</Text>
            </Pressable>
          )}

          <Text style={styles.footNote}>
            Added by {nameOf(expense.createdBy)} · {formatDay(expense.createdAt.slice(0, 10))}
          </Text>
        </ScrollView>
      )}

      <Modal
        visible={!!viewing}
        transparent
        animationType="fade"
        onRequestClose={() => setViewing(null)}
        statusBarTranslucent
      >
        <Pressable style={styles.viewer} onPress={() => setViewing(null)}>
          {!!viewing && (
            <Image source={{ uri: viewing }} style={styles.viewerImage} contentFit="contain" />
          )}
          <Text style={styles.viewerClose}>Close</Text>
        </Pressable>
      </Modal>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.three,
    paddingBottom: Spacing.four,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInfo: {
    flex: 1,
    gap: 2,
  },
  heroAmount: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 26,
    color: BrandColors.primary,
  },
  heroMeta: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: BrandColors.secondary,
  },
  whenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: 1,
  },
  viewer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerImage: {
    width: '100%',
    height: '85%',
  },
  viewerClose: {
    position: 'absolute',
    top: 56,
    right: 24,
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 15,
    color: '#FFFFFF',
  },
  receiptStrip: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  receiptSingle: {
    width: 320,
  },
  receipt: {
    width: 220,
    height: 180,
    borderRadius: 15,
    backgroundColor: BrandColors.inputField,
  },
  section: {
    gap: Spacing.two,
  },
  sectionLabel: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: BrandColors.secondary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: BrandColors.background,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 12,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  rowInfo: {
    flex: 1,
    gap: 1,
  },
  rowName: {
    flex: 1,
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 13,
    color: BrandColors.primary,
  },
  rowSub: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    color: BrandColors.secondary,
  },
  rowAmount: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    color: BrandColors.primary,
  },
  emptyLine: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: BrandColors.secondary,
  },
  notes: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13,
    lineHeight: 20,
    color: BrandColors.primary,
  },
  logLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  logLinkText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 13,
    color: BrandColors.info,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: 12,
    backgroundColor: BrandColors.base50,
  },
  editText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    color: BrandColors.primary,
  },
  footNote: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    color: BrandColors.secondary,
    textAlign: 'center',
  },
});
