import { navItems } from '@/constants/navigation';
import { BrandColors } from '@/constants/theme';
import { usePathname, useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function NavBar() {
    const router = useRouter();
    const pathname = usePathname();

    return (
        <View style={styles.container}>
            {navItems.map((item) => {
                const isActive = pathname === item.path;
                const activeColor = BrandColors.primary;
                const inactiveColor = BrandColors.secondary;
                const color = isActive ? activeColor : inactiveColor;

                if (item.isCentral) {
                    return (
                        <TouchableOpacity
                            key={item.id}
                            style={styles.scanWrapper}
                            activeOpacity={0.8}
                            disabled={isActive}
                            onPress={() => router.push(item.path as any)}
                        >
                            <View style={[styles.scanContainer, isActive && styles.activeScanContainer]}>
                                <item.Icon color={BrandColors.primary} size={24} />
                            </View>
                        </TouchableOpacity>
                    );
                }

                return (
                    <TouchableOpacity
                        key={item.id}
                        style={styles.navItem}
                        disabled={isActive}
                        onPress={() => router.push(item.path as any)}
                    >
                        <item.Icon color={color} size={22} />
                        <Text style={[styles.title, { color }]}>{item.label}</Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 84,
        backgroundColor: BrandColors.background,
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-around',
        paddingTop: 10,
        paddingBottom: 24,
        borderTopWidth: 1,
        borderTopColor: BrandColors.background,
    },
    navItem: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        flex: 1,
    },
    title: {
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 10,
    },
    scanWrapper: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: -20,
    },
    scanContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: BrandColors.base50,
        width: 52,
        height: 52,
        borderRadius: 26,
    },
    activeScanContainer: {
        borderWidth: 2,
        borderColor: BrandColors.primary,
    },
});