import BackButton from '@/components/Button/back-button';
import { BrandColors, MaxContentWidth, Spacing } from '@/constants/theme';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import {
  ArrowLeftRight,
  CheckCircle2,
  Download,
  Scale,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react-native';
import { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const HOW_STEPS: { icon: typeof Users; title: string; body: string }[] = [
  {
    icon: Users,
    title: 'Everyone joins the same trip',
    body: 'You create a trip, then invite people with a code or a QR. Everyone sees the same expenses and balances.',
  },
  {
    icon: Wallet,
    title: 'Log what was spent',
    body: 'Add an expense with who paid and who shares the cost. The payer and the sharers can be different people, which is the whole point.',
  },
  {
    icon: Scale,
    title: 'TripSplit works out who owes what',
    body: 'Every expense updates everyone’s balance. You never have to do the maths yourself.',
  },
  {
    icon: ArrowLeftRight,
    title: 'Settle up with fewer payments',
    body: 'Instead of everyone paying everyone, the app suggests the shortest set of payments that clears every balance.',
  },
  {
    icon: CheckCircle2,
    title: 'Both sides confirm',
    body: 'When someone records a payment, the other person confirms it. Nothing is marked settled until both agree.',
  },
];

const FEATURES: { title: string; body: string }[] = [
  {
    title: 'Plans',
    body: 'A timeline of what you are doing each day, with times, places and photos.',
  },
  { title: 'Receipts', body: 'Photograph a bill and attach it to the expense it belongs to.' },
  {
    title: 'Several currencies',
    body: 'Each trip keeps its own currency, and your totals can be combined into one.',
  },
  {
    title: 'Reports',
    body: 'See where the money went by category, and how it splits between people.',
  },
  {
    title: 'Works offline',
    body: 'Add expenses without a signal. They sync when you are back online.',
  },
  {
    title: 'Edit history',
    body: 'Every change to an expense is recorded, so you can always see what changed and who changed it.',
  },
];

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.block}>
      <Text style={styles.blockTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Paragraph({ children }: { children: ReactNode }) {
  return <Text style={styles.paragraph}>{children}</Text>;
}

export default function AboutScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
        <Text style={styles.headerTitle}>How TripSplit works</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <View style={styles.hero}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>T</Text>
            </View>
            <Text style={styles.heroTitle}>TripSplit</Text>
            <Text style={styles.heroSubtitle}>
              Shared spending for trips, without the awkward maths
            </Text>
            <Text style={styles.version}>Version {Constants.expoConfig?.version ?? '1.0.0'}</Text>
          </View>

          <Block title="The idea in one minute">
            <Paragraph>
              A trip is just a group of people spending money together. Someone pays for the van,
              someone else covers dinner, and by the third day nobody remembers who is owed what.
            </Paragraph>
            <Paragraph>
              TripSplit keeps a running balance for each person instead. Add what was spent, say who
              paid and who shared it, and the app keeps score. At the end it tells you the smallest
              number of payments that squares everyone up.
            </Paragraph>
          </Block>

          <Block title="How it works">
            {HOW_STEPS.map(({ icon: Icon, title, body }, index) => (
              <View key={title} style={styles.step}>
                <View style={styles.stepIcon}>
                  <Icon size={18} color={BrandColors.primary} />
                </View>
                <View style={styles.stepText}>
                  <Text style={styles.stepTitle}>
                    {index + 1}. {title}
                  </Text>
                  <Text style={styles.stepBody}>{body}</Text>
                </View>
              </View>
            ))}
          </Block>

          <Block title="What a trip holds">
            {FEATURES.map(({ title, body }) => (
              <View key={title} style={styles.featureRow}>
                <Sparkles size={16} color={BrandColors.base700} />
                <View style={styles.stepText}>
                  <Text style={styles.stepTitle}>{title}</Text>
                  <Text style={styles.stepBody}>{body}</Text>
                </View>
              </View>
            ))}
          </Block>

          <Block title="One rule worth knowing">
            <Paragraph>
              A trip stops accepting changes once its last day has passed. It moves to the Past list
              on the Trips page and stops being your active trip, but you can still open it to look
              back.
            </Paragraph>
            <Paragraph>
              You also cannot leave a trip while you still owe or are owed money in it. Settle up
              first, so nobody is left holding a balance they cannot clear.
            </Paragraph>
          </Block>

          <Block title="Made with">
            <Paragraph>
              TripSplit is a small independent app. It is not a bank and does not move money — it
              only keeps track of what people agreed to pay each other. Any actual payment happens
              between you, whatever way you prefer.
            </Paragraph>
          </Block>

          <View style={styles.resetRow}>
            <Download size={16} color={BrandColors.secondary} />
            <Text style={styles.resetText}>
              No account to manage here — your data lives with your sign-in.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: BrandColors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  headerTitle: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 22, color: BrandColors.primary },
  scrollContent: { paddingBottom: 60, alignItems: 'center' },
  container: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingTop: Spacing.three,
    paddingHorizontal: 25,
    gap: Spacing.four,
  },
  hero: { alignItems: 'center', gap: Spacing.one, paddingVertical: Spacing.two },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: BrandColors.base50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  logoText: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 32, color: BrandColors.heading },
  heroTitle: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 24, color: BrandColors.heading },
  heroSubtitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    color: BrandColors.secondary,
    textAlign: 'center',
    paddingHorizontal: Spacing.four,
  },
  version: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: BrandColors.secondary,
    marginTop: Spacing.one,
  },
  block: {
    backgroundColor: BrandColors.surfaceAlt,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 15,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  blockTitle: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 16, color: BrandColors.primary },
  paragraph: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 21,
    color: BrandColors.primary,
  },
  step: { flexDirection: 'row', gap: Spacing.three, alignItems: 'flex-start' },
  stepIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: BrandColors.base50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { flex: 1, gap: 2 },
  stepTitle: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: BrandColors.primary },
  stepBody: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13,
    lineHeight: 19,
    color: BrandColors.secondary,
  },
  featureRow: { flexDirection: 'row', gap: Spacing.three, alignItems: 'flex-start' },
  resetRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'center',
    paddingHorizontal: Spacing.two,
  },
  resetText: {
    flex: 1,
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: BrandColors.secondary,
  },
});
