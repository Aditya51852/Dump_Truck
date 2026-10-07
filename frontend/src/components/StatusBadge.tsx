// src/components/StatusBadge.tsx
import { getStateStyle } from '../utils/stateColors';

interface StatusBadgeProps {
  stateName: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function StatusBadge({ stateName, size = 'md' }: StatusBadgeProps) {
  const style = getStateStyle(stateName);
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium border ${style.bg} ${style.text} ${style.border} ${sizeClasses[size]}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot} animate-pulse`} />
      {style.label}
    </span>
  );
}
