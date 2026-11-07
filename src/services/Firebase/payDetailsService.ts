import { readPath, writeUpdates } from '@/services/offline/offlineStore';
import { buildFileName, uploadLocalFile } from '@/services/Supabase/uploadFile';
import { AVATAR_IMAGE } from '@/services/Supabase/optimizeImage';
import { cleanPayMethods, PayMethod } from '@/utils/payDetails';

/**
 * Payment details live in two places. The person's own copy, which only they
 * can read, and a copy inside each trip they are in, which only that trip's
 * members can read. Account numbers are never readable by anyone outside a
 * trip with you.
 */
const ownPath = (uid: string) => `payDetails/${uid}`;
const tripPath = (tripId: string, uid: string) => `trips/${tripId}/payDetails/${uid}`;

export const fetchMyPayDetails = async (uid: string): Promise<PayMethod[]> =>
  cleanPayMethods(await readPath(ownPath(uid), { preferCache: false }).catch(() => null));

/** How a member of a trip likes to be paid, as they shared it with that trip. */
export const fetchTripPayDetails = async (tripId: string, uid: string): Promise<PayMethod[]> =>
  cleanPayMethods(await readPath(tripPath(tripId, uid)).catch(() => null));

/** Saves the person's details and copies them into every trip they are in. */
export const saveMyPayDetails = async (uid: string, methods: PayMethod[]): Promise<void> => {
  const clean = cleanPayMethods(methods);
  const value = clean.length ? clean : null;
  await writeUpdates({ [ownPath(uid)]: value });

  const trips = (await readPath(`userTrips/${uid}`).catch(() => null)) as Record<
    string,
    unknown
  > | null;
  // One trip at a time, so a trip that refuses (closed, left) does not stop the rest.
  for (const tripId of Object.keys(trips ?? {})) {
    await writeUpdates({ [tripPath(tripId, uid)]: value }).catch((err) =>
      console.warn('Could not share payment details with a trip:', err),
    );
  }
};

/**
 * Makes sure a trip has this person's current details: someone who joined a
 * trip after saving them gets them copied in when they open it.
 */
export const publishPayDetailsTo = async (tripId: string, uid: string): Promise<void> => {
  try {
    const [mine, shared] = await Promise.all([
      fetchMyPayDetails(uid),
      fetchTripPayDetails(tripId, uid),
    ]);
    if (JSON.stringify(mine) !== JSON.stringify(shared)) {
      await writeUpdates({ [tripPath(tripId, uid)]: mine.length ? mine : null });
    }
  } catch (err) {
    console.warn('Could not share payment details with the trip:', err);
  }
};

/** Uploads a picture of a payment QR and returns its link. */
export const uploadPayQr = async (localUri: string, uid: string): Promise<string> =>
  uploadLocalFile(localUri, `${uid}/pay-qr-${buildFileName(localUri)}`, {
    optimize: { ...AVATAR_IMAGE, maxSize: 1024 },
  });
