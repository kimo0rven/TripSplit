import Back from '@/components/Button/back-button';
import PrimaryButton from '@/components/Button/primary-button';
import Logo from '@/components/Logo/whitemode';
import { ThemedView } from '@/components/themed-view';
import { EmailField, PasswordField } from '@/components/ui/text-input-field';
import { BottomTabInset, BrandColors, MaxContentWidth, Spacing } from '@/constants/theme';
import { signIn } from '@/services/Firebase/authService';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';

import { useRouter } from 'expo-router';

export default function loginScreen() {
  const router = useRouter(); 
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError('');

    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);

    try {
      await signIn(email, password);
      router.replace('/homescreen');
    } catch (err: any) {
      setError(mapFirebaseError(err?.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
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
              
              <View style={styles.headerTextContainer}>
                <Text style={styles.subtitle}>Please enter your email & password to log in</Text>
              </View>

              {!!error && <Text style={styles.errorText}>{error}</Text>}
              
              <EmailField 
                title="Email" 
                placeholder="Enter your email" 
                value={email} 
                onChangeText={(text) => {
                  setEmail(text);
                  if (error) setError('');
                }}
                keyboardType="email-address"
              />
              
              <PasswordField 
                title="Password" 
                placeholder="Enter your password" 
                value={password} 
                onChangeText={(text) => {
                  setPassword(text);
                  if (error) setError('');
                }}
                secureTextEntry={true}
              />
            </View>

            <View style={styles.buttonContainer}>
              <PrimaryButton 
                onPress={handleLogin}
                title={loading ? 'Logging In...' : 'Log In'}
                buttonColor={BrandColors.base50} 
                textColor={BrandColors.primary} 
                borderColor={BrandColors.base50} 
                borderWidth={0}
                disabled={loading}
              />
            </View>
          </View>
        </ScrollView>
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
    paddingHorizontal: Spacing.six,
    justifyContent: 'space-between',
    paddingBottom: BottomTabInset + Spacing.three,
  },
  backButtonContainer: {
    alignSelf: 'flex-start',
    marginBottom: Spacing.two,
  },
  sectionContainer: {
    alignItems: 'center',
    gap: Spacing.five,
    width: '100%',
  },
  headerTextContainer: {
    width: '100%',
    alignItems: 'flex-start',
  },
  subtitle: {
    color: BrandColors.secondary,
    textAlign: 'left',
    fontSize: 14,
  },
  errorText: {
    color: '#FF4D4D',
    fontSize: 14,
    textAlign: 'center',
    width: '100%',
  },
  buttonContainer: {
    width: '100%',
    marginTop: Spacing.four,
  },
});

function mapFirebaseError(code?: string): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'Incorrect email or password.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please wait and try again later.';
    case 'auth/operation-not-allowed':
    case 'auth/configuration-not-found':
      return 'Email and password sign-in is not enabled for this Firebase project.';
    case 'auth/invalid-api-key':
      return 'Firebase is not configured correctly. Please contact support.';
    case 'auth/app-not-authorized':
      return 'This app is not authorized for the Firebase project.';
    default:
      return 'Unable to log in. Please try again.';
  }
}