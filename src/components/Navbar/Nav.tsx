import { navItems } from '@/constants/navigation';
import { BrandColors, MaxContentWidth, Spacing } from '@/constants/theme';
import { usePathname, useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function NavBar() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  // The bar grows with the home-indicator area, so the labels sit above it
  // instead of behind it. A small floor keeps it from looking cramped on
  // phones that have no indicator at all.
  const bottomInset = Math.max(insets.bottom, 10);

  return (
    <View style={[styles.shell, { paddingBottom: bottomInset }]}>
      <View style={styles.container}>
        {navItems.map((item) => {
          // A tab stays lit on its own sub-pages too, so /profile/payments keeps
          // the Profile tab lit.
          const isActive = pathname === item.path || pathname.startsWith(`${item.path}/`);
          const color = isActive ? BrandColors.heading : BrandColors.secondary;

          const go = () => {
            if (isActive) return;
            router.push(item.path as any);
          };

          if (item.isCentral) {
            return (
              <TouchableOpacity
                key={item.id}
                style={styles.scanWrapper}
                activeOpacity={0.85}
                onPress={go}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                accessibilityState={{ selected: isActive }}
              >
                <View style={[styles.scanContainer, isActive && styles.activeScanContainer]}>
                  <item.Icon color={BrandColors.primary} size={26} />
                </View>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={item.id}
              style={styles.navItem}
              activeOpacity={0.7}
              onPress={go}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: isActive }}
            >
              {/* The lit tab wears a soft amber pill, so the current tab is
                  obvious at a glance instead of just a shade of grey. */}
              <View style={[styles.iconPill, isActive && styles.activeIconPill]}>
                <item.Icon color={color} size={22} />
              </View>
              <Text style={[styles.title, { color }]} numberOfLines={1}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: BrandColors.background,
    paddingTop: 8,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: BrandColors.border,
    // A soft shadow instead of a hard line, so the bar lifts off the page
    // rather than looking like a divider drawn on it.
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 12,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    flex: 1,
  },
  // Fixed width on purpose: `minWidth` let the pill stretch wider than it was
  // tall, and past that point borderRadius 15 stops reaching the middle of the
  // short sides, so the shape read as a rounded rectangle instead of a pill.
  iconPill: {
    width: 54,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  activeIconPill: {
    backgroundColor: BrandColors.base200,
  },
  title: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 10,
  },
  scanWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
  },
  scanContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BrandColors.base50,
    width: 56,
    height: 56,
    borderRadius: 28,
    shadowColor: BrandColors.base700,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  activeScanContainer: {
    borderWidth: 3,
    borderColor: BrandColors.base700,
  },
});
