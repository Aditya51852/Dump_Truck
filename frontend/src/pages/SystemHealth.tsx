// src/pages/SystemHealth.tsx
import { Activity, CheckCircle, XCircle, Wifi, WifiOff } from 'lucide-react';
import { useVehicles } from '../hooks/useVehicles';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';
import { formatRSSI, getSignalStrength } from '../utils/formatters';

function HealthBadge({ healthy }: { healthy: boolean | undefined }) {
  const isHealthy = healthy === true;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
      isHealthy
        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
        : 'bg-red-500/10 text-red-400 border border-red-500/20'
    }`}>
      {isHealthy ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      {isHealthy ? 'Healthy' : 'Fault'}
    </span>
  );
}

function SignalBars({ rssi }: { rssi: number | undefined }) {
  const strength = getSignalStrength(rssi);
  const bars = { excellent: 4, good: 3, fair: 2, weak: 1, none: 0 };
  const count = bars[strength];
  const colors = { excellent: 'bg-emerald-400', good: 'bg-blue-400', fair: 'bg-amber-400', weak: 'bg-red-400', none: 'bg-slate-600' };
  const color = colors[strength];

  return (
    <div className="flex items-end gap-0.5 h-4">
      {[1, 2, 3, 4].map((bar) => (
        <div
          key={bar}
          className={`w-1 rounded-sm ${bar <= count ? color : 'bg-slate-700'}`}
          style={{ height: `${bar * 25}%` }}
        />
      ))}
    </div>
  );
}

export default function SystemHealth() {
  const { vehicleList, loading } = useVehicles();

  if (loading) return <LoadingState message="Loading system health..." />;
  if (vehicleList.length === 0) return <EmptyState title="No vehicles found" message="No vehicles to display health data for." />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">System Health</h1>
        <p className="text-sm text-slate-500 mt-1">Hardware & connectivity status for all vehicles</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {vehicleList.map(({ id, current }) => {
          const system = current.system;
          const allHealthy = system?.mpu6500 && system?.pn532 && system?.rtc && system?.wifi;

          return (
            <div
              key={id}
              className={`bg-slate-800/60 rounded-xl border overflow-hidden transition-all ${
                allHealthy ? 'border-slate-700/50' : 'border-red-500/30'
              }`}
            >
              {/* Header */}
              <div className={`px-5 py-3 border-b flex items-center justify-between ${
                allHealthy ? 'border-slate-700/50' : 'border-red-500/20 bg-red-500/5'
              }`}>
                <div className="flex items-center gap-2">
                  <Activity className={`w-4 h-4 ${allHealthy ? 'text-emerald-400' : 'text-red-400'}`} />
                  <h3 className="text-sm font-bold text-slate-200">{id}</h3>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  allHealthy
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}>
                  {allHealthy ? 'All Systems OK' : 'Issues Detected'}
                </span>
              </div>

              {/* Health Items */}
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">MPU6500 (IMU)</span>
                  <HealthBadge healthy={system?.mpu6500} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">PN532 (NFC Reader)</span>
                  <HealthBadge healthy={system?.pn532} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">RTC (Real-time Clock)</span>
                  <HealthBadge healthy={system?.rtc} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">WiFi</span>
                  <div className="flex items-center gap-2">
                    {system?.wifi ? (
                      <Wifi className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <WifiOff className="w-4 h-4 text-red-400" />
                    )}
                    <HealthBadge healthy={system?.wifi} />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-700/30">
                  <span className="text-sm text-slate-400">WiFi RSSI</span>
                  <div className="flex items-center gap-2">
                    <SignalBars rssi={system?.wifiRSSI} />
                    <span className={`text-xs font-mono font-medium ${
                      getSignalStrength(system?.wifiRSSI) === 'excellent' ? 'text-emerald-400' :
                      getSignalStrength(system?.wifiRSSI) === 'good' ? 'text-blue-400' :
                      getSignalStrength(system?.wifiRSSI) === 'fair' ? 'text-amber-400' :
                      getSignalStrength(system?.wifiRSSI) === 'weak' ? 'text-red-400' : 'text-slate-500'
                    }`}>
                      {formatRSSI(system?.wifiRSSI)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
