import BackButton from '@/components/Button/back-button';
import EmptyState from '@/components/ui/empty-state';
import EditLog from '@/components/trip/edit-log';
import { BrandColors, MaxContentWidth, Spacing } from '@/constants/theme';
import { EditLogEntry } from '@/types/expenses';
import { History } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

/**
 * Every change ever made to one money record.
 *
 * The logs used to be printed under the expense or payment they belonged to,
 * which pushed the rest of that sheet off the screen once anything had been
 * edited twice. They now live here, one page per record, reached by a link.
 *
 * The entries travel in the address rather than being fetched again: the screen
 * that opened this page already had them in hand, so passing them along keeps
 * this page instant and works with no connection.
 */
export default function EditLogScreen() {
  const router = useRouter();
  const { title, subtitle, history } = useLocalSearchParams<{
    title?: string;
    subtitle?: string;
    history?: string;
  }>();

  // A page opened from a link (or reloaded) has no entries to show.
  let entries: EditLogEntry[] = [];
  if (history) {
    try {
      const parsed = JSON.parse(history);
      if (Array.isArray(parsed)) entries = parsed as EditLogEntry[];
    } catch {
      entries = [];
    }
  }

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <View style={styles.backWrapper}>
          <BackButton onPress={() => router.back()} />
        </View>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Edit log
        </Text>
        {!!subtitle && (
          <Text style={styles.headerSub} numberOfLines={2}>
            {subtitle}
          </Text>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          {!!title && (
            <Text style={styles.recordTitle} numberOfLines={2}>
              {title}
            </Text>
          )}

          {entries.length === 0 ? (
            <EmptyState
              icon={History}
              title="No changes yet"
              message="When someone edits this, what changed and who changed it shows up here."
            />
          ) : (
            <>
              <Text style={styles.count}>
                {entries.length} {entries.length === 1 ? 'change' : 'changes'}, newest first
              </Text>
              <EditLog history={entries} />
            </>
          )}
        </View>
      </ScrollView>
    </View>
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
    gap: 2,
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
  headerSub: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: BrandColors.secondary,
    textAlign: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: Spacing.six,
  },
  container: {
    paddingTop: Spacing.four,
    paddingHorizontal: 25,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  recordTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 16,
    color: BrandColors.primary,
  },
  count: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: BrandColors.secondary,
  },
});
