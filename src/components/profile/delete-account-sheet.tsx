import PrimaryButton from '@/components/Button/primary-button';
import BottomSheet from '@/components/ui/bottom-sheet';
import { HelperText } from '@/components/ui/card';
import { PasswordField } from '@/components/ui/text-input-field';
import { BrandColors, Spacing } from '@/constants/theme';
import { deleteAccount } from '@/services/Firebase/userService';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

interface DeleteAccountSheetProps {
  visible: boolean;
  onClose: () => void;
}

function describe(err: any): string {
  switch (err?.code) {
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'That password is not right.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection.';
    default:
      return err?.message || 'Could not delete your account. Please try again.';
  }
}

export default function DeleteAccountSheet({ visible, onClose }: DeleteAccountSheetProps) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setPassword('');
    setError('');
    setBusy(false);
  }, [visible]);

  const handleDelete = async () => {
    if (busy) return;
    if (!password) {
      setError('Enter your password to confirm.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await deleteAccount(password);
    } catch (err: any) {
      console.warn('Account deletion failed:', err?.code ?? err);
      setError(describe(err));
      setBusy(false);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      title="Delete account"
      onClose={() => !busy && onClose()}
      footer={
        <>
          {!!error && <HelperText tone="error">{error}</HelperText>}
          <PrimaryButton
            title={busy ? 'Deleting…' : 'Delete my account'}
            onPress={handleDelete}
            buttonColor={BrandColors.errorBg}
            textColor={BrandColors.error}
            borderColor={BrandColors.error}
            borderWidth={1}
            disabled={busy}
          />
        </>
      }
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <HelperText>
          This removes you from every trip and deletes your profile for good. You must have settled
          up on all your trips first.
        </HelperText>
        <PasswordField
          title="Password"
          placeholder="Your password"
          value={password}
          onChangeText={setPassword}
        />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: Spacing.three, paddingBottom: Spacing.four },
});
