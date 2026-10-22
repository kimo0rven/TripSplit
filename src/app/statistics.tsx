import StatisticsPage from '@/components/profile/statistics-page';
import { useAuth } from '@/services/Firebase/useAuth';

/**
 * Your own numbers: spending, categories and who owes what.
 *
 * Reached from the dashboard's Shortcuts row and from Profile, which is why it
 * is its own page rather than a sheet buried inside another screen.
 */
export default function StatisticsScreen() {
  const { currentUser } = useAuth();
  return <StatisticsPage userId={currentUser?.uid ?? ''} />;
}
