import BackButton from '@/components/Button/back-button';
import { BrandColors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useRouter } from 'expo-router';
import {
  Cloud,
  Eye,
  Image as ImageIcon,
  Lock,
  Smartphone,
  Users,
  LucideIcon,
} from 'lucide-react-native';
import { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const STORED: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Users,
    title: 'Your account',
    body: 'Your name, email address and profile photo. These come from signing in, and you can change the name and photo at any time from Edit profile.',
  },
  {
    icon: Cloud,
    title: 'Your trips',
    body: 'Trip names, dates, members, expenses, payments and plans. This is the data the app exists to keep, so it lives on the server rather than only on your phone.',
  },
  {
    icon: ImageIcon,
    title: 'Photos',
    body: 'Profile pictures, receipt photos and photos you add to plans. These are uploaded to an image host and stored as links.',
  },
  {
    icon: Smartphone,
    title: 'A copy on your phone',
    body: 'Changes are saved on your device first, so the app works without a signal. That copy is cleared when you log out.',
  },
];

const VISIBLE: { title: string; body: string }[] = [
  {
    title: 'People in your trips',
    body: 'Anyone in a trip can see that trip’s expenses, payments, balances and plans — that is how shared splitting works. They can also see your name and profile photo.',
  },
  {
    title: 'People in the same balances',
    body: 'When you owe someone or they owe you, both of you see the amount. Nobody outside that trip does.',
  },
  {
    title: 'Nobody else',
    body: 'Your email address is not shown to other members. Your trip list is private to you.',
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

export default function PrivacyScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
        <Text style={styles.headerTitle}>Privacy and your data</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <Block title="What is stored">
            {STORED.map(({ icon: Icon, title, body }) => (
              <View key={title} style={styles.row}>
                <View style={styles.rowIcon}>
                  <Icon size={18} color={BrandColors.primary} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{title}</Text>
                  <Text style={styles.rowBody}>{body}</Text>
                </View>
              </View>
            ))}
          </Block>

          <Block title="Who can see it">
            {VISIBLE.map(({ title, body }) => (
              <View key={title} style={styles.row}>
                <View style={styles.rowIcon}>
                  <Eye size={18} color={BrandColors.primary} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{title}</Text>
                  <Text style={styles.rowBody}>{body}</Text>
                </View>
              </View>
            ))}
          </Block>

          <View style={styles.callout}>
            <ImageIcon size={18} color={BrandColors.warning} />
            <Text style={styles.calloutText}>
              Photos are stored as links that anyone holding the link can open. Treat a receipt
              photo like something a travel companion could see — avoid photographing card numbers
              or anything you would not want shared.
            </Text>
          </View>

          <Block title="What the app does not do">
            <Text style={styles.rowBody}>
              No advertising. No third-party analytics or tracking. Your data is never sold or
              shared with anyone outside your trips.
            </Text>
            <Text style={styles.rowBody}>
              TripSplit is not a bank and does not move money. It only records what people agreed to
              pay each other.
            </Text>
          </Block>

          <Block title="Keeping it safe">
            <View style={styles.row}>
              <View style={styles.rowIcon}>
                <Lock size={18} color={BrandColors.primary} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Signing in</Text>
                <Text style={styles.rowBody}>
                  Your password is handled by the sign-in service and is never stored by TripSplit
                  itself. You can change it from Settings at any time.
                </Text>
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.rowIcon}>
                <Lock size={18} color={BrandColors.primary} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Deleting your account</Text>
                <Text style={styles.rowBody}>
                  Deleting your account removes your profile and takes you out of your trips. Any
                  trip where money is still owed must be settled first, so nobody is left with a
                  balance they cannot clear.
                </Text>
              </View>
            </View>
          </Block>

          <Block title="Your choices">
            <Text style={styles.rowBody}>
              You can change your name, photo and password whenever you like. You decide what
              notifications reach you, and you can mute a single trip without leaving it.
            </Text>
            <Text style={styles.rowBody}>
              Want a copy of your data or your account removed? Delete the account from Settings, or
              contact whoever shared the app with you.
            </Text>
          </Block>
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
  headerTitle: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 20, color: BrandColors.primary },
  scrollContent: { paddingBottom: 60, alignItems: 'center' },
  container: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingTop: Spacing.three,
    paddingHorizontal: 25,
    gap: Spacing.four,
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
  row: { flexDirection: 'row', gap: Spacing.three, alignItems: 'flex-start' },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: BrandColors.base50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: BrandColors.primary },
  rowBody: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13,
    lineHeight: 19,
    color: BrandColors.secondary,
  },
  callout: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'flex-start',
    backgroundColor: BrandColors.warningBg,
    borderWidth: 1,
    borderColor: BrandColors.warning,
    borderRadius: 15,
    padding: Spacing.four,
  },
  calloutText: {
    flex: 1,
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13,
    lineHeight: 19,
    color: BrandColors.primary,
  },
});
