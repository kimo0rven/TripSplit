import PrimaryButton from '@/components/Button/primary-button';
import Logo from '@/components/Logo/whitemode';
import { ThemedView } from '@/components/themed-view';
import Back from '@/components/ui/back-button';
import { EmailField, PasswordField } from '@/components/ui/text-input-field';
import { BottomTabInset, BrandColors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View
} from 'react-native';

export default function signUpScreen() {
  const router = useRouter(); 
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isAgreed, setIsAgreed] = useState(false);

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.contentWrapper}>
              <View style={styles.backButtonContainer}>
                <Back onPress={() => router.back()} /> 
              </View>

              <View style={styles.sectionContainer}>
                <Logo />
                <Text style={styles.subtitle}>Create an account to get started</Text>
                
                <EmailField 
                  title="Email" 
                  placeholder="Enter your email" 
                  value={email} 
                  onChangeText={(text) => setEmail(text)} 
                  keyboardType="email-address"
                />
                
                <PasswordField 
                  title="Password" 
                  placeholder="Enter your password" 
                  value={password} 
                  onChangeText={(text) => setPassword(text)} 
                  secureTextEntry={true}
                />

                <PasswordField 
                  title="Confirm Password" 
                  placeholder="Confirm your password" 
                  value={confirmPassword} 
                  onChangeText={(text) => setConfirmPassword(text)} 
                  secureTextEntry={true}
                />

                <View style={styles.termsContainer}>
                  <Pressable 
                    style={[styles.checkbox, isAgreed && styles.checkboxChecked]} 
                    onPress={() => setIsAgreed(!isAgreed)}
                    hitSlop={8}
                  >
                    {isAgreed && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
                  </Pressable>

                  <Text style={styles.termsText}>
                    I Agree to TripSplit{' '}
                    <Text 
                      style={styles.termsLink} 
                    >
                      Terms and Conditions
                    </Text>
                  </Text>
                </View>
              </View>

              <View style={styles.buttonContainer}>
                <PrimaryButton 
                  onPress={() => console.log('Create Account', { email, isAgreed })} 
                  title="Create Account" 
                  buttonColor={BrandColors.base50} 
                  textColor={BrandColors.primary} 
                  borderColor={BrandColors.base50} 
                  borderWidth={0} 
                />
              </View>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BrandColors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
  },
  contentWrapper: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    justifyContent: 'space-between',
    paddingBottom: BottomTabInset + Spacing.three,
  },
  backButtonContainer: {
    alignSelf: 'flex-start',
    marginBottom: Spacing.two,
  },
  sectionContainer: {
    alignItems: 'center',
    gap: Spacing.four,
    width: '100%',
  },
  subtitle: {
    color: BrandColors.secondary,
    textAlign: 'center',
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 10,
    marginTop: Spacing.one,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: BrandColors.base50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  checkboxChecked: {
    backgroundColor: BrandColors.base50,
    borderColor: BrandColors.base50,
  },
  termsText: {
    fontSize: 13,
    color: BrandColors.secondary,
    flexShrink: 1,
  },
  termsLink: {
    color: BrandColors.base50,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  buttonContainer: {
    width: '100%',
    marginTop: Spacing.four,
  },
});