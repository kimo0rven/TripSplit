import { avatarColorFor } from '@/constants/avatar-colors';
import { CAP_CENTER_OFFSET_RATIO } from '@/constants/typography';
import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface AvatarProps {
  name?: string;
  size?: number;
  /** A profile picture. The initial shows instead if it is missing or fails to load. */
  photoURL?: string;
}

/**
 * A circle with the first letter of a name in it.
 *
 * The colour comes from the name, so the same person always wears the same
 * colour in every list - eight colours in all, which is enough to tell a small
 * group apart without any two people matching by accident.
 */
export default function Avatar({ name, size = 40, photoURL }: AvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
  const { background: backgroundColor, foreground } = avatarColorFor(name);
  const fontSize = size * 0.42;

  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor },
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            fontSize,
            color: foreground,
            lineHeight: fontSize * 1.26,
            // The font's own line box leaves more room above a capital than
            // below it, which drags the letter down. This lifts it by exactly
            // that measured amount, so the letter sits truly in the middle.
            transform: [{ translateY: -fontSize * CAP_CENTER_OFFSET_RATIO }],
          },
        ]}
      >
        {initial}
      </Text>
      {!!photoURL && failedUrl !== photoURL && (
        <Image
          source={{ uri: photoURL }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          onError={() => setFailedUrl(photoURL)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  text: {
    fontFamily: 'PlusJakartaSans-Bold',
    textAlign: 'center',
    includeFontPadding: false,
  },
});
