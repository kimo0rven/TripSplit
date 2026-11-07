import PrimaryButton from '@/components/Button/primary-button';
import { switchColors } from '@/components/settings/settings-rows';
import CurrencyField from '@/components/ui/currency-field';
import BottomSheet from '@/components/ui/bottom-sheet';
import { HelperText } from '@/components/ui/card';
import { TextField } from '@/components/ui/text-input-field';
import TripDatesField from '@/components/ui/trip-dates-field';
import TripIconPicker from '@/components/ui/trip-icon-picker';
import { TripIconBadge } from '@/components/ui/trip-icon';
import { DEFAULT_TRIP_COLOR } from '@/constants/trip-colors';
import { DEFAULT_TRIP_ICON } from '@/constants/trip-icons';
import { BrandColors, Spacing } from '@/constants/theme';
import { updateTripSettings } from '@/services/Firebase/tripService';
import { convertTripCurrency } from '@/services/Firebase/currencyChangeService';
import { fetchRateOn } from '@/services/currency/rates';
import TabSlider from '@/components/ui/tab-slider';
import { cleanRateText, rateText as rateText_ } from '@/utils/foreignAmount';
import { formatMoney, todayKey } from '@/utils/money';
import { Lock, LockOpen, Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

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
  /** Whether the owner lets each new member in by hand right now. */
  currentRequireApproval?: boolean;
  /** Whether money can be recorded before the trip starts right now. */
  currentAllowEarlySpending?: boolean;
  /** True when the trip has expenses or payments, which a new currency would convert. */
  hasMoney?: boolean;
  currentBudget?: number;
  onEditBudget?: () => void;
  /** Asks to delete the whole trip. The screen confirms before anything goes. */
  onDelete?: () => void;
  /** Whether the trip is closed right now. */
  closed?: boolean;
  /** Asks to close or reopen the trip. The screen confirms first. */
  onToggleClosed?: () => void;
  onSaved: (settings: {
    name: string;
    currency: string;
    icon: string;
    iconColor: string;
    startDate: string;
    endDate: string;
    requireApproval: boolean;
    allowEarlySpending: boolean;
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
  currentRequireApproval = false,
  currentAllowEarlySpending = false,
  hasMoney = false,
  currentBudget = 0,
  onEditBudget,
  onDelete,
  closed = false,
  onToggleClosed,
  onSaved,
}: TripSettingsSheetProps) {
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('PHP');
  const [icon, setIcon] = useState(DEFAULT_TRIP_ICON);
  const [iconColor, setIconColor] = useState(DEFAULT_TRIP_COLOR);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [requireApproval, setRequireApproval] = useState(false);
  const [allowEarly, setAllowEarly] = useState(false);
  /** Changing currency on a trip with money in it: convert the amounts, or keep the numbers. */
  const [convert, setConvert] = useState(true);
  const [rateText, setRateText] = useState('');
  const [rateStatus, setRateStatus] = useState<'loading' | 'ready' | 'missing'>('ready');
  const rateNumber = Number(rateText) || 0;

  const chooseCurrency = async (code: string) => {
    setCurrency(code);
    setConvert(true);
    setRateText('');
    if (code === currentCurrency || !hasMoney) return;
    setRateStatus('loading');
    const found = await fetchRateOn(currentCurrency, code, todayKey(), todayKey());
    setRateStatus(found ? 'ready' : 'missing');
    setRateText(found ? rateText_(found.rate) : '');
  };
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
    setRequireApproval(currentRequireApproval);
    setAllowEarly(currentAllowEarlySpending);
    setConvert(true);
    setRateText('');
    setRateStatus('ready');
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
    currentRequireApproval,
    currentAllowEarlySpending,
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
    endDate !== (currentEndDate || '') ||
    requireApproval !== currentRequireApproval ||
    allowEarly !== currentAllowEarlySpending;

  const handleSave = async () => {
    if (!trimmedName || !startDate || saving) return;

    setSaving(true);
    setError('');

    try {
      // Converting writes the new currency with every amount, in one go.
      if (currency !== currentCurrency && hasMoney && convert) {
        if (!rateNumber) throw new Error('Enter the exchange rate to convert at.');
        await convertTripCurrency(tripId, currentCurrency, currency, rateNumber);
      }
      await updateTripSettings(tripId, editorId, {
        name: trimmedName,
        currency,
        icon,
        iconColor,
        startDate,
        endDate,
        requireApproval,
        allowEarlySpending: allowEarly,
      });
      onSaved({
        name: trimmedName,
        currency,
        icon,
        iconColor,
        startDate,
        endDate,
        requireApproval,
        allowEarlySpending: allowEarly,
      });
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

        <CurrencyField
          value={currency}
          onChange={chooseCurrency}
          hint={
            currency !== currentCurrency && hasMoney ? (
              <View style={styles.convertBox}>
                <TabSlider
                  items={CONVERT_TABS}
                  value={convert ? 'convert' : 'keep'}
                  onChange={(value) => setConvert(value === 'convert')}
                />
                {convert ? (
                  <>
                    <View style={styles.rateRow}>
                      <Text style={styles.rateLabel}>1 {currentCurrency} =</Text>
                      <View style={styles.rateInput}>
                        <TextField
                          title=""
                          placeholder={rateStatus === 'loading' ? 'Loading…' : 'Rate'}
                          value={rateText}
                          onChangeText={(text) => setRateText(cleanRateText(text))}
                          keyboardType="numeric"
                        />
                      </View>
                      <Text style={styles.rateLabel}>{currency}</Text>
                    </View>
                    <HelperText tone={rateStatus === 'missing' && !rateNumber ? 'error' : 'muted'}>
                      {rateStatus === 'missing' && !rateNumber
                        ? 'Could not load today’s rate. Type the rate to convert at.'
                        : 'Every expense, payment, the budget and repeating expenses are converted at this rate, and each expense’s log notes the change. Everyone in the trip is told.'}
                    </HelperText>
                  </>
                ) : (
                  <HelperText>
                    Amounts keep their numbers; only the currency shown changes. Use this only if
                    the trip was set to the wrong currency from the start.
                  </HelperText>
                )}
              </View>
            ) : currency !== currentCurrency ? (
              <HelperText>Nothing has been spent yet, so there is nothing to convert.</HelperText>
            ) : undefined
          }
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Before the trip</Text>
          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <Text style={styles.switchTitle}>Allow spending before the trip starts</Text>
              <Text style={styles.switchHint}>
                {allowEarly
                  ? 'Expenses and payments can be recorded any time, for flights, deposits and tickets paid ahead.'
                  : 'Expenses and payments open on the first day of the trip.'}
              </Text>
            </View>
            <Switch
              value={allowEarly}
              onValueChange={setAllowEarly}
              {...switchColors(allowEarly)}
              accessibilityLabel="Allow spending before the trip starts"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Joining</Text>
          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <Text style={styles.switchTitle}>Approve new members</Text>
              <Text style={styles.switchHint}>
                {requireApproval
                  ? 'People with the invite code ask to join, and you let each one in.'
                  : 'Anyone with the invite code joins straight away.'}
              </Text>
            </View>
            <Switch
              value={requireApproval}
              onValueChange={setRequireApproval}
              {...switchColors(requireApproval)}
              accessibilityLabel="Approve new members"
            />
          </View>
        </View>

        <HelperText>
          Everyone in the trip sees the new name and currency. The invite code stays the same, so
          people you already invited can still use it. You can get a new code on the invite page.
        </HelperText>

        {!!onToggleClosed && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{closed ? 'Trip is closed' : 'Close trip'}</Text>
            <Pressable
              style={({ pressed }) => [styles.budgetRow, pressed && styles.pressed]}
              onPress={onToggleClosed}
              disabled={saving}
              accessibilityRole="button"
            >
              <Text style={styles.budgetText}>
                {closed ? 'Reopen this trip' : 'Close this trip'}
              </Text>
              {closed ? (
                <LockOpen size={16} color={BrandColors.primary} />
              ) : (
                <Lock size={16} color={BrandColors.primary} />
              )}
            </Pressable>
            <HelperText>
              {closed
                ? 'Expenses and plans are locked and the invite code is off. Reopening gives the trip a new code.'
                : 'For a finished trip: expenses and plans are locked and the invite code stops working. Payments can still be recorded, so everyone can settle up.'}
            </HelperText>
          </View>
        )}

        {!!onDelete && (
          <View style={styles.dangerZone}>
            <Text style={styles.sectionTitle}>Delete trip</Text>
            <Pressable
              style={({ pressed }) => [styles.deleteRow, pressed && styles.pressed]}
              onPress={onDelete}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Delete this trip"
            >
              <Trash2 size={18} color={BrandColors.error} strokeWidth={2.2} />
              <Text style={styles.deleteText}>Delete this trip</Text>
            </Pressable>
            <HelperText>
              Removes the trip and all its expenses, payments, plans, notes and photos for everyone.
              This cannot be undone.
            </HelperText>
          </View>
        )}
      </ScrollView>
    </BottomSheet>
  );
}

const CONVERT_TABS = [
  { key: 'convert', label: 'Convert amounts' },
  { key: 'keep', label: 'Keep the numbers' },
] as const;

const styles = StyleSheet.create({
  convertBox: { gap: Spacing.two },
  rateRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  rateLabel: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: BrandColors.primary },
  rateInput: { flex: 1 },
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
  dangerZone: {
    gap: Spacing.two,
    marginTop: Spacing.two,
    paddingTop: Spacing.four,
    borderTopWidth: 1,
    borderTopColor: BrandColors.border,
  },
  deleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: BrandColors.errorBg,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  deleteText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 14,
    color: BrandColors.error,
  },
  pressed: {
    opacity: 0.7,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: BrandColors.inputField,
    borderRadius: 15,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  switchText: { flex: 1, gap: 2 },
  switchTitle: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 14, color: BrandColors.primary },
  switchHint: { fontFamily: 'PlusJakartaSans-Regular', fontSize: 12, color: BrandColors.secondary },
  iconHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
