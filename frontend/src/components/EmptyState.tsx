// src/components/EmptyState.tsx
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  message?: string;
  icon?: React.ReactNode;
}

export default function EmptyState({
  title = 'No data found',
  message = 'There is no data available at the moment.',
  icon,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      {icon || <Inbox className="w-12 h-12 text-slate-600" />}
      <h3 className="text-lg font-medium text-slate-300">{title}</h3>
      <p className="text-sm text-slate-500 max-w-md text-center">{message}</p>
    </div>
  );
}
