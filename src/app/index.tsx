import PrimaryButton from '@/components/Button/primary-button';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, BrandColors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  const router = useRouter();
  return (
    <ThemedView style={styles.container}>
      <View style={styles.contentWrapper}>
        
        <View style={styles.sectionContainer}>
          <Text style={styles.logo}>
            Trip<Text style={styles.logo2}>Split</Text>
          </Text>
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.title}>Let's Get Started!</Text>
          <Text style={styles.description}>
            With TripSplit, expenses split bills is easier than ever before
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <PrimaryButton onPress={() => router.push('/auth/register')} title="Sign Up" buttonColor={BrandColors.base50} textColor={BrandColors.primary} borderColor='none' borderWidth={0}/>
          <PrimaryButton onPress={() => router.push('/auth/login')} title="Log In" buttonColor={BrandColors.background} textColor={BrandColors.primary} borderColor={BrandColors.base50} borderWidth={1} />
        </View>

      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BrandColors.background,
    alignItems: 'center',
  },
  contentWrapper: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    justifyContent: 'center',
    gap: Spacing.five + Spacing.three,
    alignItems: 'center',
    paddingBottom: BottomTabInset + Spacing.three,
  },
  sectionContainer: {
    alignItems: 'center',
  },
  textContainer: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  logo: {
    fontWeight: 'bold',
    color: BrandColors.primary,
    textAlign: 'center',
    fontSize: 45,
  },
  logo2: {
    fontWeight: 'bold',
    color: BrandColors.base500,
    textAlign: 'center',
    fontSize: 45,
  },
  title: {
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 'bold',
  },
  description: {
    textAlign: 'center',
    fontSize: 16,
    color: BrandColors.secondary,
    paddingHorizontal: Spacing.two,
  },
  buttonContainer: {
    width: '100%',
    gap: Spacing.three,
  },
  button: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: BrandColors.primary,
  },
  primaryButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    // borderWidth: 1.5,
    // borderColor: BrandColors.primary,
  },
  secondaryButtonText: {
    color: BrandColors.primary,
    fontSize: 16,
    fontWeight: 'bold',
  },
});