import { callServer } from '@/services/server/appServer';

/**
 * Deletes every photo a trip uploaded: receipts, payment proofs, plan photos
 * and note photos. Returns how many files went.
 *
 * The server does the deleting, and only for a trip that is already gone, so
 * nobody can wipe another trip's photos. Best effort by design: the trip is
 * already deleted when this runs, so a failure is logged, never thrown.
 */
export async function deleteTripFiles(
  tripId: string,
): Promise<{ removed: number; failed: boolean }> {
  if (!tripId) return { removed: 0, failed: false };
  try {
    const { removed } = await callServer<{ removed: number }>(
      '/storage/delete-trip',
      { tripId },
      60_000,
    );
    return { removed: Number(removed) || 0, failed: false };
  } catch (err) {
    console.warn('Could not delete the trip photos:', err);
    return { removed: 0, failed: true };
  }
}
