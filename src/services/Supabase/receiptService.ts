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
 * Uploads a receipt photo and returns its public URL.
 * The file lands under receipts/{tripId}/ so a trip's photos stay together.
 */
export async function uploadReceipt(localUri: string, tripId: string): Promise<string> {
  if (!localUri) throw new Error('No photo was selected.');
  if (!tripId) throw new Error('No trip was selected.');

  const filePath = `receipts/${tripId}/${buildFileName(localUri)}`;
  return uploadLocalFile(localUri, filePath, { optimize: RECEIPT_IMAGE });
}
