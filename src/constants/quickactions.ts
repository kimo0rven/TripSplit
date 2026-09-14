import { Banknote, Camera, LucideIcon, Plus, UserPlus } from 'lucide-react-native';
import { BrandColors } from './theme';

export interface QuickAction {
  id: string;
  label: string;
  Icon: LucideIcon;
  onPress: () => void;
  btnColor: string;
}

export const quickactions: QuickAction[] = [
  {
    id: 'add-expense',
    label: 'Add expense',
    Icon: Plus,
    onPress: () => console.log('Add expense'),
    btnColor: BrandColors.base50,
  },
  {
    id: 'settle-up',
    label: 'Settle up',
    Icon: Banknote,
    onPress: () => console.log('Settle up'),
    btnColor: BrandColors.secondary,
  },
  {
    id: 'receipt',
    label: 'Receipt',
    Icon: Camera,
    onPress: () => console.log('Receipt'),
    btnColor: BrandColors.secondary,
  },
  {
    id: 'invite',
    label: 'Invite',
    Icon: UserPlus,
    onPress: () => console.log('Invite'),
    btnColor: BrandColors.secondary,
  },
];