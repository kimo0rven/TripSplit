import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

interface SquareButtonProps {
  title: ReactNode;
  onPress: () => void;
  buttonColor: string;
  textColor: string;
  borderColor: string;
  borderWidth: number;
  disabled?: boolean;
}

export default function SquareButton({
    title,
    onPress,
    buttonColor,
    borderColor = 'transparent',
    borderWidth = 0,
}: SquareButtonProps) {
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                styles.button,
                {
                    backgroundColor: buttonColor,
                    borderColor: borderColor,
                    borderWidth: borderWidth,
                    opacity: pressed ? 0.6 : 1,
                    transform: [{ scale: pressed ? 0.96 : 1 }],
                },
            ]}
        >
            {typeof title === 'string' ? (
                <Text style={styles.text}>{title}</Text>
            ) : (
                title
            )}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    button: {
        width: 48,
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    text: {
        fontSize: 14,
        fontWeight: '600',
    },
});