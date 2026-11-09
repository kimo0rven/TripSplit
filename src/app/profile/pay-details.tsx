import BackButton from '@/components/Button/back-button';
import PrimaryButton from '@/components/Button/primary-button';
import { HelperText } from '@/components/ui/card';
import TabSlider from '@/components/ui/tab-slider';
import { TextField } from '@/components/ui/text-input-field';
import { BrandColors, MaxContentWidth, Spacing } from '@/constants/theme';
import {
  fetchMyPayDetails,
  saveMyPayDetails,
  uploadPayQr,
} from '@/services/Firebase/payDetailsService';
import { useAuth } from '@/services/Firebase/useAuth';
import { newId } from '@/services/offline/offlineStore';
import { pickImage } from '@/utils/imagePicker';
import {
  formatPayNumber,
  PAY_KINDS,
  PayKind,
  PayMethod,
  payMethodProblem,
  payMethodTitle,
} from '@/utils/payDetails';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ImagePlus, Pencil, Trash2, Wallet } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { themedStyles } from '@/constants/themed-styles';

const blank = (name: string): PayMethod => ({
  id: newId(),
  kind: 'gcash',
  accountName: name,
  number: '',
});

/**
 * How you like to be paid. Shown to the people in your trips when they settle
 * up with you, with a copy button and your QR, so nobody has to ask.
 */
export default function PayDetailsScreen() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const uid = currentUser?.uid ?? '';

  const [methods, setMethods] = useState<PayMethod[]>([]);
  const [draft, setDraft] = useState<PayMethod | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!uid) return;
    fetchMyPayDetails(uid)
      .then(setMethods)
      .catch(() => setError('Could not load your payment details.'))
      .finally(() => setLoading(false));
  }, [uid]);

  const save = async (next: PayMethod[]) => {
    setSaving(true);
    setError('');
    try {
      await saveMyPayDetails(uid, next);
      setMethods(next);
      setStatus('Saved. Everyone in your trips sees this when they pay you.');
      return true;
    } catch (err: any) {
      console.error('Failed to save payment details:', err);
      setError(err?.message || 'Could not save your payment details.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveDraft = async () => {
    if (!draft) return;
    const problem = payMethodProblem(draft);
    if (problem) {
      setError(problem);
      return;
    }
    const exists = methods.some((method) => method.id === draft.id);
    const next = exists
      ? methods.map((method) => (method.id === draft.id ? draft : method))
      : [...methods, draft];
    if (await save(next)) setDraft(null);
  };

  const pickQr = async () => {
    if (!draft || uploading) return;
    setError('');
    try {
      const picked = await pickImage({ includeBase64: false, quality: 0.9 });
      if (picked.denied) {
        setError('Photo access is off. Turn it on in your phone settings to add your QR.');
        return;
      }
      const uri = picked.asset?.uri;
      if (!uri) return;
      setUploading(true);
      const url = await uploadPayQr(uri, uid);
      setDraft((current) => (current ? { ...current, qrUrl: url } : current));
    } catch (err) {
      console.error('Failed to add the QR:', err);
      setError('Could not add that picture. Please try again.');
    } finally {
      setUploading(false);
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
        <Text style={styles.headerTitle}>How to pay me</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          <Text style={styles.lead}>
            Add your GCash, Maya or bank details. People in your trips see them when they settle up
            with you, and can copy the number or scan your QR. Nobody outside your trips can see
            them.
          </Text>

          {loading ? (
            <ActivityIndicator color={BrandColors.base50} />
          ) : (
            <>
              {methods.map((method) => (
                <View key={method.id} style={styles.card}>
                  <View style={styles.cardIcon}>
                    <Wallet size={18} color={BrandColors.onBrand} />
                  </View>
                  <View style={styles.cardText}>
                    <Text style={styles.cardTitle}>{payMethodTitle(method)}</Text>
                    <Text style={styles.cardMeta} numberOfLines={1}>
                      {[method.accountName, formatPayNumber(method)].filter(Boolean).join(' · ')}
                      {method.qrUrl ? ' · QR added' : ''}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      setError('');
                      setStatus('');
                      setDraft(method);
                    }}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${payMethodTitle(method)}`}
                  >
                    <Pencil size={16} color={BrandColors.primary} />
                  </Pressable>
                  <Pressable
                    onPress={() => save(methods.filter((item) => item.id !== method.id))}
                    hitSlop={8}
                    disabled={saving}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${payMethodTitle(method)}`}
                  >
                    <Trash2 size={16} color={BrandColors.error} />
                  </Pressable>
                </View>
              ))}

              {draft ? (
                <View style={styles.form}>
                  <TabSlider
                    items={PAY_KINDS}
                    value={draft.kind}
                    onChange={(kind: PayKind) => setDraft({ ...draft, kind })}
                  />
                  {(draft.kind === 'bank' || draft.kind === 'other') && (
                    <TextField
                      title={draft.kind === 'bank' ? 'Bank' : 'What is it?'}
                      placeholder={
                        draft.kind === 'bank' ? 'e.g. BPI, BDO' : 'e.g. PayPal, ShopeePay'
                      }
                      value={draft.provider ?? ''}
                      onChangeText={(provider) => setDraft({ ...draft, provider })}
                    />
                  )}
                  <TextField
                    title="Name on the account"
                    placeholder="So the payer can check before sending"
                    value={draft.accountName}
                    onChangeText={(accountName) => setDraft({ ...draft, accountName })}
                  />
                  <TextField
                    title={
                      draft.kind === 'gcash' || draft.kind === 'maya'
                        ? 'Mobile number'
                        : 'Account number or ID'
                    }
                    placeholder={
                      draft.kind === 'gcash' || draft.kind === 'maya'
                        ? '09XX XXX XXXX'
                        : 'Account number'
                    }
                    value={draft.number}
                    onChangeText={(number) => setDraft({ ...draft, number })}
                    keyboardType={draft.kind === 'other' ? 'default' : 'numeric'}
                  />

                  <View style={styles.qrRow}>
                    {draft.qrUrl ? (
                      <Image source={{ uri: draft.qrUrl }} style={styles.qr} contentFit="contain" />
                    ) : null}
                    <Pressable
                      style={styles.qrButton}
                      onPress={pickQr}
                      disabled={uploading}
                      accessibilityRole="button"
                    >
                      {uploading ? (
                        <ActivityIndicator color={BrandColors.onBrand} size="small" />
                      ) : (
                        <ImagePlus size={16} color={BrandColors.onBrand} />
                      )}
                      <Text style={styles.qrText}>
                        {draft.qrUrl ? 'Change QR' : 'Add your QR (optional)'}
                      </Text>
                    </Pressable>
                    {!!draft.qrUrl && (
                      <Pressable
                        onPress={() => setDraft({ ...draft, qrUrl: undefined })}
                        hitSlop={8}
                        accessibilityRole="button"
                      >
                        <Text style={styles.remove}>Remove</Text>
                      </Pressable>
                    )}
                  </View>
                  <HelperText>
                    A screenshot of your GCash or Maya “Receive money” QR works well.
                  </HelperText>

                  <View style={styles.formButtons}>
                    <Pressable onPress={() => setDraft(null)} style={styles.cancel} hitSlop={8}>
                      <Text style={styles.cancelText}>Cancel</Text>
                    </Pressable>
                    <View style={styles.flexOne}>
                      <PrimaryButton
                        title={saving ? 'Saving…' : 'Save'}
                        onPress={saveDraft}
                        buttonColor={BrandColors.base50}
                        textColor={BrandColors.primary}
                        borderColor={BrandColors.base50}
                        borderWidth={0}
                        disabled={saving || uploading}
                      />
                    </View>
                  </View>
                </View>
              ) : (
                <Pressable
                  style={styles.add}
                  onPress={() => {
                    setError('');
                    setStatus('');
                    setDraft(blank(currentUser?.displayName || ''));
                  }}
                  accessibilityRole="button"
                >
                  <Text style={styles.addText}>
                    {methods.length ? '+ Add another way to be paid' : '+ Add a way to be paid'}
                  </Text>
                </Pressable>
              )}

              {!!error && <HelperText tone="error">{error}</HelperText>}
              {!!status && !error && <HelperText tone="success">{status}</HelperText>}
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = themedStyles(() => ({
  flex: { flex: 1, backgroundColor: BrandColors.background },
  flexOne: { flex: 1 },
  header: { paddingTop: 40, paddingHorizontal: 25, alignItems: 'center', justifyContent: 'center' },
  backWrapper: { position: 'absolute', left: 15, top: 34, zIndex: 1 },
  headerTitle: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 20, color: BrandColors.primary },
  scroll: { paddingBottom: Spacing.six },
  container: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: 25,
    paddingTop: Spacing.four,
    gap: Spacing.three,
  },
  lead: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 14, color: BrandColors.secondary },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: BrandColors.inputField,
    borderRadius: 15,
    padding: Spacing.three,
  },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BrandColors.base400,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { flex: 1, gap: 2 },
  cardTitle: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 15, color: BrandColors.primary },
  cardMeta: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 12, color: BrandColors.secondary },
  form: {
    gap: Spacing.three,
    borderWidth: 1.5,
    borderColor: BrandColors.base50,
    borderRadius: 15,
    padding: Spacing.three,
  },
  qrRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  qr: { width: 72, height: 72, borderRadius: 8, backgroundColor: BrandColors.inputField },
  qrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    backgroundColor: BrandColors.base200,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  qrText: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 12, color: BrandColors.onBrand },
  remove: { fontFamily: 'PlusJakartaSans-Medium', fontSize: 12, color: BrandColors.error },
  formButtons: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  cancel: { paddingHorizontal: Spacing.two },
  cancelText: { fontFamily: 'PlusJakartaSans-Medium', fontSize: 14, color: BrandColors.secondary },
  add: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: BrandColors.border,
    borderRadius: 15,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  addText: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: BrandColors.primary },
}));
