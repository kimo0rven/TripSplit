import PrimaryButton from '@/components/Button/primary-button';
import Logo from '@/components/Logo/whitemode';
import { ThemedView } from '@/components/themed-view';
import Back from '@/components/ui/back-button';
import { EmailField, PasswordField } from '@/components/ui/text-input-field';
import { BottomTabInset, BrandColors, MaxContentWidth, Spacing } from '@/constants/theme';
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
            </View>

            <View style={styles.buttonContainer}>
              <PrimaryButton 
                onPress={() => console.log('Login pressed')} 
                title="Log In" 
                buttonColor={BrandColors.base50} 
                textColor={BrandColors.primary} 
                borderColor={BrandColors.base50} 
                borderWidth={0} 
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
  buttonContainer: {
    width: '100%',
    marginTop: Spacing.four,
  },
});