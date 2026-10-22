import PrimaryButton from '@/components/Button/primary-button';
import BottomSheet from '@/components/ui/bottom-sheet';
import { HelperText } from '@/components/ui/card';
import { PasswordField } from '@/components/ui/text-input-field';
import { BrandColors, Spacing } from '@/constants/theme';
import { changePassword } from '@/services/Firebase/userService';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

interface ChangePasswordSheetProps {
  visible: boolean;
  onClose: () => void;
  onChanged?: () => void;
}

function describe(code?: string): string {
  switch (code) {
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Your current password is not right.';
    case 'auth/weak-password':
      return 'Pick a stronger password, at least 6 characters.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection.';
    default:
      return 'Could not change your password. Please try again.';
  }
}

export default function ChangePasswordSheet({
  visible,
  onClose,
  onChanged,
}: ChangePasswordSheetProps) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setCurrent('');
    setNext('');
    setConfirm('');
    setError('');
    setSaving(false);
  }, [visible]);

  const handleSave = async () => {
    if (saving) return;
    if (!current || !next) {
      setError('Fill in your current and new password.');
      return;
    }
    if (next.length < 6) {
      setError('Your new password needs at least 6 characters.');
      return;
    }
    if (next !== confirm) {
      setError('The new passwords do not match.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await changePassword(current, next);
      onChanged?.();
      onClose();
    } catch (err: any) {
      console.warn('Password change failed:', err?.code ?? err);
      setError(describe(err?.code));
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      title="Change password"
      onClose={() => !saving && onClose()}
      footer={
        <>
          {!!error && <HelperText tone="error">{error}</HelperText>}
          <PrimaryButton
            title={saving ? 'Saving…' : 'Update password'}
            onPress={handleSave}
            buttonColor={BrandColors.base50}
            textColor={BrandColors.primary}
            borderColor={BrandColors.base50}
            borderWidth={0}
            disabled={saving}
          />
        </>
      }
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <PasswordField
          title="Current password"
          placeholder="Your current password"
          value={current}
          onChangeText={setCurrent}
        />
        <PasswordField
          title="New password"
          placeholder="At least 6 characters"
          value={next}
          onChangeText={setNext}
        />
        <PasswordField
          title="Confirm new password"
          placeholder="Type it again"
          value={confirm}
          onChangeText={setConfirm}
        />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: Spacing.three, paddingBottom: Spacing.four },
});
