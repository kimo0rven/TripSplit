import SquareButton from '@/components/Button/square-button';
import NavBar from '@/components/Navbar/Nav';
import RecentExpenses from '@/components/recent-expenses';
import { quickactions } from '@/constants/quickactions';
import { BrandColors, Spacing } from '@/constants/theme';
import { useAuth } from '@/services/Firebase/useAuth';
import Expense from '@/types/recent-expenses';
import { dateToday, timeOfTheDay } from '@/utils/dates';
import { Settings } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export const DUMMY_EXPENSES: Expense[] = [
  {
    id: 'exp-1',
    purchase: 'Dinner & Drinks',
    purchaseDate: new Date('2026-09-12T19:30:00'),
    payer: "Carla",
    amount: 84.50,
    icon: 'utensils',
  },
  {
    id: 'exp-2',
    purchase: 'Uber to Hotel',
    purchaseDate: new Date('2026-09-11T14:15:00'),
    payer: 'Mike',
    amount: 28.75,
    icon: 'car',
  },
  {
    id: 'exp-80',
    purchase: 'Grocery Run',
    purchaseDate: new Date('2026-09-10T10:00:00'),
    payer: "Carla",
    amount: 62.10,
    icon: 'shopping-bag',
  },
  {
    id: 'exp-31',
    purchase: 'Grocery Run',
    purchaseDate: new Date('2026-09-10T10:00:00'),
    payer: "Carla",
    amount: 62.10,
    icon: 'shopping-bag',
  },
  {
    id: 'exp-33',
    purchase: 'Grocery Run',
    purchaseDate: new Date('2026-09-10T10:00:00'),
    payer: "Carla",
    amount: 62.10,
    icon: 'shopping-bag',
  },
  {
    id: 'exp-4',
    purchase: 'Morning Coffee',
    purchaseDate: new Date('2026-09-09T08:45:00'),
    payer: "Steven",
    amount: 14.20,
    icon: 'coffee',
  },
  {
    id: 'exp-5',
    purchase: 'Museum Tickets',
    purchaseDate: new Date('2026-09-08T11:30:00'),
    payer: 'Joy',
    amount: 45.00,
    icon: 'ticket',
  },
];

const QUICK_ACTIONS = quickactions

export default function HomeScreen() {
    const { currentUser } = useAuth();


    const userName = currentUser?.displayName || 'User';

    return (
        <>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.container}>
                    <TouchableOpacity style={styles.settingsContainer}>
                        <Settings color={BrandColors.primary} size={24} />
                    </TouchableOpacity>

                    <View style={styles.header}>
                        <Text style={styles.dateText}>{dateToday()}</Text>
                        <Text style={styles.title}>
                            {timeOfTheDay()}, <Text style={styles.titleBold}>{userName}</Text>!
                        </Text>
                    </View>

                    <View style={styles.secondSection}>
                        <View style={styles.currentTrip}>
                            <Text style={styles.cardText}>Trip</Text>
                        </View>

                        <View style={styles.debtContainer}>
                            <Text style={styles.owedText}>You're owed PHP 2500</Text>
                        </View>
                    </View>

                    <View style={styles.secondSection}>
                        <View style={styles.homescreenButtonsContainer}>
                        {QUICK_ACTIONS.map((action) => (
                            <TouchableOpacity
                            key={action.id}
                            style={styles.actionItem}
                            activeOpacity={0.7}
                            >
                            <SquareButton
                                title={<action.Icon color={BrandColors.primary} size={24} />}
                                buttonColor={action.btnColor}
                                textColor={BrandColors.primary}
                                borderColor="transparent"
                                borderWidth={0}
                                onPress={action.onPress}
                            />
                            <Text style={styles.actionLabel}>{action.label}</Text>
                            </TouchableOpacity>
                        ))}
                        </View>
                    </View>

                    <View style={styles.recentExpensesContainer}>
                        <View style={styles.recentExpensesHeader}>
                            <Text style={styles.recentExpenseTitle}>Recent Expenses</Text>
                            <Pressable>
                                <Text style={styles.recentExpenseViewAll}>View All</Text>
                            </Pressable>
                        </View>

                        <RecentExpenses limit={5} expenseData={DUMMY_EXPENSES} unit={'PHP'}/>
                    </View>
                </View>
            </ScrollView>
            <NavBar />
        </>
    );
}

const styles = StyleSheet.create({
    scrollContent: {
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
    settingsContainer: {
        alignItems: 'flex-end',
    },
    header: {
        alignItems: 'flex-start',
        gap: Spacing.half,
    },
    dateText: {
        fontFamily: 'PlusJakartaSans-Light',
        fontSize: 14,
        color: BrandColors.secondary,
        letterSpacing: Spacing.half,
    },
    title: {
        fontFamily: 'PlusJakartaSans-Medium',
        color: BrandColors.primary,
        fontSize: 20,
    },
    titleBold: {
        fontFamily: 'PlusJakartaSans-Bold',
    },
    secondSection: {
        flexDirection: 'column',
        gap: Spacing.three,
    },
    currentTrip: {
        backgroundColor: BrandColors.base50,
        padding: 20,
        borderRadius: 15,
    },
    debtContainer: {
        backgroundColor: BrandColors.background,
        borderRadius: 15,
        padding: 30,
        borderWidth: 1,
        borderColor: BrandColors.secondary,
    },
    cardText: {
        fontFamily: 'PlusJakartaSans-Medium',
        color: BrandColors.primary,
    },
    owedText: {
        fontFamily: 'PlusJakartaSans-Bold',
        color: BrandColors.success,
        fontSize: 24,   
    },
    homescreenButtonsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        gap: Spacing.one,
        marginTop: 8,
    },
    actionItem: {
        flex: 1,
        alignItems: 'center',
        gap: 6,
    },
    actionLabel: {
        fontFamily: 'PlusJakartaSans-Medium',
        fontSize: 12,
        textAlign: 'center',
        color: BrandColors.primary,
    },
    recentExpensesContainer: {
        flexDirection: 'column',
        gap: Spacing.two,
    },
    recentExpenseTitle: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 14,
        color: BrandColors.primary,
    },
    recentExpenseViewAll: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 12,
        color: BrandColors.info,
    },
    recentExpensesHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
});