import NavBar from '@/components/Navbar/Nav';
import PageHeader from '@/components/ui/page-header';
import { BrandColors, Spacing } from '@/constants/theme';
import { ScrollView, StyleSheet, View } from 'react-native';

export default function ProfileScreen() {

    return (
        <>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.container}>
                    <View>
                        <View>
                            <PageHeader title="Profile" />
                        </View>
                    </View>

                    
                </View>
            </ScrollView>
            <NavBar />
        </>
    );
}

const styles = StyleSheet.create({
    scrollContent: {
        height: 100,
        paddingBottom: 100,
    },
    container: {
        flex: 1,
        justifyContent: 'flex-start',
        backgroundColor: BrandColors.background,
        paddingTop: 40,
        paddingHorizontal: 25,
        gap: Spacing.five,
    },
    

});
