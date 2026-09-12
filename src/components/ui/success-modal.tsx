import { BrandColors, Spacing } from '@/constants/theme';
import { Modal, StyleSheet, Text, View } from 'react-native';

type SuccessModalProps = {
  visible: boolean;
  title?: string;
  message?: string;
};

export default function SuccessModal({
  visible,
  title = 'Sign Up Successful!',
  message = 'You will be redirected to the home page',
}: SuccessModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.waitText}>Please wait...</Text>
          <Text style={styles.message}>{message}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.six,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: Spacing.six,
    paddingHorizontal: Spacing.five,
    alignItems: 'center',
    gap: Spacing.two,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: BrandColors.primary,
    textAlign: 'center',
  },
  waitText: {
    fontSize: 15,
    color: BrandColors.secondary,
    textAlign: 'center',
    marginTop: Spacing.one,
  },
  message: {
    fontSize: 14,
    color: BrandColors.secondary,
    textAlign: 'center',
    marginTop: Spacing.one,
  },
});