import * as ImagePicker from 'expo-image-picker';

export async function pickImage() {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    alert('Permission to access photos is required!');
    return;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'], 
    quality: 0.8,
    base64: true,
  });

  if (!result.canceled) {
    return result.assets[0];
  }
}