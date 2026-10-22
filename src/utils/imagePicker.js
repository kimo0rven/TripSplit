import * as ImagePicker from 'expo-image-picker';

/**
 * Photo picking, for receipts and avatars.
 *
 * Both helpers return the same shape so callers handle one thing:
 *   { asset }   - the chosen file
 *   { denied }  - permission was refused
 *   {}          - the person cancelled
 *
 * Receipts only need the file itself (it is uploaded a moment later), so pass
 * `includeBase64: false` to keep memory free on big photos.
 */

/** Opens the camera and returns the shot. */
export async function takePhoto({ quality = 0.7 } = {}) {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return { denied: true };

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality,
    base64: false,
  });

  return result.canceled ? {} : { asset: result.assets[0] };
}

/** Opens the photo library and returns the chosen image. */
/** Pass `multiple: true` to let people choose several; the result then has `assets`. */
export async function pickImage({ includeBase64 = true, quality = 0.8, multiple = false } = {}) {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { denied: true };

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality,
    base64: includeBase64,
    allowsMultipleSelection: multiple,
    selectionLimit: multiple ? 10 : 1,
  });

  if (result.canceled) return {};
  return { asset: result.assets[0], assets: result.assets };
}
