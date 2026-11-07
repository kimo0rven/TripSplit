import { parseReceipt, type ParsedReceipt } from '@/utils/receiptParser';
import { Platform } from 'react-native';

type Extractor = {
  isSupported: boolean;
  extractTextFromImage: (uri: string) => Promise<string[]>;
};

let extractor: Extractor | null | undefined;

/**
 * The on-device text recogniser, loaded on first use.
 *
 * It is a native module: an app built before it was added (or Expo Go, or the
 * web) does not have it, and loading it there throws. Loading it here, inside
 * a try, turns that into "scanning is not available" instead of a crash.
 */
const loadExtractor = (): Extractor | null => {
  if (extractor !== undefined) return extractor;
  if (Platform.OS === 'web') return (extractor = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const module = require('expo-text-extractor') as Extractor;
    extractor = module?.isSupported ? module : null;
  } catch {
    extractor = null;
  }
  return extractor;
};

/** True when this build of the app can read text from photos. */
export const canScanReceipts = (): boolean => loadExtractor() !== null;

/**
 * Reads a receipt photo on the phone itself (Google ML Kit on Android, Apple
 * Vision on iOS): nothing is uploaded, and it works offline.
 *
 * Returns what could be found, which may be nothing. Throws only when this
 * build cannot scan at all.
 */
export async function scanReceipt(uri: string): Promise<ParsedReceipt> {
  const tool = loadExtractor();
  if (!tool) throw new Error('Receipt scanning needs the latest version of the app.');
  const blocks = await tool.extractTextFromImage(uri);
  return parseReceipt(Array.isArray(blocks) ? blocks : []);
}
