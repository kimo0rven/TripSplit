import { BrandColors, Spacing } from '@/constants/theme';
import { ReactNode, useEffect } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  /** Label of the button that goes ahead with the action. */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Paints the confirm button red, for things that cannot be undone. */
  destructive?: boolean;
  /** Shows a spinner on the confirm button and blocks a second tap. */
  busy?: boolean;
  /** Extra content shown above the buttons, such as a notice or a list. */
  children?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * A plain yes/no question the user must answer.
 *
 * React Native's own `Alert.alert` is an empty function in a web browser, so
 * the app cannot rely on it for anything that needs a real answer. This uses a
 * normal `Modal`, which works the same on web, iOS and Android.
 */
export default function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
  children,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // Web: give the user the Escape key as a way out, like a real dialog.
  //
  // The check must be `Platform.OS`, not `typeof window`. React Native on a
  // phone sets `global.window = global` (see its setUpGlobals), so `window`
  // exists there too - but it is not a browser window and has no
  // `addEventListener`, which threw "addEventListener is not a function" and
  // took the app down the moment a dialog opened.
  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return;
    if (typeof window === 'undefined' || !window.addEventListener) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel();
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, busy, onCancel]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Pressable style={styles.dismissArea} onPress={busy ? undefined : onCancel} />
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          {children ? <View style={styles.extra}>{children}</View> : null}

          <View style={styles.buttonRow}>
            <Pressable
              style={[styles.button, styles.cancelButton]}
              onPress={onCancel}
              disabled={busy}
            >
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </Pressable>

            <Pressable
              style={[
                styles.button,
                destructive ? styles.destructiveButton : styles.confirmButton,
                busy && styles.busy,
              ]}
              onPress={onConfirm}
              disabled={busy}
            >
              <Text
                style={[
                  styles.confirmText,
                  destructive ? styles.destructiveText : styles.plainConfirmText,
                ]}
              >
                {busy ? 'Working…' : confirmLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: Spacing.four,
  },
  dismissArea: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: BrandColors.background,
    borderRadius: 20,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  title: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 18,
    color: BrandColors.primary,
  },
  message: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 21,
    color: BrandColors.secondary,
  },
  extra: {
    paddingTop: Spacing.two,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  button: {
    flex: 1,
    paddingVertical: Spacing.three,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: BrandColors.surfaceAlt,
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  confirmButton: {
    backgroundColor: BrandColors.base400,
  },
  destructiveButton: {
    backgroundColor: BrandColors.error,
  },
  busy: {
    opacity: 0.6,
  },
  cancelText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    color: BrandColors.primary,
  },
  confirmText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
  },
  plainConfirmText: {
    color: BrandColors.primary,
  },
  destructiveText: {
    color: BrandColors.background,
  },
});
