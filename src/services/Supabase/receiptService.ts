import { RECEIPT_IMAGE } from '@/services/Supabase/optimizeImage';
import { buildFileName, uploadLocalFile } from '@/services/Supabase/uploadFile';

/** Uploads a photo for an itinerary plan and returns its public URL. */
export async function uploadItineraryPhoto(localUri: string, tripId: string): Promise<string> {
  if (!localUri) throw new Error('No photo was selected.');
  if (!tripId) throw new Error('No trip was selected.');

  const filePath = `itinerary/${tripId}/${buildFileName(localUri)}`;
  return uploadLocalFile(localUri, filePath, { optimize: RECEIPT_IMAGE });
}

/**
 * Uploads a photo sent with a note, and returns its public URL.
 *
 * A note's photos live under the trip's own note folder so a trip's pictures
 * stay together, with the note key keeping two notes' photos apart.
 */
export async function uploadNotePhoto(
  localUri: string,
  tripId: string,
  noteKey: string,
): Promise<string> {
  if (!localUri) throw new Error('No photo was selected.');
  if (!tripId) throw new Error('No trip was selected.');

  const filePath = `notes/${tripId}/${noteKey}/${buildFileName(localUri)}`;
  return uploadLocalFile(localUri, filePath, { optimize: RECEIPT_IMAGE });
}

/**
 * Uploads a receipt photo and returns its public URL.
 * The file lands under receipts/{tripId}/ so a trip's photos stay together.
 */
export async function uploadReceipt(localUri: string, tripId: string): Promise<string> {
  if (!localUri) throw new Error('No photo was selected.');
  if (!tripId) throw new Error('No trip was selected.');

  const filePath = `receipts/${tripId}/${buildFileName(localUri)}`;
  return uploadLocalFile(localUri, filePath, { optimize: RECEIPT_IMAGE });
}
