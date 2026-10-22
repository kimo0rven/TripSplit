import { BrandColors, Spacing } from '@/constants/theme';
import { Trip } from '@/types/trips';
import { todayKey } from '@/utils/money';
import { Plus } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

interface TripChipsProps {
  trips: Trip[];
  activeId?: string;
  onSelect: (tripId: string) => void;
  onNew: () => void;
}

/** A trip that has already ended is left out. Trips without dates can't be judged, so they stay. */
const isCurrent = (trip: Trip, today: string) => {
  const last = trip.endDate || trip.startDate;
  return !last || last >= today;
};

/** A quick way to switch the dashboard between trips. */
export default function TripChips({ trips, activeId, onSelect, onNew }: TripChipsProps) {
  const today = todayKey();
  const shown = trips.filter((trip) => trip.id === activeId || isCurrent(trip, today));

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {shown.map((trip) => {
        const active = trip.id === activeId;
        return (
          <Pressable
            key={trip.id}
            onPress={() => onSelect(trip.id)}
            style={[styles.chip, active && styles.chipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.text, active && styles.textActive]} numberOfLines={1}>
              {trip.name}
            </Text>
          </Pressable>
        );
      })}
      <Pressable onPress={onNew} style={[styles.chip, styles.newChip]} accessibilityRole="button">
        <Plus size={14} color={BrandColors.primary} />
        <Text style={styles.text}>New trip</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: Spacing.two, paddingVertical: Spacing.one },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    maxWidth: 160,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 20,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  chipActive: { backgroundColor: BrandColors.primary, borderColor: BrandColors.primary },
  newChip: { borderStyle: 'dashed' },
  text: { fontFamily: 'PlusJakartaSans-Medium', fontSize: 13, color: BrandColors.primary },
  textActive: { color: BrandColors.background },
});
