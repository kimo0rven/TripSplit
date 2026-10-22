import EmptyState from '@/components/ui/empty-state';
import { AlertCircle } from 'lucide-react-native';

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

/** What a screen shows when its data could not be loaded, with a way to try again. */
export default function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <EmptyState
      icon={AlertCircle}
      title="Something went wrong"
      message={message}
      actionLabel={onRetry ? 'Try again' : undefined}
      onAction={onRetry}
    />
  );
}
