import ListSkeleton from '@/components/ui/list-skeleton';
import { useCombinedTotal } from '@/services/currency/useCombinedTotal';
import BackButton from '@/components/Button/back-button';
import Avatar from '@/components/ui/avatar';
import BottomSheet from '@/components/ui/bottom-sheet';
import { Card } from '@/components/ui/card';
import { HelperText } from '@/components/ui/card';
import EmptyState from '@/components/ui/empty-state';
import { BrandColors, MaxContentWidth, Spacing } from '@/constants/theme';
import { fetchSettlements } from '@/services/Firebase/settlementService';
import { fetchUserTrips } from '@/services/Firebase/tripService';
import { useAuth } from '@/services/Firebase/useAuth';
import { Settlement } from '@/types/expenses';
import { formatDay, formatMoney } from '@/utils/money';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ArrowRight, Receipt } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Filter = 'all' | 'made' | 'received';

interface Row {
  settlement: Settlement;
  tripId: string;
  tripName: string;
  currency: string;
  otherName: string;
  otherPhoto?: string;
  fromName: string;
  fromPhoto?: string;
  toName: string;
  toPhoto?: string;
}

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'made', label: 'Made' },
  { key: 'received', label: 'Received' },
];

/** Every payment you made or received, across all trips. */
export default function PaymentsScreen() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const uid = currentUser?.uid;

  const [rows, setRows] = useState<Row[] | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [failed, setFailed] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [viewerUri, setViewerUri] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    let active = true;
    (async () => {
      const trips = await fetchUserTrips(uid);
      const lists = await Promise.all(
        trips.map(async (trip) => {
          const settlements = await fetchSettlements(trip.id);
          return settlements
            .filter((item) => item.from === uid || item.to === uid)
            .map((settlement): Row => {
              const otherId = settlement.from === uid ? settlement.to : settlement.from;
              const other = trip.members?.[otherId];
              return {
                settlement,
                tripId: trip.id,
                tripName: trip.name,
                currency: trip.currency,
                otherName: other?.fullname ?? 'Someone who left',
                otherPhoto: other?.photoURL,
                fromName: trip.members?.[settlement.from]?.fullname ?? 'Someone who left',
                fromPhoto: trip.members?.[settlement.from]?.photoURL,
                toName: trip.members?.[settlement.to]?.fullname ?? 'Someone who left',
                toPhoto: trip.members?.[settlement.to]?.photoURL,
              };
            });
        }),
      );
      const all = lists.flat().sort((a, b) => {
        const left = a.settlement.settledOn + (a.settlement.createdAt ?? '');
        const right = b.settlement.settledOn + (b.settlement.createdAt ?? '');
        return left < right ? 1 : -1;
      });
      if (active) setRows(all);
    })().catch((err) => {
      console.error('Failed to load payments:', err);
      if (active) setFailed(true);
    });
    return () => {
      active = false;
    };
  }, [uid]);

  const shown = useMemo(
    () =>
      (rows ?? []).filter(({ settlement }) =>
        filter === 'made'
          ? settlement.from === uid
          : filter === 'received'
            ? settlement.to === uid
            : true,
      ),
    [rows, filter, uid],
  );

  // Only confirmed payments count towards the totals.
  const detail = (rows ?? []).find((row) => `${row.tripId}-${row.settlement.id}` === openKey);
  const timeOf = (iso?: string) => {
    const date = iso ? new Date(iso) : null;
    return date && !isNaN(date.getTime())
      ? date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      : '';
  };

  const totals = useMemo(() => {
    const byCurrency: Record<string, { made: number; received: number }> = {};
    (rows ?? []).forEach(({ settlement, currency }) => {
      if (settlement.status === 'pending' || settlement.status === 'declined') return;
      const line = (byCurrency[currency] ??= { made: 0, received: 0 });
      if (settlement.from === uid) line.made += settlement.amount;
      else line.received += settlement.amount;
    });
    return Object.entries(byCurrency);
  }, [rows, uid]);

  const madeTotal = useCombinedTotal(
    uid ?? '',
    totals.map(([currency, line]) => ({ currency, amount: line.made })),
  );
  const receivedTotal = useCombinedTotal(
    uid ?? '',
    totals.map(([currency, line]) => ({ currency, amount: line.received })),
  );

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
        <Text style={styles.headerTitle}>Payments</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          {rows === null && !failed && <ListSkeleton rows={5} rowHeight={72} />}
          {failed && <HelperText tone="error">Could not load your payments.</HelperText>}

          {rows !== null && totals.length > 0 && (
            <View style={styles.totals}>
              {totals.map(([currency, line]) => (
                <View key={currency} style={styles.totalRow}>
                  <View style={styles.totalCell}>
                    <Text style={styles.label}>You paid</Text>
                    <Text style={styles.total}>{formatMoney(line.made, currency)}</Text>
                  </View>
                  <View style={styles.totalCell}>
                    <Text style={styles.label}>You received</Text>
                    <Text style={styles.total}>{formatMoney(line.received, currency)}</Text>
                  </View>
                </View>
              ))}
              {madeTotal && receivedTotal && (
                <View style={[styles.totalRow, styles.combined]}>
                  <View style={styles.totalCell}>
                    <Text style={styles.label}>Paid in total (approx.)</Text>
                    <Text style={styles.total}>{formatMoney(madeTotal.total, madeTotal.currency)}</Text>
                  </View>
                  <View style={styles.totalCell}>
                    <Text style={styles.label}>Received in total (approx.)</Text>
                    <Text style={styles.total}>
                      {formatMoney(receivedTotal.total, receivedTotal.currency)}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {rows !== null && (
            <View style={styles.filters}>
              {FILTERS.map((item) => (
                <Pressable
                  key={item.key}
                  onPress={() => setFilter(item.key)}
                  style={[styles.chip, filter === item.key && styles.chipActive]}
                >
                  <Text style={[styles.chipText, filter === item.key && styles.chipTextActive]}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {rows !== null && shown.length === 0 && (
            <EmptyState
              icon={Receipt}
              title="No payments yet"
              message="Payments you make or receive on any trip show up here."
            />
          )}

          {shown.map(({ settlement, tripId, tripName, currency, otherName, otherPhoto }) => {
            const made = settlement.from === uid;
            const declined = settlement.status === 'declined';
            return (
              <Pressable
                key={`${tripId}-${settlement.id}`}
                style={[styles.card, declined && styles.declined]}
                onPress={() => setOpenKey(`${tripId}-${settlement.id}`)}
              >
                <Avatar name={otherName} size={40} photoURL={otherPhoto} />
                <View style={styles.info}>
                  <Text style={styles.title} numberOfLines={1}>
                    {made ? 'You paid ' : ''}
                    {otherName.split(' ')[0]}
                    {made ? '' : ' paid you'}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {formatDay(settlement.settledOn)} · {tripName}
                    {settlement.isCash === true
                      ? ' · cash'
                      : settlement.method
                        ? ' · ' + settlement.method
                        : ''}
                    {settlement.status === 'pending' ? ' · pending' : ''}
                    {declined ? ' · declined' : ''}
                  </Text>
                </View>
                <Text style={[styles.amount, { color: made ? BrandColors.error : BrandColors.success }]}>
                  {made ? '-' : '+'}
                  {formatMoney(settlement.amount, currency)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <BottomSheet visible={!!detail} title="Payment details" onClose={() => setOpenKey(null)}>
        {detail && (
          <ScrollView contentContainerStyle={styles.detailBody} showsVerticalScrollIndicator={false}>
            <View style={styles.hero}>
              <Text style={styles.heroAmount}>
                {formatMoney(detail.settlement.amount, detail.currency)}
              </Text>
              <View
                style={[
                  styles.pill,
                  detail.settlement.status === 'pending' && { backgroundColor: BrandColors.warningBg },
                  detail.settlement.status === 'declined' && { backgroundColor: BrandColors.errorBg },
                ]}
              >
                <Text
                  style={[
                    styles.pillText,
                    detail.settlement.status === 'pending' && { color: BrandColors.warning },
                    detail.settlement.status === 'declined' && { color: BrandColors.error },
                  ]}
                >
                  {detail.settlement.status === 'pending'
                    ? 'Waiting for confirmation'
                    : detail.settlement.status === 'declined'
                      ? 'Declined'
                      : 'Confirmed'}
                </Text>
              </View>
            </View>

            <View style={styles.people}>
              <View style={styles.person}>
                <Avatar name={detail.fromName} size={44} photoURL={detail.fromPhoto} />
                <Text style={styles.personName} numberOfLines={1}>
                  {detail.fromName.split(' ')[0]}
                </Text>
                <Text style={styles.label}>Paid</Text>
              </View>
              <ArrowRight size={20} color={BrandColors.secondary} />
              <View style={styles.person}>
                <Avatar name={detail.toName} size={44} photoURL={detail.toPhoto} />
                <Text style={styles.personName} numberOfLines={1}>
                  {detail.toName.split(' ')[0]}
                </Text>
                <Text style={styles.label}>Received</Text>
              </View>
            </View>

            <Card style={styles.detailCard}>
              <Line label="Trip" value={detail.tripName} />
              <Line label="Date" value={formatDay(detail.settlement.settledOn)} />
              {!!timeOf(detail.settlement.createdAt) && (
                <Line label="Time" value={timeOf(detail.settlement.createdAt)} />
              )}
              <Line
                label="Type"
                value={detail.settlement.kind === 'full' ? 'Full settlement' : 'Part payment'}
              />
              <Line
                label="Paid with"
                value={detail.settlement.isCash === true ? 'Cash' : detail.settlement.method || '—'}
              />
              {!!detail.settlement.note && <Line label="Note" value={detail.settlement.note} />}
            </Card>

            {!!detail.settlement.proofUrls?.length && (
              <>
                <Text style={styles.label}>Proof of payment</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.proofRow}>
                  {detail.settlement.proofUrls.map((uri) => (
                    <Pressable key={uri} onPress={() => setViewerUri(uri)}>
                      <Image source={{ uri }} style={styles.proofImage} contentFit="cover" />
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            )}

            <Pressable
              style={styles.openTrip}
              onPress={() => {
                const id = detail.tripId;
                setOpenKey(null);
                router.push(`/trips/${id}` as any);
              }}
            >
              <Text style={styles.openTripText}>Open {detail.tripName}</Text>
            </Pressable>
          </ScrollView>
        )}
      </BottomSheet>

      <Modal visible={!!viewerUri} transparent animationType="fade" onRequestClose={() => setViewerUri(null)}>
        <Pressable style={styles.viewer} onPress={() => setViewerUri(null)}>
          {viewerUri && <Image source={{ uri: viewerUri }} style={styles.viewerImage} contentFit="contain" />}
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.line}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.lineValue}>{value}</Text>
    </View>
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
    gap: Spacing.three,
  },
  totals: {
    backgroundColor: BrandColors.surfaceAlt,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 15,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  combined: { borderTopWidth: 1, borderTopColor: BrandColors.border, paddingTop: Spacing.three },
  totalRow: { flexDirection: 'row', gap: Spacing.three },
  totalCell: { flex: 1, gap: Spacing.half },
  label: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 12, color: BrandColors.secondary },
  total: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 18, color: BrandColors.primary },
  filters: { flexDirection: 'row', gap: Spacing.two },
  chip: {
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 20,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  chipActive: { backgroundColor: BrandColors.primary, borderColor: BrandColors.primary },
  chipText: { fontFamily: 'PlusJakartaSans-Medium', fontSize: 13, color: BrandColors.primary },
  chipTextActive: { color: BrandColors.background },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: BrandColors.surfaceAlt,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 15,
    padding: Spacing.three,
  },
  declined: { borderColor: BrandColors.error },
  info: { flex: 1, gap: Spacing.half },
  title: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: BrandColors.primary },
  meta: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 11, color: BrandColors.secondary },
  detailBody: { gap: Spacing.three, paddingBottom: Spacing.four },
  hero: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two },
  heroAmount: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 28, color: BrandColors.primary },
  pill: {
    backgroundColor: BrandColors.successBg,
    borderRadius: 20,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  pillText: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 12, color: BrandColors.success },
  people: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.five },
  person: { alignItems: 'center', gap: Spacing.half, maxWidth: 110 },
  personName: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: BrandColors.primary },
  detailCard: { gap: Spacing.two },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.three },
  lineValue: {
    flexShrink: 1,
    textAlign: 'right',
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    color: BrandColors.primary,
  },
  proofRow: { gap: Spacing.two },
  proofImage: { width: 120, height: 120, borderRadius: 12 },
  openTrip: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 15,
    paddingVertical: Spacing.three,
  },
  openTripText: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: BrandColors.primary },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center' },
  viewerImage: { width: '100%', height: '85%' },
  amount: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14 },
});
