/**
 * The four things you can do inside a trip. Kept in one place so the tab bar
 * and the floating button always agree on what is on screen.
 */

export type TabKey = 'expenses' | 'balances' | 'itinerary' | 'reports';

export const TRIP_TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'expenses', label: 'Expenses' },
  { key: 'balances', label: 'Balances' },
  { key: 'itinerary', label: 'Plan' },
  { key: 'reports', label: 'Reports' },
];
