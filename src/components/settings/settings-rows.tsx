import { BrandColors, Spacing } from '@/constants/theme';
import { ChevronRight, LucideIcon } from 'lucide-react-native';
import { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

/** A titled group of rows, used on the settings pages. */
export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

/** A row that opens something else. */
export function SettingsRow({
  icon: Icon,
  label,
  hint,
  value,
  onPress,
  destructive,
}: {
  icon: LucideIcon;
  label: string;
  hint?: string;
  value?: string;
  onPress: () => void;
  /** Tints the label red, for rows that throw something away. */
  destructive?: boolean;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress} accessibilityRole="button">
      <Icon size={20} color={destructive ? BrandColors.error : BrandColors.primary} />
      <View style={hint ? styles.rowText : styles.rowLabelWrap}>
        <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>{label}</Text>
        {!!hint && <Text style={styles.rowHint}>{hint}</Text>}
      </View>
      {!!value && <Text style={styles.rowValue}>{value}</Text>}
      <ChevronRight size={18} color={BrandColors.secondary} />
    </Pressable>
  );
}

/** A row with a switch on the right. */
export function SettingsToggleRow({
  icon: Icon,
  label,
  hint,
  value,
  onValueChange,
}: {
  icon?: LucideIcon;
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (on: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      {!!Icon && <Icon size={20} color={BrandColors.primary} />}
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {!!hint && <Text style={styles.rowHint}>{hint}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        {...switchColors(value)}
        accessibilityLabel={label}
      />
    </View>
  );
}

/** Colours for the app's switches, with the web fallback React Native Web needs. */
export const switchColors = (on: boolean) => ({
  trackColor: { false: BrandColors.border, true: BrandColors.base400 },
  thumbColor: on ? BrandColors.base50 : BrandColors.background,
  // React Native Web ignores thumbColor when on and falls back to teal.
  activeThumbColor: BrandColors.base50,
});

const styles = StyleSheet.create({
  section: { gap: Spacing.two },
  sectionTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    color: BrandColors.secondary,
    textTransform: 'uppercase',
  },
  sectionBody: { gap: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: BrandColors.surfaceAlt,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 15,
    padding: Spacing.four,
  },
  rowText: { flex: 1, gap: 2 },
  rowLabelWrap: { flex: 1 },
  rowLabel: { fontFamily: 'PlusJakartaSans-Medium', fontSize: 15, color: BrandColors.primary },
  rowLabelDestructive: { color: BrandColors.error },
  rowHint: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 12, color: BrandColors.secondary },
  rowValue: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 14, color: BrandColors.secondary },
});
