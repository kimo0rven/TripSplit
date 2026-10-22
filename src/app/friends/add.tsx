import BackButton from '@/components/Button/back-button';
import PrimaryButton from '@/components/Button/primary-button';
import BottomSheet from '@/components/ui/bottom-sheet';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import QrCode from '@/components/ui/qr-code';
import { TextfieldLeftIcon } from '@/components/ui/text-input-field';
import { BrandColors, MaxContentWidth, Spacing } from '@/constants/theme';
import { addFriendByEmail } from '@/services/Firebase/friendService';
import { useAuth } from '@/services/Firebase/useAuth';
import { buildFriendQr } from '@/utils/qr';
import { useRouter } from 'expo-router';
import { Mail, QrCode as QrIcon, UserPlus } from 'lucide-react-native';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default function AddFriendScreen() {
  const router = useRouter();
  const { currentUser } = useAuth();

  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [showQr, setShowQr] = useState(false);

  // The sender is asked before anything is sent.
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  const myQrValue = currentUser?.uid ? buildFriendQr(currentUser.uid) : '';
  const canSend = !!email.trim() && !sending;

  /** Step 1: ask "send a request to this person?" */
  const handleAskToAdd = () => {
    const value = email.trim();
    if (!value || sending || !currentUser?.uid) return;

    setError('');
    setStatus('');
    setPendingEmail(value);
  };

  /** Step 2: they confirmed, so send the request. */
  const handleSendRequest = async () => {
    if (!pendingEmail || !currentUser?.uid || sending) return;

    setSending(true);
    setError('');
    setStatus('');

    try {
      const result = await addFriendByEmail(currentUser.uid, pendingEmail);
      setPendingEmail(null);

      if (!result.success) {
        setError(result.message || 'Could not send that request.');
      } else {
        setStatus(`Request sent to ${pendingEmail}. You are friends once they accept.`);
        setEmail('');
      }
    } catch (err: any) {
      console.error('Failed to send friend request:', err);
      setPendingEmail(null);
      setError(err?.message || 'Could not send that request.');
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <View style={styles.backWrapper}>
          <BackButton onPress={() => router.back()} />
        </View>
        <Text style={styles.headerTitle}>Add a friend</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <View style={styles.iconWrapper}>
            <UserPlus size={32} color={BrandColors.primary} />
          </View>

          <View style={styles.textBlock}>
            <Text style={styles.title}>Add by email</Text>
            <Text style={styles.subtitle}>
              Enter the email of someone who already has a TripSplit account. They get a request to
              accept, so nobody is added without agreeing.
            </Text>
          </View>

          <TextfieldLeftIcon
            title=""
            placeholder="friend@email.com"
            value={email}
            onChangeText={setEmail}
            leftIcon={Mail}
            keyboardType="email-address"
          />

          {!!error && <Text style={styles.errorText}>{error}</Text>}
          {!!status && <Text style={styles.statusText}>{status}</Text>}

          <PrimaryButton
            title={sending ? 'Sending…' : 'Send request'}
            onPress={handleAskToAdd}
            buttonColor={BrandColors.base500}
            textColor={BrandColors.heading}
            borderColor={BrandColors.base500}
            borderWidth={0}
            disabled={!canSend}
          />

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable style={styles.qrButton} onPress={() => setShowQr(true)}>
            <QrIcon size={20} color={BrandColors.primary} />
            <Text style={styles.qrButtonText}>Show my QR code</Text>
          </Pressable>
          <Text style={styles.hint}>
            Let a friend scan it to send you a request - you still choose whether to accept.
          </Text>
        </View>
      </ScrollView>

      {/* Sender's confirmation, before anything is sent. */}
      <ConfirmDialog
        visible={!!pendingEmail}
        title="Send a friend request?"
        message={
          pendingEmail
            ? `A request will be sent to ${pendingEmail}. They are added to your friends only after they accept.`
            : ''
        }
        confirmLabel="Send request"
        cancelLabel="Cancel"
        busy={sending}
        onConfirm={handleSendRequest}
        onCancel={() => {
          if (sending) return;
          setPendingEmail(null);
        }}
      />

      <BottomSheet visible={showQr} title="My QR code" onClose={() => setShowQr(false)}>
        <View style={styles.qrBody}>
          <Text style={styles.qrHint}>
            Let a friend scan this to send you a request. You still choose whether to accept it.
          </Text>
          {!!myQrValue && <QrCode value={myQrValue} size={220} color={BrandColors.base700} />}
        </View>
      </BottomSheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: BrandColors.background,
  },
  header: {
    paddingTop: 40,
    paddingHorizontal: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backWrapper: {
    position: 'absolute',
    left: 15,
    top: 34,
    zIndex: 1,
  },
  headerTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 20,
    color: BrandColors.primary,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 100,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: Spacing.four,
    paddingHorizontal: 25,
    paddingTop: Spacing.five,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  iconWrapper: {
    alignSelf: 'center',
    width: 80,
    height: 80,
    borderRadius: 22,
    backgroundColor: BrandColors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    gap: Spacing.two,
  },
  title: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 22,
    color: BrandColors.primary,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    color: BrandColors.secondary,
    textAlign: 'center',
    lineHeight: 21,
  },
  errorText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13,
    color: BrandColors.error,
    textAlign: 'center',
  },
  statusText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13,
    color: BrandColors.success,
    textAlign: 'center',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: BrandColors.border,
  },
  dividerText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: BrandColors.secondary,
  },
  qrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: BrandColors.primary,
    backgroundColor: BrandColors.surfaceAlt,
  },
  qrButtonText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 15,
    color: BrandColors.primary,
  },
  hint: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: BrandColors.secondary,
    textAlign: 'center',
  },
  qrBody: {
    alignItems: 'center',
    gap: Spacing.four,
    paddingVertical: Spacing.three,
  },
  qrHint: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13,
    color: BrandColors.secondary,
    textAlign: 'center',
  },
});
