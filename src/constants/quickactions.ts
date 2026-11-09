import { Banknote, Camera, LucideIcon, Plus, StickyNote, UserPlus } from 'lucide-react-native';
import { BrandColors } from './theme';

/**
 * The five buttons on the dashboard.
 *
 * Only how they look lives here. What each one *does* is decided by the
 * dashboard, because every action needs the trip that is active right then.
 */
export interface QuickAction {
  id: string;
  label: string;
  Icon: LucideIcon;
  btnColor: string;
}

// The colours are read when drawn, so they follow the theme.
export const quickactions: QuickAction[] = [
  {
    id: 'add-expense',
    label: 'Expense',
    Icon: Plus,
    get btnColor() {
      return BrandColors.base50;
    },
  },
  {
    id: 'settle-up',
    label: 'Settle up',
    Icon: Banknote,
    get btnColor() {
      return BrandColors.tint400;
    },
  },
  {
    id: 'receipt',
    label: 'Receipt',
    Icon: Camera,
    get btnColor() {
      return BrandColors.tint200;
    },
  },
  {
    id: 'note',
    label: 'Note',
    Icon: StickyNote,
    get btnColor() {
      return BrandColors.inputField;
    },
  },
  {
    id: 'invite',
    label: 'Invite',
    Icon: UserPlus,
    get btnColor() {
      return BrandColors.surfaceAlt;
    },
  },
];
