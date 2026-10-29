import Avatar from '@/components/ui/avatar';
import { Card, HelperText } from '@/components/ui/card';
import { BrandColors, Spacing } from '@/constants/theme';
import { TripMember } from '@/types/trips';
import { ROULETTE_HINT, rouletteShares, rouletteSummary } from '@/utils/funExtras';
import { formatMoney, parseAmount } from '@/utils/money';
import { Dices } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

interface SplitRouletteProps {
  members: TripMember[];
  currency: string;
  currentUserId: string;
}

/**
 * A random, deliberately uneven split of a bill, for fun.
 *
 * Nothing here is saved and nothing reaches a balance: this exists to settle a
 * "who buys the next round" argument, not to record money. The hint says so in
 * plain words, because a screen that looks like a split and is not one would be
 * a trap.
 */
export default function SplitRoulette({ members, currency, currentUserId }: SplitRouletteProps) {
  const [amount, setAmount] = useState('');
  const [shares, setShares] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState('');

  const spin = () => {
    const value = parseAmount(amount) / 100;
    if (!value || value <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    if (members.length < 2) {
      setError('A roulette needs at least two people.');
      return;
    }

    setError('');
    setShares(
      rouletteShares(
        value,
        members.map((member) => member.id),
      ),
    );
  };

  const rows = shares
    ? rouletteSummary(shares, members, (value) => formatMoney(value, currency))
    : [];

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <Dices size={16} color={BrandColors.primary} />
        <Text style={styles.title}>Split roulette</Text>
      </View>

      <HelperText>{ROULETTE_HINT}</HelperText>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={(text) => {
            setAmount(text);
            if (error) setError('');
          }}
          placeholder="0.00"
          placeholderTextColor={BrandColors.secondary}
          keyboardType="numeric"
          returnKeyType="done"
          onSubmitEditing={spin}
        />
        <Pressable
          onPress={spin}
          style={({ pressed }) => [styles.spinButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Roll a random split"
        >
          <Text style={styles.spinText}>{shares ? 'Roll again' : 'Roll'}</Text>
        </Pressable>
      </View>

      {!!error && <Text style={styles.error}>{error}</Text>}

      {rows.length > 0 && (
        <View style={styles.list}>
          {rows.map((row) => (
            <View key={row.memberId} style={styles.row}>
              <Avatar
                name={row.name}
                size={26}
                photoURL={members.find((member) => member.id === row.memberId)?.photoURL}
              />
              <Text style={styles.name} numberOfLines={1}>
                {row.name}
                {row.memberId === currentUserId ? ' (you)' : ''}
              </Text>
              <Text style={styles.share}>{row.label}</Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: BrandColors.surfaceAlt,
    gap: Spacing.two,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  title: {
    flex: 1,
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 15,
    color: BrandColors.primary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  input: {
    flex: 1,
    minWidth: 0,
    backgroundColor: BrandColors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BrandColors.border,
    paddingHorizontal: Spacing.three,
    paddingVertical: 9,
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    color: BrandColors.primary,
  },
  spinButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: BrandColors.base50,
  },
  spinText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    color: BrandColors.primary,
  },
  list: {
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: BrandColors.background,
    borderRadius: 12,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  name: {
    flex: 1,
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 13,
    color: BrandColors.primary,
  },
  share: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    color: BrandColors.primary,
  },
  error: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 11,
    color: BrandColors.error,
  },
  pressed: {
    opacity: 0.6,
  },
});
