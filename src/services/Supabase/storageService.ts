import { supabase } from '@/config/supabase';
import { decode } from 'base64-arraybuffer';
import { File } from 'expo-file-system';

const AVATAR_BUCKET = 'TripSplit';

export async function uploadAvatar(localUri: string, userId: string): Promise<string> {
  if (!localUri) {
    throw new Error('No local file URI provided.');
  }
  if (!userId) {
    throw new Error('No userId provided.');
  }

  try {
    const file = new File(localUri);
    const base64 = await file.base64();

    const extension = localUri.split('.').pop()?.toLowerCase() || 'jpg';
    const contentType = extension === 'png' ? 'image/png' : 'image/jpeg';
    const filePath = `${userId}/avatar.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(filePath, decode(base64), {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(filePath);

    if (!data?.publicUrl) {
      throw new Error('Failed to retrieve public URL after upload.');
    }

    return `${data.publicUrl}?t=${Date.now()}`;
  } catch (error) {
    console.error('Failed to upload avatar:', error);
    throw error;
  }
}