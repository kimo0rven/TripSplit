import PrimaryButton from '@/components/Button/primary-button';
import BottomSheet from '@/components/ui/bottom-sheet';
import QrCode from '@/components/ui/qr-code';
import { BrandColors, Spacing } from '@/constants/theme';
import { buildTripQr } from '@/utils/qr';
import { Copy, Share2 } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

interface TripShareSheetProps {
  visible: boolean;
  onClose: () => void;
  tripName: string;
  inviteCode: string;
  /**
   * Opens the "invite people you know" screen. Left out when the sheet is
   * opened from that same screen, where the button would lead nowhere new.
   */
  onInviteFriends?: () => void;
}

/**
 * The invite code and its QR code, shown only when asked for.
 *
 * These used to sit at the very bottom of the trip screen, where they pushed
 * everything else up and were rarely needed. Now the code lives here, behind
 * one button, and the trip screen stays about spending.
 */
export default function TripShareSheet({
  visible,
  onClose,
  tripName,
  inviteCode,
  onInviteFriends,
}: TripShareSheetProps) {
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    const code = inviteCode || '';
    if (!code) return;

    try {
      // A browser has a clipboard API; a phone does not, so there we share the
      // text instead and let the person paste it where they like.
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        return;
      }
      await shareInvite();
    } catch {
      // Clipboard permissions can be refused; sharing is the fallback.
      await shareInvite();
    }
  };

  const shareInvite = async () => {
    // The link works in any chat app: tapping it opens TripSplit and asks the
    // person to join. The code is there too, in case they prefer typing it.
    const link = inviteCode ? buildTripQr(inviteCode) : '';

    try {
      await Share.share({
        message: link
          ? `Join my trip "${tripName}" on TripSplit: ${link}\nOr type invite code ${inviteCode} in the app.`
          : `Join my trip "${tripName}" on TripSplit. Invite code: ${inviteCode}`,
      });
    } catch (err) {
      console.error('Failed to share invite:', err);
    }
  };

  return (
    <BottomSheet visible={visible} title="Invite to this trip" onClose={onClose}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.hint}>
          Share this code or link. A friend can also scan the QR with their phone's own camera, or
          with the app's Scan tab, to join the trip.
        </Text>

        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>Invite code</Text>
          <Text style={styles.codeValue} selectable>
            {inviteCode || '—'}
          </Text>
        </View>

        <View style={styles.actionRow}>
          <Pressable style={styles.actionButton} onPress={copyCode}>
            <Copy size={16} color={BrandColors.primary} />
            <Text style={styles.actionText}>{copied ? 'Copied' : 'Copy code'}</Text>
          </Pressable>

          <Pressable style={styles.actionButton} onPress={shareInvite}>
            <Share2 size={16} color={BrandColors.primary} />
            <Text style={styles.actionText}>Share</Text>
          </Pressable>
        </View>

        {!!inviteCode && (
          <View style={styles.qrWrapper}>
            <QrCode value={buildTripQr(inviteCode)} size={180} />
          </View>
        )}

        {onInviteFriends && (
          <PrimaryButton
            title="Invite from your friends"
            onPress={() => {
              onClose();
              onInviteFriends();
            }}
            buttonColor={BrandColors.surfaceAlt}
            textColor={BrandColors.primary}
            borderColor={BrandColors.border}
            borderWidth={1}
          />
        )}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.three,
    paddingBottom: Spacing.four,
    alignItems: 'stretch',
  },
  hint: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13,
    lineHeight: 20,
    color: BrandColors.secondary,
  },
  codeCard: {
    backgroundColor: BrandColors.surfaceAlt,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 16,
    paddingVertical: Spacing.four,
    alignItems: 'center',
    gap: Spacing.one,
  },
  codeLabel: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: BrandColors.secondary,
  },
  codeValue: {
    fontFamily: 'PlusJakartaSans-ExtraBold',
    fontSize: 30,
    letterSpacing: 6,
    color: BrandColors.primary,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    backgroundColor: BrandColors.base200,
    borderRadius: 12,
    paddingVertical: Spacing.three,
  },
  actionText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    color: BrandColors.primary,
  },
  qrWrapper: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
});
