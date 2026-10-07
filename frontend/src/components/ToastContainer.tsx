// src/components/ToastContainer.tsx
import { X, Info, CheckCircle, AlertTriangle, AlertOctagon } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { getRelativeTime } from '../utils/formatters';

const iconMap = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: AlertOctagon,
};

const colorMap = {
  info: 'border-blue-500/40 bg-blue-500/10',
  success: 'border-emerald-500/40 bg-emerald-500/10',
  warning: 'border-amber-500/40 bg-amber-500/10',
  error: 'border-red-500/40 bg-red-500/10',
};

const iconColorMap = {
  info: 'text-blue-400',
  success: 'text-emerald-400',
  warning: 'text-amber-400',
  error: 'text-red-400',
};

export default function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => {
        const Icon = iconMap[toast.type];
        return (
          <div
            key={toast.id}
            className={`flex items-start gap-3 p-3 rounded-xl border backdrop-blur-xl shadow-2xl animate-slide-in ${colorMap[toast.type]}`}
          >
            <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${iconColorMap[toast.type]}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-200">{toast.title}</p>
              <p className="text-xs text-slate-400 mt-0.5 truncate">{toast.message}</p>
              <p className="text-xs text-slate-500 mt-1">
                {getRelativeTime(toast.timestamp)}
              </p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-500 hover:text-slate-300 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
