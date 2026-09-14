import { Contact, Home, ScanLine, User, UserRoundGroup } from 'lucide-react-native';

export const navItems = [
        {
            id: 'home',
            label: 'Home',
            path: '/homescreen',
            Icon: Home,
        },
        {
            id: 'groups',
            label: 'Groups',
            path: '/groups',
            Icon: UserRoundGroup,
        },
        {
            id: 'scan',
            label: 'Scan',
            path: '/scan',
            Icon: ScanLine,
            isCentral: true,
        },
        {
            id: 'friends',
            label: 'Friends',
            path: '/friends',
            Icon: Contact,
        },
        {
            id: 'profile',
            label: 'Profile',
            path: '/profile',
            Icon: User,
        },
    ];