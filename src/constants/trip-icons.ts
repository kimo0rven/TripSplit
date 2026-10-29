import {
  Bike,
  Car,
  Coffee,
  Compass,
  FerrisWheel,
  Footprints,
  House,
  MapPin,
  Mountain,
  Plane,
  Ship,
  ShoppingBag,
  Sun,
  Tent,
  TrainFront,
  TreePalm,
  Umbrella,
  Waves,
  type LucideIcon,
} from 'lucide-react-native';

/**
 * The pictures a trip can wear, so a list of trips is not a list of identical
 * boxes. Only the key is saved on the trip - the icon itself is looked up here,
 * which keeps the database small and lets the set change later without
 * touching any saved trip.
 */
export interface TripIconChoice {
  key: string;
  label: string;
  Icon: LucideIcon;
}

export const TRIP_ICONS: TripIconChoice[] = [
  { key: 'plane', label: 'Flight', Icon: Plane },
  { key: 'tree-palm', label: 'Beach', Icon: TreePalm },
  { key: 'tent', label: 'Camping', Icon: Tent },
  { key: 'mountain', label: 'Mountain', Icon: Mountain },
  { key: 'car', label: 'Road trip', Icon: Car },
  { key: 'ship', label: 'Boat', Icon: Ship },
  { key: 'train-front', label: 'Train', Icon: TrainFront },
  { key: 'house', label: 'Staycation', Icon: House },
  { key: 'coffee', label: 'Catch-up', Icon: Coffee },
  { key: 'compass', label: 'Adventure', Icon: Compass },
  { key: 'umbrella', label: 'Outdoors', Icon: Umbrella },
  { key: 'shopping-bag', label: 'Shopping', Icon: ShoppingBag },
  { key: 'bike', label: 'Biking', Icon: Bike },
  { key: 'sun', label: 'Summer', Icon: Sun },
  { key: 'waves', label: 'Island', Icon: Waves },
  { key: 'map-pin', label: 'Day trip', Icon: MapPin },
  // The key stays 'camera' though the picture changed: it is saved on trips,
  // and renaming it would make every photo walk fall back to the default icon.
  { key: 'camera', label: 'Photo walk', Icon: Footprints },
  { key: 'ferris-wheel', label: 'Theme park', Icon: FerrisWheel },
];

/** Trips made before icons existed have no key saved, so they get this one. */
export const DEFAULT_TRIP_ICON = 'plane';

/**
 * Finds the icon for a trip.
 *
 * Anything unrecognised falls back to the default rather than throwing: an old
 * trip, or one whose icon was removed from the list above, still has to show
 * something.
 */
export function findTripIcon(key?: string): TripIconChoice {
  return (
    TRIP_ICONS.find((choice) => choice.key === key) ??
    TRIP_ICONS.find((choice) => choice.key === DEFAULT_TRIP_ICON) ??
    TRIP_ICONS[0]
  );
}
