import back from '@/assets/images/back-button.png';
import { isDarkTheme, Spacing } from '@/constants/theme';
import { Image, Pressable, View } from 'react-native';
import { themedStyles } from '@/constants/themed-styles';

export default function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <View>
      <Pressable onPress={onPress} style={styles.button}>
        <Image style={styles.image} source={back} />
      </Pressable>
    </View>
  );
}

const styles = themedStyles(() => ({
  button: {
    padding: Spacing.two,
  },
  image: {
    width: 30,
    height: 30,
    // The arrow picture is dark; in dark mode it is drawn white instead.
    ...(isDarkTheme() ? { tintColor: '#FFFFFF' } : null),
  },
}));
