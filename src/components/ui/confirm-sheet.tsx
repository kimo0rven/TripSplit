import { BrandColors, Spacing } from '@/constants/theme';
import { LogOut, Trash2, UserMinus } from 'lucide-react-native';
import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import BottomSheet from './bottom-sheet';

/** The small red badge at the top of the sheet, chosen to match the action. */
export type ConfirmIcon = 'delete' | 'remove' | 'leave';

interface ConfirmSheetProps {
  visible: boolean;
  /** The question, kept short so it fits the sheet's header in one line. */
  title: string;
  /** What will happen, in plain words. */
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  icon?: ConfirmIcon;
  /** Shows a spinner on the red button and blocks a second tap. */
  busy?: boolean;
  /** Extra content under the message, such as an error from a failed try. */
  children?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

const ICONS = {
  delete: Trash2,
  remove: UserMinus,
  leave: LogOut,
} as const;

/**
 * A "are you sure?" question that slides up from the bottom.
 *
 * This replaces the box that used to appear in the middle of the screen. On a
 * phone the middle of the screen is where the content you are reading lives,
 * and a panel that slides up from the bottom sits next to your thumb instead -
 * out of the way of what you were looking at, and easy to reach.
 *
 * It is built on the same sheet as every form in the app, so a destructive
 * question looks and moves like the rest of the app rather than like a system
 * pop-up.
 */
export default function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  icon = 'delete',
  busy = false,
  children,
  onConfirm,
  onCancel,
}: ConfirmSheetProps) {
  const Icon = ICONS[icon];

  return (
    <BottomSheet
      visible={visible}
      title={title}
      // While the action is running there is no way out: closing the sheet
      // halfway through would hide the answer to the question it just asked.
      onClose={busy ? () => {} : onCancel}
      footer={
        <>
          <Pressable
            style={[styles.actionButton, busy && styles.busy]}
            onPress={onConfirm}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={confirmLabel}
          >
            <Icon size={16} color={BrandColors.background} />
            <Text style={styles.actionText}>{busy ? 'Working…' : confirmLabel}</Text>
          </Pressable>

          <Pressable
            style={styles.cancelButton}
            onPress={onCancel}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={cancelLabel}
          >
            <Text style={styles.cancelText}>{cancelLabel}</Text>
          </Pressable>
        </>
      }
    >
      <View style={styles.body}>
        <View style={styles.iconBadge}>
          <Icon size={22} color={BrandColors.error} />
        </View>
        <Text style={styles.message}>{message}</Text>
        {children}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: BrandColors.errorBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 21,
    color: BrandColors.secondary,
    textAlign: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: 15,
    backgroundColor: BrandColors.error,
  },
  actionText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    color: BrandColors.background,
  },
  busy: {
    opacity: 0.6,
  },
  cancelButton: {
    paddingVertical: Spacing.three,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BrandColors.surfaceAlt,
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  cancelText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    color: BrandColors.primary,
  },
});
