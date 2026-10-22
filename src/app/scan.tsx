import PrimaryButton from '@/components/Button/primary-button';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import { BrandColors, MaxContentWidth, Spacing } from '@/constants/theme';
import { sendFriendRequest } from '@/services/Firebase/friendService';
import { fetchTripPreview, joinTripByCode } from '@/services/Firebase/tripService';
import { useAuth } from '@/services/Firebase/useAuth';
import { TripPreview } from '@/types/trips';
import { parseQrPayload } from '@/utils/qr';
import { pickImage } from '@/utils/imagePicker';
import { CameraView, scanFromURLAsync, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { ImagePlus, ScanLine, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, Platform, StyleSheet, Text, View } from 'react-native';

export default function ScanScreen() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  // A scanned trip QR waits here until the person says yes to joining.
  const [pending, setPending] = useState<TripPreview | null>(null);
  const [pendingCode, setPendingCode] = useState('');

  // A scanned friend QR waits here until the person says yes to adding them.
  const [pendingFriendId, setPendingFriendId] = useState('');

  // The camera fires many scans a second - keep this so one QR is handled once.
  const handledRef = useRef(false);
  const sweep = useRef(new Animated.Value(0)).current;
  const goingUp = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(sweep, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(goingUp, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(sweep, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(goingUp, { toValue: 1, duration: 0, useNativeDriver: true }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [sweep]);

  /** Lets the camera be used again after a cancelled or failed scan. */
  const allowRescan = () => {
    setBusy(false);
    setTimeout(() => {
      handledRef.current = false;
    }, 1500);
  };

  const handleScanned = useCallback(
    async ({ data }: { data: string }) => {
      if (handledRef.current || busy) return;

      if (!currentUser?.uid) {
        setError('You need to be signed in.');
        return;
      }

      const payload = parseQrPayload(data);
      handledRef.current = true;
      setBusy(true);
      setError('');

      try {
        if (payload.type === 'friend') {
          if (payload.uid === currentUser.uid) {
            throw new Error('That is your own QR code.');
          }
          // Ask first - the other person still has to accept the request.
          setPendingFriendId(payload.uid);
          setStatus('');
          setBusy(false);
          return;
        }

        const code = payload.type === 'trip' ? payload.code : '';
        if (!code) {
          throw new Error('That QR code could not be read.');
        }

        // Look the trip up first, so the person can confirm before joining.
        setStatus('Looking up trip…');
        const found = await fetchTripPreview(code);
        if (!found) {
          throw new Error('That trip could not be found. The invite code may have changed.');
        }

        setPending(found);
        setPendingCode(code);
        setStatus('');
        setBusy(false);
      } catch (err: any) {
        console.error('Failed to handle QR:', err);
        setError(err?.message || 'That QR code could not be used.');
        setStatus('');
        allowRescan();
      }
    },
    [busy, currentUser, router],
  );

  /**
   * Reads a QR code out of a picture in the photo library.
   *
   * Same result as pointing the camera at it: the code is handed to the same
   * handler, so a photo of a trip QR joins exactly like a live scan.
   */
  const handlePickFromGallery = async () => {
    if (busy) return;

    setError('');

    try {
      const picked = await pickImage({ includeBase64: false, quality: 1 });

      if (picked.denied) {
        setError('Photo access is off. Turn it on in your phone settings to pick a photo.');
        return;
      }

      const uri = picked.asset?.uri;
      if (!uri) return;

      setBusy(true);
      setStatus('Reading the picture…');

      const results = await scanFromURLAsync(uri, ['qr']);
      const first = results?.[0]?.data;

      if (!first) {
        setStatus('');
        setError('No QR code was found in that picture. Try one that shows the whole code.');
        allowRescan();
        return;
      }

      // The handler sets its own status and errors from here.
      handledRef.current = false;
      setBusy(false);
      setStatus('');
      await handleScanned({ data: first });
    } catch (err: any) {
      console.error('Failed to read a QR from a photo:', err);
      setStatus('');
      setError(
        Platform.OS === 'web'
          ? 'Reading a QR from a photo works on a phone, not in the browser.'
          : 'That picture could not be read.',
      );
      allowRescan();
    }
  };

  /** Sends the friend request for the scanned code, once the person agrees. */
  const handleConfirmFriend = async () => {
    if (!pendingFriendId || !currentUser?.uid || busy) return;

    setBusy(true);
    setStatus('Sending request…');
    setError('');

    try {
      await sendFriendRequest(
        {
          id: currentUser.uid,
          fullname: currentUser.displayName || currentUser.email?.split('@')[0] || 'Someone',
          email: currentUser.email || '',
        },
        pendingFriendId,
      );

      setPendingFriendId('');
      setStatus('Request sent!');
      setTimeout(() => router.replace('/friends' as any), 700);
    } catch (err: any) {
      console.error('Failed to send friend request:', err);
      setPendingFriendId('');
      setStatus('');
      setError(err?.message || 'Could not send that request.');
      allowRescan();
    }
  };

  /** Joins the trip the scanned QR pointed at, once the person agrees. */
  const handleConfirmJoin = async () => {
    if (!pending || !currentUser?.uid || busy) return;

    setBusy(true);
    setStatus('Joining…');
    setError('');

    try {
      const trip = await joinTripByCode(pendingCode, {
        id: currentUser.uid,
        fullname: currentUser.displayName || currentUser.email?.split('@')[0] || 'You',
        email: currentUser.email || '',
        ...(currentUser.photoURL ? { photoURL: currentUser.photoURL } : {}),
      });

      setPending(null);
      router.replace(`/trips/${trip.id}` as any);
    } catch (err: any) {
      console.error('Failed to join trip:', err);
      setPending(null);
      setStatus('');
      setError(err?.message || 'Could not join that trip.');
      allowRescan();
    }
  };

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={BrandColors.base50} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.flex}>
        <View style={styles.topBar}>
          <Pressable
            style={styles.closeButton}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Close the scanner"
            hitSlop={10}
          >
            <X size={20} color={BrandColors.background} />
          </Pressable>
        </View>

        <View style={styles.permissionBox}>
          <View style={styles.iconWrapper}>
            <ScanLine size={32} color={BrandColors.primary} />
          </View>
          <Text style={styles.permissionTitle}>Camera access needed</Text>
          <Text style={styles.permissionText}>
            TripSplit uses your camera to scan a trip's QR code or a friend's code.
          </Text>
          <PrimaryButton
            title="Allow camera"
            onPress={requestPermission}
            buttonColor={BrandColors.base50}
            textColor={BrandColors.primary}
            borderColor={BrandColors.base50}
            borderWidth={0}
          />
          <Pressable onPress={() => router.push('/trips/join' as any)} hitSlop={8}>
            <Text style={styles.orText}>Or enter an invite code instead</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      {/* Grey page with a single close button, so nothing competes with the
          viewfinder in the middle. */}
      <View style={styles.topBar}>
        <Pressable
          style={styles.closeButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Close the scanner"
          hitSlop={10}
        >
          <X size={20} color={BrandColors.background} />
        </Pressable>
      </View>

      <View style={styles.intro}>
        <Text style={styles.heading}>Scan QR code</Text>
        <Text style={styles.subHeading}>Point the camera at a QR code to scan</Text>
      </View>

      <View style={styles.viewfinder}>
        {/* The camera only fills the yellow frame; the rest of the screen stays plain. */}
        <View style={styles.frame}>
          <View style={styles.cameraClip}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={busy || pending ? undefined : handleScanned}
            />
            <Animated.View
              pointerEvents="none"
              style={[
                styles.scanner,
                { transform: [{ translateY: sweep.interpolate({ inputRange: [0, 1], outputRange: [-70, 269] }) }] },
              ]}
            >
              <Animated.View style={{ opacity: Animated.subtract(1, goingUp) }}>
                {Array.from({ length: 14 }).map((_, i) => (
                  <View key={i} style={[styles.trail, { opacity: 0.03 + (i / 13) * 0.3 }]} />
                ))}
              </Animated.View>
              <View style={styles.scanLine} />
              <Animated.View style={{ opacity: goingUp }}>
                {Array.from({ length: 14 }).map((_, i) => (
                  <View key={i} style={[styles.trail, { opacity: 0.33 - (i / 13) * 0.3 }]} />
                ))}
              </Animated.View>
            </Animated.View>
          </View>
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <View style={[styles.corner, styles.cornerTopLeft]} />
            <View style={[styles.corner, styles.cornerTopRight]} />
            <View style={[styles.corner, styles.cornerBottomLeft]} />
            <View style={[styles.corner, styles.cornerBottomRight]} />
          </View>
        </View>

        {!!status && (
          <View style={styles.statusPill}>
            <ActivityIndicator color={BrandColors.background} size="small" />
            <Text style={styles.statusText}>{status}</Text>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        {!!error && <Text style={styles.errorText}>{error}</Text>}

        <View style={styles.footerRow}>
          <Pressable
            style={styles.galleryButton}
            onPress={handlePickFromGallery}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Pick a QR code from your photos"
          >
            <ImagePlus size={20} color={BrandColors.primary} />
            <Text style={styles.galleryText}>Gallery</Text>
          </Pressable>

          <Pressable onPress={() => router.push('/trips/join' as any)} hitSlop={8}>
            <Text style={styles.orText}>Enter a code</Text>
          </Pressable>
        </View>
      </View>

      <ConfirmDialog
        visible={!!pendingFriendId}
        title="Send a friend request?"
        message="They will be added to your friends only after they accept the request."
        confirmLabel="Send request"
        cancelLabel="Not now"
        busy={busy}
        onConfirm={handleConfirmFriend}
        onCancel={() => {
          if (busy) return;
          setPendingFriendId('');
          allowRescan();
        }}
      />

      <ConfirmDialog
        visible={!!pending}
        title={`Join "${pending?.name ?? 'this trip'}"?`}
        message="You will be added to this trip and can see and split its expenses with everyone in it."
        confirmLabel="Join trip"
        cancelLabel="Not now"
        busy={busy}
        onConfirm={handleConfirmJoin}
        onCancel={() => {
          if (busy) return;
          setPending(null);
          allowRescan();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: BrandColors.inputField,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BrandColors.inputField,
  },
  topBar: {
    paddingTop: 40,
    paddingHorizontal: 20,
    alignItems: 'flex-start',
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: BrandColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  intro: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingTop: Spacing.four,
    paddingHorizontal: 25,
  },
  heading: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 22,
    color: BrandColors.primary,
    textAlign: 'center',
  },
  subHeading: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13,
    color: BrandColors.secondary,
    textAlign: 'center',
  },
  viewfinder: {
    flex: 1,
    marginHorizontal: Spacing.five,
    marginVertical: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  frame: {
    width: 280,
    height: 280,
  },
  cameraClip: {
    position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    margin: 4,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  scanner: { position: 'absolute', top: 0, left: 0, right: 0 },
  trail: { height: 5, backgroundColor: BrandColors.base50 },
  scanLine: {
    height: 3,
    borderRadius: 2,
    backgroundColor: BrandColors.base50,
    shadowColor: BrandColors.base50,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  corner: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderColor: BrandColors.base50,
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 16,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 16,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 16,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 16,
  },
  statusPill: {
    position: 'absolute',
    bottom: Spacing.four,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 20,
  },
  statusText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 13,
    color: BrandColors.background,
  },
  footer: {
    paddingHorizontal: 25,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  galleryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: BrandColors.background,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 14,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  galleryText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    color: BrandColors.primary,
  },
  errorText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13,
    color: BrandColors.error,
    textAlign: 'center',
  },
  orText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 13,
    color: BrandColors.info,
  },
  permissionBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: 25,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  iconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: BrandColors.base400,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 22,
    color: BrandColors.primary,
    textAlign: 'center',
  },
  permissionText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    color: BrandColors.secondary,
    textAlign: 'center',
    marginBottom: Spacing.two,
  },
});
