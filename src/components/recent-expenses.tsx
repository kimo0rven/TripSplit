import { BrandColors, Spacing } from '@/constants/theme';
import Expense from '@/types/recent-expenses';
import { Banknote } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';


interface RecentExpensesProps {
    expenseData: Expense[];
    limit?: number;
    unit: string;
    onExpensePress?: (expense: Expense) => void;
}

export default function RecentExpenses({
    expenseData = [],
    limit,
    unit,
    onExpensePress,
}: RecentExpensesProps) {
    const safeExpenses = Array.isArray(expenseData) ? expenseData : [];
    const displayedExpenses = limit ? safeExpenses.slice(0, limit) : safeExpenses;

    return (
        <View style={styles.container}>
            {displayedExpenses.map((item, index) => (
                <Pressable
                    key={item.id || index}
                    onPress={() => onExpensePress?.(item)}
                    style={({ pressed }) => [
                        styles.expenseCard,
                        { opacity: pressed ? 0.7 : 1 }
                    ]}
                >
                    <View style={styles.leftSection}>
                        <View style={styles.iconContainer}>
                            <Banknote size={24} color={BrandColors.primary} />
                        </View>
                        <View>
                            <Text style={styles.purchaseTitle}>{item.purchase}</Text>
                            <View style={styles.subtitleContainer}>
                                <Text style={styles.subText}>
                                    {new Date(item.purchaseDate).toLocaleDateString()}
                                </Text>
                                <Text style={styles.subText}>Paid by {item.payer}</Text>
                            </View>
                        </View>
                    </View>

                    <Text style={styles.amountText}>
                        {unit} {item.amount.toFixed(2)}
                    </Text>
                </Pressable>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'column',
        gap: 12,
    },
    expenseCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: BrandColors.background,
        borderWidth: 1,
        borderColor: BrandColors.base50,
        padding: 10,
        borderRadius: 15,
    },
    leftSection: {
        gap: Spacing.two,
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        backgroundColor: BrandColors.base400,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        height: 45,
        width: 45,
    },
    purchaseTitle: {
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 12,
        color: BrandColors.primary,
    },
    subtitleContainer: {
        flexDirection: 'row',
        gap: Spacing.two,
    },
    subText: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 10,
        color: BrandColors.secondary,
    },
    amountText: {
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 14,
        color: BrandColors.primary,
    },
});