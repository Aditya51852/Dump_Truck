// src/components/LoadingState.tsx
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
}

export default function LoadingState({ message = 'Loading data...' }: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-5 animate-pulse">
      <div className="h-3 bg-slate-700 rounded w-24 mb-3" />
      <div className="h-7 bg-slate-700 rounded w-16 mb-2" />
      <div className="h-3 bg-slate-700 rounded w-32" />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 bg-slate-800/60 rounded-lg" />
      ))}
    </div>
  );
}
