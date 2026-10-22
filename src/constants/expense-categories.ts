import {
  BedDouble,
  Car,
  Ellipsis,
  LucideIcon,
  ShoppingBag,
  Ticket,
  Utensils,
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

const LOOKS: Record<string, CategoryLook> = {
  food: { icon: Utensils, tint: '#C2740E', bg: '#FEF3E7' },
  transport: { icon: Car, tint: '#2F80ED', bg: '#EAF2FE' },
  stay: { icon: BedDouble, tint: '#7B4BD6', bg: '#F2ECFE' },
  activity: { icon: Ticket, tint: '#1E874B', bg: '#E9F9EF' },
  shopping: { icon: ShoppingBag, tint: '#C13F3F', bg: '#FDEDED' },
  other: { icon: Ellipsis, tint: '#6B6B6B', bg: '#F0F0F0' },
};

/** The look for a category, with "other" as the safe answer. */
export const categoryLook = (value?: string): CategoryLook => LOOKS[value ?? ''] ?? LOOKS.other;
