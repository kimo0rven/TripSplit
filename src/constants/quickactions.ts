import { Banknote, Camera, LucideIcon, Plus, UserPlus } from 'lucide-react-native';
import { BrandColors } from './theme';

/**
 * The four buttons on the dashboard.
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

export const quickactions: QuickAction[] = [
  {
    id: 'add-expense',
    label: 'Add expense',
    Icon: Plus,
    btnColor: BrandColors.base50,
  },
  {
    id: 'settle-up',
    label: 'Settle up',
    Icon: Banknote,
    btnColor: BrandColors.base400,
  },
  {
    id: 'receipt',
    label: 'Receipt',
    Icon: Camera,
    btnColor: BrandColors.base200,
  },
  {
    id: 'invite',
    label: 'Invite',
    Icon: UserPlus,
    btnColor: BrandColors.surfaceAlt,
  },
];
