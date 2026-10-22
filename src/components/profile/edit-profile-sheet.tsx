import PrimaryButton from '@/components/Button/primary-button';
import Avatar from '@/components/ui/avatar';
import BottomSheet from '@/components/ui/bottom-sheet';
import { HelperText } from '@/components/ui/card';
import { TextField } from '@/components/ui/text-input-field';
import { BrandColors, Spacing } from '@/constants/theme';
import { useAuth } from '@/services/Firebase/useAuth';
import { saveProfile } from '@/services/Firebase/userService';
import { pickImage } from '@/utils/imagePicker';
import { Camera } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface EditProfileSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Called after a save so the screen can redraw the new name and photo. */
  onSaved?: () => void;
}

/** The slide-up form for changing your name and profile photo. */
export default function EditProfileSheet({ visible, onClose, onSaved }: EditProfileSheetProps) {
  const { currentUser } = useAuth();
  const [fullname, setFullname] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setFullname(currentUser?.displayName ?? '');
    setPhotoUri(null);
    setRemovePhoto(false);
    setError('');
    setSaving(false);
    // Only when the sheet opens, so typing is never overwritten.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handlePickPhoto = async () => {
    try {
      const result = await pickImage({ includeBase64: false, quality: 0.7 });
      if (result.denied) {
        setError('Photo access is off. Turn it on in your settings to pick a picture.');
        return;
      }
      if (result.asset?.uri) {
        setPhotoUri(result.asset.uri);
        setRemovePhoto(false);
        setError('');
      }
    } catch (err) {
      console.error('Failed to pick a profile photo:', err);
      setError('Could not open your photos.');
    }
  };

  const handleSave = async () => {
    if (saving) return;
    if (!fullname.trim()) {
      setError('Please enter your name.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await saveProfile({ fullname, photoUri, removePhoto });
      // The sign-in profile is edited in place, so re-read it for the screens.
      await currentUser?.reload();
      onSaved?.();
      onClose();
    } catch (err: any) {
      console.error('Failed to save profile:', err);
      setError(err?.message || 'Could not save your profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const shownName = fullname.trim() || currentUser?.email || '?';

  return (
    <BottomSheet
      visible={visible}
      title="Edit profile"
      onClose={() => !saving && onClose()}
      footer={
        <>
          {!!error && <HelperText tone="error">{error}</HelperText>}
          <PrimaryButton
            title={saving ? 'Saving…' : 'Save changes'}
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
        <Pressable
          style={styles.avatarWrap}
          onPress={handlePickPhoto}
          accessibilityRole="button"
          accessibilityLabel="Change profile photo"
        >
          <Avatar
            name={shownName}
            size={96}
            photoURL={photoUri ?? (removePhoto ? undefined : currentUser?.photoURL ?? undefined)}
          />
          <View style={styles.cameraBadge}>
            <Camera size={14} color={BrandColors.primary} />
          </View>
        </Pressable>
        <Text style={styles.hint}>Tap the picture to change it</Text>
        {(photoUri || (currentUser?.photoURL && !removePhoto)) && (
          <Pressable
            onPress={() => {
              setPhotoUri(null);
              setRemovePhoto(true);
            }}
            accessibilityRole="button"
            hitSlop={8}
          >
            <Text style={styles.removeLink}>Remove photo</Text>
          </Pressable>
        )}

        <TextField
          title="Full name"
          placeholder="Your name"
          value={fullname}
          onChangeText={setFullname}
        />

        <View style={styles.emailBox}>
          <Text style={styles.emailLabel}>Email</Text>
          <Text style={styles.emailValue}>{currentUser?.email ?? '—'}</Text>
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  removeLink: {
    alignSelf: 'center',
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    color: BrandColors.error,
  },
  content: { gap: Spacing.three, paddingBottom: Spacing.four },
  avatarWrap: { alignSelf: 'center', marginTop: Spacing.two },
  cameraBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: BrandColors.base50,
    borderWidth: 2,
    borderColor: BrandColors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: BrandColors.secondary,
    textAlign: 'center',
  },
  emailBox: {
    backgroundColor: BrandColors.surfaceAlt,
    borderRadius: 8,
    padding: Spacing.three,
    gap: 2,
  },
  emailLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: BrandColors.secondary,
  },
  emailValue: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14,
    color: BrandColors.primary,
  },
});
