import PrimaryButton from '@/components/Button/primary-button';
import BigButtonOptions from '@/components/ui/big-button-options';
import BottomSheet from '@/components/ui/bottom-sheet';
import { HelperText } from '@/components/ui/card';
import { TextField } from '@/components/ui/text-input-field';
import TripDatesField from '@/components/ui/trip-dates-field';
import TripIconPicker from '@/components/ui/trip-icon-picker';
import { TripIconBadge } from '@/components/ui/trip-icon';
import { currencies } from '@/constants/currencies';
import { DEFAULT_TRIP_COLOR } from '@/constants/trip-colors';
import { DEFAULT_TRIP_ICON } from '@/constants/trip-icons';
import { BrandColors, Spacing } from '@/constants/theme';
import { updateTripSettings } from '@/services/Firebase/tripService';
import { formatMoney } from '@/utils/money';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface TripSettingsSheetProps {
  visible: boolean;
  onClose: () => void;
  tripId: string;
  /** The signed-in owner, checked again by the service before anything is saved. */
  editorId: string;
  /** The name the trip has right now, used to fill the field in. */
  currentName: string;
  /** The currency the trip uses right now. */
  currentCurrency: string;
  /** The icon key the trip wears right now. */
  currentIcon?: string;
  /** The colour key of the icon's square right now. */
  currentIconColor?: string;
  currentStartDate?: string;
  currentEndDate?: string;
  currentBudget?: number;
  onEditBudget?: () => void;
  onSaved: (settings: {
    name: string;
    currency: string;
    icon: string;
    iconColor: string;
    startDate: string;
    endDate: string;
  }) => void;
}

/**
 * The settings an owner can change on a trip: its name and its currency.
 *
 * The screen only shows this to the owner. Changing the currency does not
 * convert the amounts already entered - it only changes the symbol shown - so
 * the sheet says so plainly instead of letting it surprise anyone.
 */
export default function TripSettingsSheet({
  visible,
  onClose,
  tripId,
  editorId,
  currentName,
  currentCurrency,
  currentIcon,
  currentIconColor,
  currentStartDate,
  currentEndDate,
  currentBudget = 0,
  onEditBudget,
  onSaved,
}: TripSettingsSheetProps) {
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('PHP');
  const [icon, setIcon] = useState(DEFAULT_TRIP_ICON);
  const [iconColor, setIconColor] = useState(DEFAULT_TRIP_COLOR);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Start from what the trip has now, every time the sheet is opened.
  useEffect(() => {
    if (!visible) return;
    setName(currentName);
    setCurrency(currentCurrency || 'PHP');
    setIcon(currentIcon || DEFAULT_TRIP_ICON);
    setIconColor(currentIconColor || DEFAULT_TRIP_COLOR);
    setStartDate(currentStartDate || '');
    setEndDate(currentEndDate || '');
    setError('');
    setSaving(false);
  }, [
    visible,
    currentName,
    currentCurrency,
    currentIcon,
    currentIconColor,
    currentStartDate,
    currentEndDate,
  ]);

  const trimmedName = name.trim();
  const savedIcon = currentIcon || DEFAULT_TRIP_ICON;
  const savedColor = currentIconColor || DEFAULT_TRIP_COLOR;
  const changed =
    trimmedName !== currentName ||
    currency !== currentCurrency ||
    icon !== savedIcon ||
    iconColor !== savedColor ||
    startDate !== (currentStartDate || '') ||
    endDate !== (currentEndDate || '');

  const handleSave = async () => {
    if (!trimmedName || !startDate || saving) return;

    setSaving(true);
    setError('');

    try {
      await updateTripSettings(tripId, editorId, {
        name: trimmedName,
        currency,
        icon,
        iconColor,
        startDate,
        endDate,
      });
      onSaved({ name: trimmedName, currency, icon, iconColor, startDate, endDate });
      onClose();
    } catch (err: any) {
      console.error('Failed to save trip settings:', err);
      setError(err?.message || 'Could not save the trip settings.');
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      title="Trip settings"
      onClose={onClose}
      footer={
        <>
          {!!error && <HelperText tone="error">{error}</HelperText>}
          <PrimaryButton
            title={saving ? 'Saving…' : 'Save changes'}
            onPress={handleSave}
            buttonColor={BrandColors.base50}
            textColor={BrandColors.primary}
            borderColor={BrandColors.base50}
            borderWidth={0}
            disabled={!trimmedName || !startDate || saving || !changed}
          />
        </>
      }
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
      >
        <TextField
          title="Trip name"
          placeholder="e.g. Baguio Weekend"
          value={name}
          onChangeText={setName}
        />

        <View style={styles.section}>
          <View style={styles.iconHeader}>
            <Text style={styles.sectionTitle}>Icon and colour</Text>
            <TripIconBadge name={icon} colorKey={iconColor} size={44} />
          </View>
          <TripIconPicker
            value={icon}
            onSelect={setIcon}
            colorValue={iconColor}
            onSelectColor={setIconColor}
          />
        </View>

        <TripDatesField
          startDate={startDate}
          endDate={endDate}
          onChange={(dates) => {
            setStartDate(dates.startDate);
            setEndDate(dates.endDate);
          }}
        />

        {!!onEditBudget && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Trip budget</Text>
            <Pressable style={styles.budgetRow} onPress={onEditBudget} accessibilityRole="button">
              <Text style={styles.budgetText}>
                {currentBudget > 0 ? formatMoney(currentBudget, currentCurrency) : 'No budget set'}
              </Text>
              <Text style={styles.budgetAction}>{currentBudget > 0 ? 'Edit' : 'Set budget'}</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Currency</Text>
          <BigButtonOptions
            choices={currencies}
            selectedValue={currency}
            onSelect={(choice) => setCurrency(choice.value)}
            maxHeight={220}
          />
          {currency !== currentCurrency && (
            <HelperText>
              Amounts already in this trip keep their numbers. Only the currency shown changes.
            </HelperText>
          )}
        </View>

        <HelperText>
          Everyone in the trip sees the new name and currency. The invite code stays the same, so
          people you already invited can still join.
        </HelperText>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: Spacing.four,
    paddingBottom: Spacing.four,
  },
  section: {
    gap: Spacing.two,
  },
  sectionTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    color: BrandColors.primary,
  },
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: BrandColors.base50,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  budgetText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14,
    color: BrandColors.primary,
  },
  budgetAction: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 13,
    color: BrandColors.primary,
  },
  iconHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
