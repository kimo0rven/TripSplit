import { BrandColors, Spacing } from '@/constants/theme';
import { BarChart3, Receipt } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function QuickLinks() {
  const router = useRouter();
  const items = [
    { label: 'Payment history', Icon: Receipt, href: '/profile/payments' },
    { label: 'Statistics', Icon: BarChart3, href: '/profile/statistics' },
  ];
  return (
    <View style={styles.row}>
      {items.map(({ label, Icon, href }) => (
        <Pressable
          key={label}
          style={styles.link}
          onPress={() => router.push(href as any)}
          accessibilityRole="link"
        >
          <Icon size={16} color={BrandColors.primary} />
          <Text style={styles.text}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.two },
  link: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 14,
    paddingVertical: Spacing.three,
  },
  text: { fontFamily: 'PlusJakartaSans-Medium', fontSize: 13, color: BrandColors.primary },
});
