import { BrandColors } from '@/constants/theme';
import { StyleSheet, Text, View } from 'react-native';

interface PageHeaderProps {
    title: string;
}

export default function PageHeader({ title }: PageHeaderProps) {
    return (
        <View style={styles.container}>
            <Text style={styles.header}>{title}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingVertical: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },
    header: {
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 24,
        color: BrandColors.primary,
    },
});