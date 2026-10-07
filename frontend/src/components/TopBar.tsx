// src/components/TopBar.tsx
import { Wifi, WifiOff, Clock } from 'lucide-react';
import { useConnection } from '../hooks/useConnection';
import { formatDateTime } from '../utils/formatters';

interface TopBarProps {
  lastFirebaseUpdate: Date | null;
}

export default function TopBar({ lastFirebaseUpdate }: TopBarProps) {
  const { connected } = useConnection();

  return (
    <header className="h-14 bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/50 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        {/* Mobile Logo */}
        <div className="lg:hidden flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <span className="text-white font-bold text-xs">FM</span>
          </div>
          <span className="text-sm font-bold text-slate-200">Fleet Monitor</span>
        </div>

        {/* Desktop title area */}
        <div className="hidden lg:block">
          <h2 className="text-sm font-semibold text-slate-200">
            Dump Truck Fleet Monitoring
          </h2>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Last Firebase Update */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500">
          <Clock className="w-3.5 h-3.5" />
          <span>Last Update: {formatDateTime(lastFirebaseUpdate)}</span>
        </div>

        {/* Firebase Connection Status */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border ${
            connected
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-red-500/10 text-red-400 border-red-500/30'
          }`}
        >
          {connected ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <Wifi className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">LIVE</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <WifiOff className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Disconnected</span>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
