import back from '@/assets/images/back-button.png';
import { Spacing } from '@/constants/theme';
import { Image, Pressable, StyleSheet, View } from 'react-native';


export default function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <View>
        <Pressable onPress={onPress} style={styles.button}>
            < Image style={styles.image} source={back} />
        </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
    button: {
        padding: Spacing.two,
    },
    image: {
        width: 30,
        height: 30,
    }
});