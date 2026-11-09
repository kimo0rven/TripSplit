import { BrandColors } from '@/constants/theme';
import { Text, View } from 'react-native';
import { themedStyles } from '@/constants/themed-styles';

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

const styles = themedStyles(() => ({
  container: {
    paddingVertical: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 24,
    color: BrandColors.primary,
  },
}));
