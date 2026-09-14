import NavBar from '@/components/Navbar/Nav';
import PageHeader from '@/components/ui/page-header';
import { TextfieldLeftIcon } from '@/components/ui/text-input-field';
import { FriendProfile } from '@/constants/friends';
import { BrandColors, Spacing } from '@/constants/theme';
import { fetchUserFriends } from '@/services/Firebase/friendService';
import { useAuth } from '@/services/Firebase/useAuth';
import { Search } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

export default function FriendsScreen() {
    const { currentUser } = useAuth();

    const [searchEmail, setSearchEmail] = useState("")
    const [friends, setFriends] = useState<FriendProfile[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
    const loadFriends = async () => {
        if (!currentUser?.uid) {
        setLoading(false);
        return;
        }

        try {
        const data = await fetchUserFriends(currentUser.uid);
        setFriends(data);
        } catch (error) {
        console.error('Failed to fetch friends:', error);
        } finally {
        setLoading(false);
        }
    };

    loadFriends();
    }, [currentUser?.uid]);
    console.log(friends)

    return (
        <>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.container}>
                    <View>
                        <View>
                            <PageHeader title="Friends" />
                        </View>
                    </View>

                    <View>
                        <TextfieldLeftIcon
                        title={""}
                        placeholder="Search friends"
                        value={searchEmail}
                        onChangeText={setSearchEmail}
                        leftIcon={Search}
                        />
                    </View>

                    <View>
                        
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
