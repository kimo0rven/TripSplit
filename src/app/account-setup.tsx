import Back from '@/components/Button/back-button';
import PrimaryButton from '@/components/Button/primary-button';
import BigButtonOptions from '@/components/ui/big-button-options';
import { TextField } from '@/components/ui/text-input-field';
import { auth } from '@/config/firebase';
import { currencies } from '@/constants/currencies';
import { BrandColors, MaxContentWidth, Spacing } from '@/constants/theme';
import { updateAuthProfile, updateUserData } from '@/services/Firebase/userService';
import { uploadAvatar } from '@/services/Supabase/storageService';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Camera, Check, Plus, Users } from 'lucide-react-native';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

const TOTAL_STEPS = 4;
const CURRENCIES = currencies;

export default function AccountSetup() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [fullname, setFullname] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState<string>('PHP');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  const hasFullname = fullname.trim().length > 0;
  const pickImage = async () => {

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      alert('Permission to access media library is required!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], 
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0].uri) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const handleContinue = async () => {
    if (currentStep === 1 && !hasFullname) return;

    if (currentStep < TOTAL_STEPS) {
      setCurrentStep((step) => step + 1);
      return;
    }

    setSaving(true);
    setSaveError('');

    try {
        const uid = auth.currentUser?.uid;
        if (!uid) throw new Error('No user is signed in.');

        let photoURL: string | undefined;
        if (avatarUri) {
            photoURL = await uploadAvatar(avatarUri, uid);
        }

        await Promise.all([
        updateAuthProfile({
            displayName: fullname.trim(),
            ...(photoURL && { photoURL }),
        }),
        updateUserData({
            currency: selectedCurrency,
        }),
    ]);

    router.replace('/homescreen');
  } catch (err) {
    console.error('Failed to save account setup:', err);
    setSaveError('Something went wrong saving your profile. Please try again.');
  } finally {
    setSaving(false);
  }
  };

  const handleSkip = () => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep((step) => step + 1);
      return;
    }

    router.replace('/homescreen');
  };

  const handleBack = () => {
    setCurrentStep((step) => Math.max(1, step - 1));
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <>
            <Text style={styles.title}>Set up your profile</Text>
            <Text style={styles.subtitle}>
              This is how friends will recognize you when you split expenses together.
            </Text>
            <Pressable
                accessibilityLabel="Upload profile picture"
                accessibilityRole="button"
                onPress={pickImage}
                style={styles.avatarButton}
                >
                {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                ) : (
                    <Camera color={BrandColors.secondary} size={32} strokeWidth={1.75} />
                )}
                <View style={styles.addAvatarButton}>
                    <Plus color={BrandColors.primary} size={18} strokeWidth={2.5} />
                </View>
            </Pressable>

            <TextField
              title="Full Name"
              placeholder="e.g Alex Rivera"
              value={fullname}
              onChangeText={setFullname}
            />
          </>
        );
      case 2:
        return (
          <>
            <Text style={styles.title}>Default Currency</Text>
            <Text style={styles.subtitle}>
              We'll use this for new trips and your spending totals. You can change it per trip anytime.
            </Text>
            <BigButtonOptions
              choices={CURRENCIES}
              selectedValue={selectedCurrency}
              onSelect={(currency) => setSelectedCurrency(currency.value)}
            />
          </>
        );
      case 3:
        return (
          <View style={{ gap: Spacing.five }}>
            <View style={styles.topLayer}>
              <View style={styles.bellContainer}>
                <Users size={32} color={BrandColors.info} />
              </View>
            </View>
            <View>
              <Text style={styles.title}>Stay in the loop</Text>
              <Text style={styles.subtitle}>
                Turn on notifications so you never miss when someone adds an expense or settles up.
              </Text>
            </View>
            <View style={styles.tipsWrapper}>
              <View style={styles.tipContainer}>
                <Check color={BrandColors.success} />
                <Text style={styles.tipText}>New expenses added to your trips</Text>
              </View>
              <View style={styles.tipContainer}>
                <Check color={BrandColors.success} />
                <Text style={styles.tipText}>Payment reminders and confirmations</Text>
              </View>
              <View style={styles.tipContainer}>
                <Check color={BrandColors.success} />
                <Text style={styles.tipText}>Trip invites from friends</Text>
              </View>
            </View>
          </View>
        );
      default:
        return (
          <>
          <View style={styles.allSetContainer}>
            <View style={styles.allSetIconContainer}>
                <Check size={32} color={BrandColors.success} />
                </View>
            <View>
                <Text style={styles.allSet}>You're all set!</Text>
            </View>
          </View>
          </>
        );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.contentWrapper}>
        <View style={styles.topSection}>
          <View style={styles.topBar}>
            {currentStep > 1 && (
              <View style={styles.backButtonContainer}>
                <Back onPress={handleBack} />
              </View>
            )}

            <View style={styles.steps}>
              {Array.from({ length: TOTAL_STEPS }, (_, index) => {
                const step = index + 1;
                return (
                  <View
                    key={step}
                    style={[
                      styles.step,
                      step === currentStep ? styles.activeStep : styles.inactiveStep,
                    ]}
                  />
                );
              })}
            </View>

            {currentStep == 3 && (
              <Pressable style={styles.skipButton} onPress={handleSkip}>
                <Text style={styles.skipText}>Skip</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.sectionContainer}>{renderStepContent()}</View>
        </View>

        <View style={styles.continueSection}>
          <PrimaryButton
            onPress={handleContinue}
            title={
            saving ? 'Saving...' :
              currentStep === 3
                ? 'Enable Notification'
                : currentStep === TOTAL_STEPS
                ? 'Finish'
                : 'Continue'
            }
            buttonColor={BrandColors.base50}
            textColor={BrandColors.primary}
            borderColor={BrandColors.base50}
            borderWidth={0}
            disabled={currentStep === 1 && !hasFullname}
          />
          {currentStep === 3 && (
            <Pressable style={styles.notNowButton} onPress={handleSkip}>
              <Text style={styles.notNowText}>Not Now</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BrandColors.background,
    padding: 24,
  },
  contentWrapper: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.one,
    justifyContent: 'space-between',
    gap: Spacing.five,
  },
  topBar: {
    width: '100%',
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  topSection: {
    width: '100%',
    gap: Spacing.five,
  },
  steps: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  step: {
    height: 8,
    borderRadius: 4,
  },
  activeStep: {
    width: 32,
    backgroundColor: BrandColors.base50,
  },
  inactiveStep: {
    width: 8,
    backgroundColor: BrandColors.disabled,
  },
  skipButton: {
    position: 'absolute',
    right: 0,
    paddingVertical: Spacing.one,
  },
  backButtonContainer: {
    position: 'absolute',
    left: -Spacing.two,
    zIndex: 1,
  },
  sectionContainer: {
    alignItems: 'stretch',
    gap: Spacing.two,
  },
  avatarButton: {
    width: 100,
    height: 100,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 64,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: BrandColors.disabled,
    backgroundColor: BrandColors.surfaceAlt,
    position: 'relative',
    marginVertical: Spacing.two,
  },
  addAvatarButton: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 36,
    height: 36,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BrandColors.base50,
    borderWidth: 3,
    borderColor: BrandColors.background,
    overflow: 'visible',
  },
    avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    },
  continueSection: {
    width: '100%',
    alignItems: 'stretch',
  },
  title: {
    fontFamily: 'PlusJakartaSans-Bold',
    color: BrandColors.primary,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    color: BrandColors.secondary,
    textAlign: 'center',
  },
  skipText: {
    fontFamily: 'PlusJakartaSans-Medium',
    color: BrandColors.secondary,
    fontSize: 14,
    fontWeight: '600',
  },
  topLayer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  bellContainer: {
    backgroundColor: BrandColors.infoBg,
    padding: 10,
    borderRadius: 15,
    width: 90,
    height: 90,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tipsWrapper: {
    gap: 10,
  },
  tipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 15,
    backgroundColor: BrandColors.surfaceAlt,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  tipText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    color: BrandColors.primary,
  },
  notNowButton: {
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  notNowText: {
    fontFamily: 'PlusJakartaSans-Medium',
    color: BrandColors.secondary,
    fontSize: 14,
    fontWeight: '600',
  },
  allSetContainer: {
    paddingTop: 150,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  allSetIconContainer: {
    backgroundColor: BrandColors.successBg,
    padding: 10,
    borderRadius: 15,
    width: 90,
    height: 90,
    justifyContent: 'center',
    alignItems: 'center',
  },
  allSet: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 32,
    color: BrandColors.primary,
  }
});