// src/pages/GPSTracking.tsx
import { useMemo, useState } from 'react';
import { Navigation } from 'lucide-react';
import { useVehicles } from '../hooks/useVehicles';
import LiveMap from '../components/LiveMap';
import LoadingState from '../components/LoadingState';
import StatusBadge from '../components/StatusBadge';
import { formatSpeed } from '../utils/formatters';
import { useNavigate } from 'react-router-dom';

export default function GPSTracking() {
  const { vehicleList, loading } = useVehicles();
  const [selectedVehicle, setSelectedVehicle] = useState<string>('');
  const navigate = useNavigate();

  const mapVehicles = useMemo(
    () => vehicleList.map((v) => ({ id: v.id, current: v.current })),
    [vehicleList]
  );

  const filteredMapVehicles = useMemo(() => {
    if (!selectedVehicle) return mapVehicles;
    return mapVehicles.filter((v) => v.id === selectedVehicle);
  }, [mapVehicles, selectedVehicle]);

  if (loading) return <LoadingState message="Loading GPS data..." />;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">GPS Tracking</h1>
          <p className="text-sm text-slate-500 mt-1">Live vehicle positions on map</p>
        </div>
        <select
          value={selectedVehicle}
          onChange={(e) => setSelectedVehicle(e.target.value)}
          className="bg-slate-800/60 border border-slate-700/50 rounded-lg text-sm text-slate-300 px-3 py-2 focus:outline-none focus:border-amber-500/50"
        >
          <option value="">All Vehicles</option>
          {vehicleList.map((v) => (
            <option key={v.id} value={v.id}>{v.id}</option>
          ))}
        </select>
      </div>

      {/* Full-width map */}
      <LiveMap
        vehicles={filteredMapVehicles}
        selectedVehicle={selectedVehicle}
        height="500px"
        onVehicleClick={(id) => navigate(`/vehicle/${id}`)}
      />

      {/* Vehicle GPS table */}
      <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-700/50 flex items-center gap-2">
          <Navigation className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-semibold text-slate-200">Vehicle Positions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Vehicle</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">State</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Latitude</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Longitude</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Altitude</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Speed</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Satellites</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Valid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {vehicleList.map(({ id, current }) => (
                <tr key={id} className="hover:bg-slate-700/20 transition-colors">
                  <td className="px-4 py-2.5 font-semibold text-slate-200">{id}</td>
                  <td className="px-4 py-2.5"><StatusBadge stateName={current.stateName} size="sm" /></td>
                  <td className="px-4 py-2.5 text-slate-300 font-mono text-xs">{current.gps?.latitude?.toFixed(6) ?? '—'}</td>
                  <td className="px-4 py-2.5 text-slate-300 font-mono text-xs">{current.gps?.longitude?.toFixed(6) ?? '—'}</td>
                  <td className="px-4 py-2.5 text-slate-400 font-mono text-xs">{current.gps?.altitude?.toFixed(1) ?? '—'} m</td>
                  <td className="px-4 py-2.5 text-slate-300 font-mono text-xs">{formatSpeed(current.gps?.speedKmph)}</td>
                  <td className="px-4 py-2.5 text-slate-400 text-xs">{current.gps?.satellites ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    {current.gps?.locationValid ? (
                      <span className="text-emerald-400 text-xs">✓ Valid</span>
                    ) : (
                      <span className="text-red-400 text-xs">✕ Invalid</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
