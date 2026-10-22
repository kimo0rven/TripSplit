import { AVATAR_IMAGE } from '@/services/Supabase/optimizeImage';
import { buildFileName, uploadLocalFile } from '@/services/Supabase/uploadFile';

/**
 * Uploads the profile photo for a user and returns a public URL.
 * The URL is cache-busted so a re-upload replaces the old picture in the app.
 */
export async function uploadAvatar(localUri: string, userId: string): Promise<string> {
  if (!localUri) throw new Error('No local file URI provided.');
  if (!userId) throw new Error('No userId provided.');

  try {
    const filePath = `${userId}/${buildFileName(localUri)}`;
    return await uploadLocalFile(localUri, filePath, { cacheBust: true, optimize: AVATAR_IMAGE });
  } catch (error) {
    console.error('Failed to upload avatar:', error);
    throw error;
  }
}
