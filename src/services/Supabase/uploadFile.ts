import { supabase } from '@/config/supabase';
import { OptimizeOptions, optimizeImage } from '@/services/Supabase/optimizeImage';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

/**
 * Everything we upload (avatars, receipts) goes into this one Supabase bucket.
 */
export const STORAGE_BUCKET = 'TripSplit';

/** About ten years, so a saved receipt link effectively never expires. */
const SIGNED_URL_SECONDS = 60 * 60 * 24 * 365 * 10;

const KNOWN_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'gif'];

/** Reads the "image/png" part of a `data:image/png;base64,...` URI. */
function mimeFromDataUri(uri: string): string | undefined {
  return /^data:([^;,]+)[;,]/.exec(uri)?.[1];
}

/** Last bit of a file path, e.g. "photo.png" from "file:///tmp/photo.png". */
function extensionFromUri(uri: string): string {
  const match = /\.([a-zA-Z0-9]+)(?:\?|$)/.exec(uri || '');
  const extension = (match?.[1] || '').toLowerCase();
  return KNOWN_EXTENSIONS.includes(extension) ? extension : 'jpg';
}

function contentTypeFromExtension(extension: string): string {
  switch (extension) {
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'heic':
      return 'image/heic';
    case 'gif':
      return 'image/gif';
    default:
      return 'image/jpeg';
  }
}

function extensionFromContentType(contentType: string): string {
  switch (contentType) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/heic':
      return 'heic';
    case 'image/gif':
      return 'gif';
    default:
      return 'jpg';
  }
}

/**
 * Reads a picked file and returns the bytes plus the type to store it as.
 *
 * Browsers cannot use expo-file-system, so on web we let `fetch` read the
 * picked URI (a `data:` or `blob:` URI) into a Blob instead.
 */
async function readLocalFile(localUri: string): Promise<{
  body: Blob | ArrayBuffer;
  contentType: string;
}> {
  const dataMime = mimeFromDataUri(localUri);

  if (Platform.OS === 'web') {
    const response = await fetch(localUri);
    const blob = await response.blob();
    return {
      body: blob,
      contentType: blob.type || dataMime || 'image/jpeg',
    };
  }

  const file = new File(localUri);
  return {
    body: await file.arrayBuffer(),
    contentType: dataMime || contentTypeFromExtension(extensionFromUri(localUri)),
  };
}

/**
 * Uploads a local file (a photo picked on the phone, or a data/blob URI in a
 * browser) to the storage bucket and returns its public URL.
 */
export async function uploadLocalFile(
  localUri: string,
  filePath: string,
  options: { cacheBust?: boolean; optimize?: OptimizeOptions } = {},
): Promise<string> {
  if (!localUri) throw new Error('No file was selected.');

  let source = localUri;
  let path = filePath;
  const isGif = mimeFromDataUri(localUri) === 'image/gif' || extensionFromUri(localUri) === 'gif';
  if (options.optimize && !isGif) {
    const result = await optimizeImage(localUri, options.optimize);
    if (result.optimized) {
      source = result.uri;
      // The result is always a JPEG, so the stored name has to say so.
      path = filePath.replace(/\.[a-zA-Z0-9]+$/, '.jpg');
    }
  }

  const { body, contentType } = await readLocalFile(source);

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, body, { contentType, upsert: true });

  if (error) throw error;

  // The bucket is private, so a plain public link would not load. A long-lived
  // signed link works whether or not the bucket is made public later.
  const { data, error: signError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECONDS);
  if (signError || !data?.signedUrl) {
    throw signError ?? new Error('Could not get a link for that file.');
  }

  return options.cacheBust ? `${data.signedUrl}&t=${Date.now()}` : data.signedUrl;
}

/** Builds a unique, safe file name such as `1730000000-a1b2c3.jpg`. */
export function buildFileName(localUri: string, contentType?: string): string {
  const extension = contentType
    ? extensionFromContentType(contentType)
    : extensionFromUri(localUri);
  const random = Math.random().toString(36).slice(2, 8);
  return `${Date.now()}-${random}.${extension}`;
}
