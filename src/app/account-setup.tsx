
import { BrandColors } from '@/constants/theme';
import { StyleSheet, Text, View } from 'react-native';

export default function AccountSetup() {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Set up your account</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: BrandColors.background,
        padding: 24,
    },
    title: {
        color: BrandColors.primary,
        fontSize: 24,
        fontWeight: '700',
    },
});