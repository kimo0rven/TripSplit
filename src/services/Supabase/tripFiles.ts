import { supabase } from '@/config/supabase';
import { STORAGE_BUCKET } from '@/services/Supabase/uploadFile';

/** Every folder a trip's photos are uploaded into (see receiptService). */
const tripFolders = (tripId: string) => [
  `receipts/${tripId}`,
  `itinerary/${tripId}`,
  `notes/${tripId}`,
];

/** Supabase lists one folder level at a time and at most this many entries. */
const PAGE = 1000;

/** Every file path under a folder, walking into sub-folders (a note's own folder). */
const listFiles = async (folder: string, depth = 0): Promise<string[]> => {
  const files: string[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .list(folder, { limit: PAGE, offset });
    if (error) throw error;
    const entries = data ?? [];
    for (const entry of entries) {
      const path = `${folder}/${entry.name}`;
      // A folder comes back with no id; files have one.
      if (!entry.id) {
        if (depth < 3) files.push(...(await listFiles(path, depth + 1)));
      } else {
        files.push(path);
      }
    }
    if (entries.length < PAGE) break;
  }
  return files;
};

/**
 * Deletes every photo a trip uploaded: receipts, payment proofs, plan photos
 * and note photos. Returns how many files went.
 *
 * Best effort by design: the trip itself is already gone when this runs, so a
 * failure here is logged and reported back, never thrown at the person.
 */
export async function deleteTripFiles(
  tripId: string,
): Promise<{ removed: number; failed: boolean }> {
  if (!tripId) return { removed: 0, failed: false };

  let removed = 0;
  let failed = false;
  for (const folder of tripFolders(tripId)) {
    try {
      const files = await listFiles(folder);
      // Removed in batches, so a trip with many photos is not one huge request.
      for (let i = 0; i < files.length; i += 100) {
        const batch = files.slice(i, i + 100);
        const { error } = await supabase.storage.from(STORAGE_BUCKET).remove(batch);
        if (error) throw error;
        removed += batch.length;
      }
    } catch (err) {
      failed = true;
      console.warn(`Could not delete the trip photos in ${folder}:`, err);
    }
  }
  return { removed, failed };
}
