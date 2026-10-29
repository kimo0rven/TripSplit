import {
  BedDouble,
  Camera,
  Car,
  CarFront,
  CircleParking,
  Fuel,
  Gamepad2,
  Gift,
  HandCoins,
  KeyRound,
  LucideIcon,
  Martini,
  Milestone,
  Package,
  PawPrint,
  Pill,
  Plane,
  Popcorn,
  Receipt,
  ShieldCheck,
  Ship,
  ShoppingBag,
  ShoppingBasket,
  Tag,
  Ticket,
  TicketCheck,
  Utensils,
  WashingMachine,
  Wifi,
} from 'lucide-react-native';

/**
 * One icon and one colour pairing per expense category.
 *
 * Kept apart from the category list itself (`EXPENSE_CATEGORIES` in
 * `utils/balance.ts`) so the maths file stays free of drawing code, and so the
 * form, the expense cards and the dashboard all read the same picture for a
 * category.
 */
export interface CategoryLook {
  icon: LucideIcon;
  /** Colour of the icon itself. */
  tint: string;
  /** Faint background behind the icon, so it reads on a white card. */
  bg: string;
}

/*
  Eight soft tones reused across the list, so twenty-eight categories still
  look like one family rather than a paint chart.
*/
const AMBER = { tint: '#C2740E', bg: '#FEF3E7' };
const BLUE = { tint: '#2F80ED', bg: '#EAF2FE' };
const PURPLE = { tint: '#7B4BD6', bg: '#F2ECFE' };
const GREEN = { tint: '#1E874B', bg: '#E9F9EF' };
const RED = { tint: '#C13F3F', bg: '#FDEDED' };
const TEAL = { tint: '#0F7A8A', bg: '#E6F6F8' };
const PINK = { tint: '#B5347A', bg: '#FDEDF4' };
const GREY = { tint: '#6B6B6B', bg: '#F0F0F0' };

const LOOKS: Record<string, CategoryLook> = {
  food: { icon: Utensils, ...AMBER },
  transport: { icon: Car, ...BLUE },
  stay: { icon: BedDouble, ...PURPLE },
  activity: { icon: Ticket, ...GREEN },
  shopping: { icon: ShoppingBag, ...RED },
  other: { icon: Tag, ...GREY },

  grocery: { icon: ShoppingBasket, ...GREEN },
  snacks: { icon: Popcorn, ...TEAL },
  drinks: { icon: Martini, ...PINK },

  fuel: { icon: Fuel, ...BLUE },
  parking: { icon: CircleParking, ...PURPLE },
  tolls: { icon: Milestone, ...GREY },
  flight: { icon: Plane, ...BLUE },
  boat: { icon: Ship, ...TEAL },
  rental: { icon: CarFront, ...PURPLE },

  rent: { icon: KeyRound, ...AMBER },
  laundry: { icon: WashingMachine, ...BLUE },
  wifi: { icon: Wifi, ...TEAL },

  supplies: { icon: Package, ...GREY },
  medicine: { icon: Pill, ...RED },

  tickets: { icon: TicketCheck, ...GREEN },
  games: { icon: Gamepad2, ...PINK },
  photos: { icon: Camera, ...PURPLE },

  souvenir: { icon: Gift, ...PINK },
  fees: { icon: Receipt, ...GREY },
  tips: { icon: HandCoins, ...GREEN },
  pet: { icon: PawPrint, ...AMBER },
  insurance: { icon: ShieldCheck, ...BLUE },
};

/** The look for a category, with "other" as the safe answer. */
export const categoryLook = (value?: string): CategoryLook => LOOKS[value ?? ''] ?? LOOKS.other;
