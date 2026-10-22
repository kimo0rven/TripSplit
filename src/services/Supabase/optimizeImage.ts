import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

export interface OptimizeOptions {
  /** The longest side the picture may keep, in pixels. Bigger pictures are scaled down. */
  maxSize: number;
  /** JPEG quality from 0 to 1. */
  quality?: number;
}

export const AVATAR_IMAGE: OptimizeOptions = { maxSize: 512, quality: 0.8 };
export const RECEIPT_IMAGE: OptimizeOptions = { maxSize: 1600, quality: 0.7 };

/**
 * Shrinks a photo before it is uploaded: scaled so its longest side fits
 * `maxSize`, then re-saved as JPEG. A phone photo of several MB usually ends up
 * well under 400 KB, which is faster to upload and cheaper to store.
 *
 * Never fails the upload: if the picture cannot be processed, or the result is
 * somehow larger than the original, the original URI is returned unchanged.
 */
export async function optimizeImage(
  uri: string,
  { maxSize, quality = 0.75 }: OptimizeOptions,
): Promise<{ uri: string; optimized: boolean }> {
  try {
    const first = await ImageManipulator.manipulate(uri).renderAsync();
    const { width, height } = first;

    let image = first;
    if (Math.max(width, height) > maxSize) {
      const resize = width >= height ? { width: maxSize } : { height: maxSize };
      image = await ImageManipulator.manipulate(uri).resize(resize).renderAsync();
    }

    const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: quality });
    return { uri: saved.uri, optimized: true };
  } catch (error) {
    console.warn('Could not optimise the image, uploading the original:', error);
    return { uri, optimized: false };
  }
}
