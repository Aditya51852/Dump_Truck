// src/pages/Dashboard.tsx
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Truck,
  Play,
  Shovel,
  PackageCheck,
  ParkingSquare,
  UserCheck,
  WifiOff,
  ArrowRight,
  Activity,
  Navigation,
  Compass,
  Clock,
  MapPin,
  CheckCircle2,
  Route as RouteIcon,
} from 'lucide-react';
import { useVehicles } from '../hooks/useVehicles';
import { useAllEvents } from '../hooks/useVehicleEvents';
import { useTripsAndAnalytics } from '../hooks/useTripsAndAnalytics';
import LiveMap from '../components/LiveMap';
import StatusBadge from '../components/StatusBadge';
import { SkeletonCard } from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import { formatSpeed, formatEventName } from '../utils/formatters';
import { getEventColor } from '../utils/stateColors';

function formatDurationSec(sec = 0): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatClockTime(epoch?: number): string {
  if (!epoch) return '—';
  const d = new Date(epoch * 1000);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function Dashboard() {
  const { vehicles, vehicleList, fleetSummary, loading, error } = useVehicles();
  const vehicleIds = useMemo(() => Object.keys(vehicles), [vehicles]);
  const [selectedVehicle, setSelectedVehicle] = useState('DUMPER_001');

  const activeVehicleId = vehicleIds.includes(selectedVehicle)
    ? selectedVehicle
    : (vehicleIds[0] || 'DUMPER_001');

  const {
    activeTrip,
    todayTripsCount,
    currentSession,
    routeAnalytics,
  } = useTripsAndAnalytics(activeVehicleId);

  const { events: recentEvents } = useAllEvents(vehicleIds, 10);
  const navigate = useNavigate();

  const selectedVehicleData = vehicles[activeVehicleId]?.current;

  if (error) return <ErrorState message={error.message} />;

  const summaryCards = [
    { label: 'Total Vehicles', value: fleetSummary.total, icon: Truck, color: 'from-blue-500 to-blue-600', textColor: 'text-blue-400' },
    { label: 'Running', value: fleetSummary.running + fleetSummary.toExcavator, icon: Play, color: 'from-emerald-500 to-emerald-600', textColor: 'text-emerald-400' },
    { label: 'At Excavator', value: fleetSummary.atExcavator, icon: Shovel, color: 'from-orange-500 to-orange-600', textColor: 'text-orange-400' },
    { label: 'At Dumping', value: fleetSummary.atDumping, icon: PackageCheck, color: 'from-green-500 to-green-600', textColor: 'text-green-400' },
    { label: 'Parked', value: fleetSummary.parked, icon: ParkingSquare, color: 'from-slate-500 to-slate-600', textColor: 'text-slate-400' },
    { label: 'Drivers Assigned', value: fleetSummary.driverAssigned, icon: UserCheck, color: 'from-violet-500 to-violet-600', textColor: 'text-violet-400' },
    { label: 'Offline / Warning', value: fleetSummary.offline, icon: WifiOff, color: 'from-red-500 to-red-600', textColor: 'text-red-400' },
  ];

  const mapVehicles = vehicleList.map((v) => ({ id: v.id, current: v.current }));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Fleet Overview & Route Operations</h1>
          <p className="text-sm text-slate-500 mt-1">Real-time Parking-to-Parking monitoring dashboard</p>
        </div>
        {vehicleIds.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Focus Vehicle:</span>
            <select
              value={activeVehicleId}
              onChange={(e) => setSelectedVehicle(e.target.value)}
              className="bg-slate-800/80 border border-slate-700 rounded-lg text-xs text-slate-200 px-3 py-1.5 focus:outline-none focus:border-amber-500"
            >
              {vehicleIds.map((id) => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Fleet Summary Cards */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-4 hover:border-slate-600/50 transition-all duration-200 group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  {card.label}
                </span>
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${card.color} flex items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity`}>
                  <card.icon className="w-4 h-4 text-white" />
                </div>
              </div>
              <p className={`text-3xl font-bold ${card.textColor}`}>{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* REALTIME PARKING-TO-PARKING OPERATIONAL TRIP & DRIVER PANEL */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Current Driver & Session */}
        <div className="bg-slate-800/70 rounded-xl border border-slate-700/60 p-5 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-violet-400" /> Current Driver
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                currentSession?.status === 'ACTIVE'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 animate-pulse'
                  : 'bg-slate-700 text-slate-400'
              }`}
            >
              {currentSession?.status === 'ACTIVE' ? 'SESSION ACTIVE' : 'NO DRIVER'}
            </span>
          </div>

          <div className="space-y-2">
            <div>
              <p className="text-xs text-slate-500">Driver ID</p>
              <p className="text-lg font-bold text-slate-100">
                {selectedVehicleData?.driverId || currentSession?.driverId || 'Unassigned'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-700/40 text-xs">
              <div>
                <span className="text-slate-500 block">Session Start</span>
                <span className="font-mono text-slate-300">
                  {formatClockTime(currentSession?.startTime)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Trips in Session</span>
                <span className="font-bold text-amber-400">
                  {currentSession?.tripsCompleted || 0}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Current Operational Trip */}
        <div className="bg-slate-800/70 rounded-xl border border-slate-700/60 p-5 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-amber-400" /> Operational Trip
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                activeTrip?.status === 'ACTIVE'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  : 'bg-slate-700 text-slate-400'
              }`}
            >
              {activeTrip?.status === 'ACTIVE' ? `Trip #${activeTrip.tripNumber} — ACTIVE` : 'IDLE AT PARKING'}
            </span>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-slate-500">Started From</p>
                <p className="text-sm font-semibold text-slate-200 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-blue-400" />
                  {activeTrip?.startZone || 'PARKING'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Current Zone</p>
                <p className="text-sm font-semibold text-amber-300">
                  {selectedVehicleData?.beacon?.zoneName || selectedVehicleData?.beacon?.id || 'In Transit'}
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-700/40 flex items-center justify-between text-xs">
              <span className="text-slate-500 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Elapsed:
              </span>
              <span className="font-mono text-emerald-400 font-bold">
                {activeTrip ? formatDurationSec(activeTrip.durationSec) : '00:00:00'}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Completed Trips Today */}
        <div className="bg-slate-800/70 rounded-xl border border-slate-700/60 p-5 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Completed Trips
            </span>
            <Link
              to="/trips"
              className="text-xs text-amber-400 hover:underline flex items-center gap-0.5"
            >
              History <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="flex items-baseline gap-2 mb-2">
            <p className="text-3xl font-extrabold text-emerald-400">{todayTripsCount}</p>
            <span className="text-xs text-slate-400">trips completed today</span>
          </div>

          <div className="pt-2 border-t border-slate-700/40 text-xs text-slate-400 flex items-center justify-between">
            <span>Operating Vehicle:</span>
            <span className="font-mono font-bold text-slate-200">{activeVehicleId}</span>
          </div>
        </div>
      </div>

      {/* ROUTE ANALYTICS SUMMARY TABLE */}
      {routeAnalytics.length > 0 && (
        <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-700/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RouteIcon className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-slate-200">
                Route Analytics ({activeVehicleId})
              </h2>
            </div>
            <Link
              to="/analytics"
              className="text-xs text-slate-500 hover:text-amber-400 flex items-center gap-1 transition-colors"
            >
              Full Analytics <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50 text-xs text-slate-400 uppercase tracking-wider bg-slate-900/40">
                  <th className="px-5 py-2.5 text-left">FROM</th>
                  <th className="px-5 py-2.5 text-left">TO</th>
                  <th className="px-5 py-2.5 text-center">COUNT</th>
                  <th className="px-5 py-2.5 text-right">AVG TRAVEL</th>
                  <th className="px-5 py-2.5 text-right">AVG HOLD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {routeAnalytics.slice(0, 6).map((r) => (
                  <tr key={r.routeKey} className="hover:bg-slate-700/20 transition-colors">
                    <td className="px-5 py-2.5 font-semibold text-slate-200">{r.fromZone}</td>
                    <td className="px-5 py-2.5 font-semibold text-amber-400">{r.toZone}</td>
                    <td className="px-5 py-2.5 text-center font-mono text-slate-300">
                      <span className="px-2 py-0.5 rounded bg-slate-700/50 text-xs">
                        {r.occurrenceCount}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-right font-mono text-emerald-400">
                      {formatDurationSec(r.averageTravelTimeSec)}
                    </td>
                    <td className="px-5 py-2.5 text-right font-mono text-blue-400">
                      {formatDurationSec(r.averageHoldTimeSec)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Map + Recent Events Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Live Map */}
        <div className="xl:col-span-2">
          <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-700/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-semibold text-slate-200">Live Vehicle Map</h2>
              </div>
              <Link
                to="/gps"
                className="text-xs text-slate-500 hover:text-amber-400 flex items-center gap-1 transition-colors"
              >
                Full Map <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <LiveMap
              vehicles={mapVehicles}
              height="380px"
              onVehicleClick={(id) => navigate(`/vehicle/${id}`)}
            />
          </div>
        </div>

        {/* Recent Events */}
        <div>
          <div className="bg-slate-800/60 rounded-xl border border-slate-700/50">
            <div className="px-5 py-3 border-b border-slate-700/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-semibold text-slate-200">Recent Activity</h2>
              </div>
              <Link
                to="/events"
                className="text-xs text-slate-500 hover:text-amber-400 flex items-center gap-1 transition-colors"
              >
                View All <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="divide-y divide-slate-700/30 max-h-[380px] overflow-y-auto scrollbar-thin">
              {recentEvents.slice(0, 15).map((event, i) => (
                <div
                  key={event.id || i}
                  className="px-4 py-3 hover:bg-slate-700/20 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className={`text-xs font-semibold ${getEventColor(event.event)}`}>
                        {formatEventName(event.event)}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {event.vehicleId} • {event.driverId || '—'}
                      </p>
                    </div>
                    <span className="text-[10px] text-slate-600 shrink-0">{event.time}</span>
                  </div>
                </div>
              ))}
              {recentEvents.length === 0 && !loading && (
                <div className="px-4 py-8 text-center text-sm text-slate-500">No recent events</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Live Vehicle Status Table */}
      <div className="bg-slate-800/60 rounded-xl border border-slate-700/50">
        <div className="px-5 py-3 border-b border-slate-700/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-slate-200">Live Vehicle Status</h2>
          </div>
          <Link
            to="/fleet"
            className="text-xs text-slate-500 hover:text-amber-400 flex items-center gap-1 transition-colors"
          >
            View Fleet <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Vehicle</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Driver</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">State</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Zone</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Speed</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Cycle</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Last Update</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {vehicleList.map(({ id, current }) => (
                <tr
                  key={id}
                  className="hover:bg-slate-700/20 transition-colors cursor-pointer"
                  onClick={() => navigate(`/vehicle/${id}`)}
                >
                  <td className="px-4 py-3">
                    <span className="font-semibold text-slate-200">{id}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{current.driverId || '—'}</td>
                  <td className="px-4 py-3">
                    <StatusBadge stateName={current.stateName} size="sm" />
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{current.beacon?.zoneName || '—'}</td>
                  <td className="px-4 py-3 text-slate-300">{formatSpeed(current.gps?.speedKmph)}</td>
                  <td className="px-4 py-3 text-slate-400">#{current.cycleNumber}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{current.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {vehicleList.length === 0 && !loading && (
            <div className="px-4 py-12 text-center text-sm text-slate-500">No vehicles found</div>
          )}
        </div>
      </div>
    </div>
  );
}
