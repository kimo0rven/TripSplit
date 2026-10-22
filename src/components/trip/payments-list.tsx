import Avatar from '@/components/ui/avatar';
import BottomSheet from '@/components/ui/bottom-sheet';
import { Card } from '@/components/ui/card';
import { BrandColors, Spacing } from '@/constants/theme';
import { Settlement } from '@/types/expenses';
import { TripMember } from '@/types/trips';
import { formatDay, formatMoney } from '@/utils/money';
import { Image } from 'expo-image';
import { ArrowRight, History, Pencil } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface PaymentsListProps {
  settlements: Settlement[];
  members: TripMember[];
  currency: string;
  currentUserId: string;
  onEditSettlement?: (settlement: Settlement) => void;
  onRespond?: (settlement: Settlement, accept: boolean) => void;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const timeOf = (iso?: string): string => {
  const date = iso ? new Date(iso) : null;
  return date && !isNaN(date.getTime())
    ? date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : '';
};

/** Payment rows, plus the details sheet and photo viewer they open. */
export default function PaymentsList({
  settlements,
  members,
  currency,
  currentUserId,
  onEditSettlement,
  onRespond,
}: PaymentsListProps) {
  const router = useRouter();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [viewerUri, setViewerUri] = useState<string | null>(null);

  const detail = settlements.find((item) => item.id === detailId);

  const nameOf = (id: string) =>
    members.find((member) => member.id === id)?.fullname ?? 'Someone who left';
  const photoOf = (id: string) => members.find((member) => member.id === id)?.photoURL;
  const first = (id: string) => nameOf(id).split(' ')[0];

  const renderPayment = (settlement: Settlement) => (
    <View key={settlement.id} style={styles.settlementBlock}>
      <Pressable onPress={() => setDetailId(settlement.id)} accessibilityRole="button">
        <Card
          style={[styles.settlementRow, settlement.status === 'declined' && styles.declinedCard]}
        >
          <Avatar name={nameOf(settlement.from)} size={34} photoURL={photoOf(settlement.from)} />
          <View style={styles.settlementInfo}>
            <Text style={styles.settlementText} numberOfLines={1}>
              {first(settlement.from)} paid {first(settlement.to)}
            </Text>
            <Text style={styles.settlementMeta}>
              {formatDay(settlement.settledOn)} ·{' '}
              {settlement.kind === 'full' ? 'full settlement' : 'part payment'}
              {settlement.isCash === true
                ? ' · cash'
                : settlement.method
                  ? ' · ' + settlement.method
                  : ''}
            </Text>
          </View>
          <Text style={styles.settlementAmount}>{formatMoney(settlement.amount, currency)}</Text>
        </Card>
      </Pressable>
      {settlement.status === 'pending' && (
        <View style={styles.pendingBox}>
          <Text style={styles.pendingText}>
            {settlement.to === currentUserId
              ? first(settlement.from) + ' says they paid you. Did you receive it?'
              : 'Waiting for ' + first(settlement.to) + ' to confirm. Not counted yet.'}
          </Text>
          {settlement.to === currentUserId && !!onRespond && (
            <View style={styles.pendingButtons}>
              <Pressable style={styles.confirmBtn} onPress={() => onRespond(settlement, true)}>
                <Text style={styles.confirmText}>Confirm</Text>
              </Pressable>
              <Pressable style={styles.declineBtn} onPress={() => onRespond(settlement, false)}>
                <Text style={styles.declineText}>Decline</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
    </View>
  );

  return (
    <>
      <View style={styles.list}>{settlements.map(renderPayment)}</View>

      <BottomSheet visible={!!detail} title="Payment details" onClose={() => setDetailId(null)}>
        {detail && (
          <ScrollView
            contentContainerStyle={styles.detailBody}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.detailHero}>
              <Text style={styles.detailAmount}>{formatMoney(detail.amount, currency)}</Text>
              <View
                style={[
                  styles.statusPill,
                  detail.status === 'pending' && { backgroundColor: BrandColors.warningBg },
                  detail.status === 'declined' && { backgroundColor: BrandColors.errorBg },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    detail.status === 'pending' && { color: BrandColors.warning },
                    detail.status === 'declined' && { color: BrandColors.error },
                  ]}
                >
                  {detail.status === 'pending'
                    ? 'Waiting for confirmation'
                    : detail.status === 'declined'
                      ? 'Declined'
                      : 'Confirmed'}
                </Text>
              </View>
            </View>

            <View style={styles.detailPeople}>
              <View style={styles.person}>
                <Avatar name={nameOf(detail.from)} size={44} photoURL={photoOf(detail.from)} />
                <Text style={styles.personName} numberOfLines={1}>
                  {first(detail.from)}
                </Text>
                <Text style={styles.personRole}>Paid</Text>
              </View>
              <ArrowRight size={20} color={BrandColors.secondary} />
              <View style={styles.person}>
                <Avatar name={nameOf(detail.to)} size={44} photoURL={photoOf(detail.to)} />
                <Text style={styles.personName} numberOfLines={1}>
                  {first(detail.to)}
                </Text>
                <Text style={styles.personRole}>Received</Text>
              </View>
            </View>

            <Card style={styles.detailCard}>
              <DetailRow label="Date" value={formatDay(detail.settledOn)} />
              {!!timeOf(detail.createdAt) && (
                <DetailRow label="Time" value={timeOf(detail.createdAt)} />
              )}
              <DetailRow
                label="Type"
                value={detail.kind === 'full' ? 'Full settlement' : 'Part payment'}
              />
              <DetailRow
                label="Paid with"
                value={detail.isCash === true ? 'Cash' : detail.method || '—'}
              />
              {!!detail.note && <DetailRow label="Note" value={detail.note} />}
            </Card>

            {!!detail.proofUrls?.length && <Text style={styles.detailLabel}>Proof of payment</Text>}
            {!!detail.proofUrls?.length && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.proofRow}
              >
                {detail.proofUrls.map((uri) => (
                  <Pressable key={uri} onPress={() => setViewerUri(uri)}>
                    <Image source={{ uri }} style={styles.detailImage} contentFit="cover" />
                  </Pressable>
                ))}
              </ScrollView>
            )}
            {/* Either side of a payment can fix it: the person who handed the
                money over and the person who received it are both party to it,
                so neither has to wait for the other. */}
            {!!onEditSettlement &&
              (detail.createdBy === currentUserId ||
                detail.from === currentUserId ||
                detail.to === currentUserId) && (
                <Pressable
                  style={styles.editButton}
                  onPress={() => {
                    setDetailId(null);
                    onEditSettlement(detail);
                  }}
                >
                  <Pencil size={14} color={BrandColors.primary} />
                  <Text style={styles.editText}>Edit payment</Text>
                </Pressable>
              )}
            {/* The whole log has its own page, so this stays a way in. */}
            {!!detail.history?.length && (
              <Pressable
                style={styles.logLink}
                onPress={() =>
                  router.push({
                    pathname: '/edit-log',
                    params: {
                      title: 'Payment',
                      subtitle: `${first(detail.from)} → ${first(detail.to)} · ${formatMoney(
                        detail.amount,
                        currency,
                      )}`,
                      history: JSON.stringify(detail.history),
                    },
                  } as any)
                }
                accessibilityRole="link"
                accessibilityLabel="Open the edit log"
              >
                <History size={15} color={BrandColors.info} />
                <Text style={styles.logLinkText}>
                  Edit log ({detail.history.length}{' '}
                  {detail.history.length === 1 ? 'change' : 'changes'})
                </Text>
              </Pressable>
            )}
          </ScrollView>
        )}
      </BottomSheet>

      <Modal
        visible={!!viewerUri}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerUri(null)}
      >
        <Pressable style={styles.viewer} onPress={() => setViewerUri(null)}>
          {viewerUri && (
            <Image source={{ uri: viewerUri }} style={styles.viewerImage} contentFit="contain" />
          )}
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.two },
  pendingBox: {
    gap: Spacing.two,
    backgroundColor: BrandColors.infoBg,
    borderRadius: 12,
    padding: Spacing.three,
  },
  pendingText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: BrandColors.primary,
  },
  pendingButtons: { flexDirection: 'row', gap: Spacing.two },
  confirmBtn: {
    backgroundColor: BrandColors.base50,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  confirmText: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 12, color: BrandColors.primary },
  declineBtn: {
    borderWidth: 1,
    borderColor: BrandColors.error,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  declineText: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 12, color: BrandColors.error },
  settlementBlock: { gap: Spacing.one },
  declinedCard: { borderColor: BrandColors.error, borderWidth: 1 },
  detailHero: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two },
  statusPill: {
    backgroundColor: BrandColors.successBg,
    borderRadius: 20,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  statusText: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 12, color: BrandColors.success },
  detailPeople: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.five,
  },
  person: { alignItems: 'center', gap: Spacing.half, maxWidth: 110 },
  personName: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: BrandColors.primary },
  personRole: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 11, color: BrandColors.secondary },
  detailCard: { gap: Spacing.two },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.three },
  detailLabel: { fontFamily: 'PlusJakartaSans-Medium', fontSize: 13, color: BrandColors.secondary },
  detailValue: {
    flexShrink: 1,
    textAlign: 'right',
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    color: BrandColors.primary,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 15,
    paddingVertical: Spacing.three,
  },
  logLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  logLinkText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 13,
    color: BrandColors.info,
  },
  editText: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: BrandColors.primary },
  detailBody: { gap: Spacing.two, paddingBottom: Spacing.four },
  detailAmount: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 28, color: BrandColors.primary },
  proofRow: { gap: Spacing.two },
  detailImage: { width: 120, height: 120, borderRadius: 12 },
  viewer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerImage: { width: '100%', height: '100%' },
  settlementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  settlementInfo: {
    flex: 1,
    gap: 1,
  },
  settlementText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: BrandColors.primary,
  },
  settlementMeta: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 10,
    color: BrandColors.secondary,
  },
  settlementAmount: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 12,
    color: BrandColors.success,
  },
});
