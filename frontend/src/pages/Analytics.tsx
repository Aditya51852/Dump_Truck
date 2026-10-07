// src/pages/Analytics.tsx
import { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart,
  Legend,
} from 'recharts';
import { Route as RouteIcon, Clock, Layers, Timer } from 'lucide-react';
import { useVehicles } from '../hooks/useVehicles';
import { useAllEvents } from '../hooks/useVehicleEvents';
import { useTripsAndAnalytics } from '../hooks/useTripsAndAnalytics';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';
import { formatStateName, formatEventName } from '../utils/formatters';

const CHART_COLORS = ['#f59e0b', '#3b82f6', '#22c55e', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'];

function formatDurationSec(sec = 0): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function Analytics() {
  const { vehicles, vehicleList } = useVehicles();
  const vehicleIds = useMemo(() => Object.keys(vehicles), [vehicles]);
  const [selectedVehicle, setSelectedVehicle] = useState('DUMPER_001');

  const activeVehicleId = vehicleIds.includes(selectedVehicle)
    ? selectedVehicle
    : (vehicleIds[0] || 'DUMPER_001');

  const { routeAnalytics, completedTrips, loading: routeLoading } = useTripsAndAnalytics(activeVehicleId);
  const { events, loading: eventsLoading } = useAllEvents(vehicleIds, 200);

  // Vehicle State Distribution
  const stateDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    vehicleList.forEach(({ current }) => {
      const state = current.stateName || 'UNKNOWN';
      counts[state] = (counts[state] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({
      name: formatStateName(name),
      value,
    }));
  }, [vehicleList]);

  // Event Frequency
  const eventFrequency = useMemo(() => {
    const counts: Record<string, number> = {};
    events.forEach((e) => {
      const eventType = e.event || 'UNKNOWN';
      counts[eventType] = (counts[eventType] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({
        name: formatEventName(name),
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [events]);

  // Cycles per Vehicle
  const cyclesPerVehicle = useMemo(() => {
    const cycles: Record<string, Set<number>> = {};
    events.forEach((e) => {
      if (!cycles[e.vehicleId]) cycles[e.vehicleId] = new Set();
      cycles[e.vehicleId].add(e.cycleNumber);
    });
    return Object.entries(cycles).map(([vehicleId, cycleSet]) => ({
      vehicle: vehicleId.replace('DUMPER_', 'D'),
      cycles: cycleSet.size,
    }));
  }, [events]);

  // Events per Day
  const eventsPerDay = useMemo(() => {
    const counts: Record<string, number> = {};
    events.forEach((e) => {
      if (e.date) {
        counts[e.date] = (counts[e.date] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [events]);

  // Speed Trend
  const speedTrend = useMemo(() => {
    return events
      .filter((e) => e.speedKmph > 0)
      .slice(0, 30)
      .reverse()
      .map((e) => ({
        time: e.time,
        speed: e.speedKmph,
        vehicle: e.vehicleId.replace('DUMPER_', 'D'),
      }));
  }, [events]);

  // Route Chart Data
  const routeChartData = useMemo(() => {
    return routeAnalytics.map((r) => ({
      route: `${r.fromZone} → ${r.toZone}`,
      travelSec: r.averageTravelTimeSec,
      holdSec: r.averageHoldTimeSec,
      count: r.occurrenceCount,
    }));
  }, [routeAnalytics]);

  if (eventsLoading && routeLoading) return <LoadingState message="Loading analytics..." />;

  const customTooltipStyle = {
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    border: '1px solid rgba(100, 116, 139, 0.3)',
    borderRadius: '8px',
    padding: '8px 12px',
    color: '#e2e8f0',
    fontSize: '12px',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Fleet & Route Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">Operational route travel time, hold time, and cycle trends</p>
        </div>
        <select
          value={activeVehicleId}
          onChange={(e) => setSelectedVehicle(e.target.value)}
          className="bg-slate-800/80 border border-slate-700 rounded-lg text-xs text-slate-200 px-3 py-2 focus:outline-none focus:border-amber-500"
        >
          {vehicleIds.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      </div>

      {/* ROUTE ANALYTICS TABLE (PARKING-TO-PARKING SEGMENTS) */}
      <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-slate-700/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RouteIcon className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-slate-200">
              Operational Route Analytics Table ({activeVehicleId})
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            {completedTrips.length} Completed Trips Analyzed
          </span>
        </div>

        {routeAnalytics.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No route transitions recorded yet for {activeVehicleId}. Segments will appear automatically as the vehicle moves between zones.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-900/40">
                  <th className="px-5 py-3 text-left">FROM</th>
                  <th className="px-5 py-3 text-left">TO</th>
                  <th className="px-5 py-3 text-center">COUNT</th>
                  <th className="px-5 py-3 text-right">AVG TRAVEL</th>
                  <th className="px-5 py-3 text-right">AVG HOLD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {routeAnalytics.map((r) => (
                  <tr key={r.routeKey} className="hover:bg-slate-700/20 transition-colors">
                    <td className="px-5 py-3 font-semibold text-slate-200">{r.fromZone}</td>
                    <td className="px-5 py-3 font-semibold text-amber-400">{r.toZone}</td>
                    <td className="px-5 py-3 text-center font-mono">
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-700/60 text-slate-300 text-xs font-bold">
                        {r.occurrenceCount}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-emerald-400 font-semibold">
                      {formatDurationSec(r.averageTravelTimeSec)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-blue-400 font-semibold">
                      {formatDurationSec(r.averageHoldTimeSec)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Route Travel & Hold Time Comparison Chart */}
      {routeChartData.length > 0 && (
        <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <Timer className="w-4 h-4 text-emerald-400" /> Route Segment Travel vs Hold Time (Seconds)
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={routeChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="route" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} unit="s" />
              <Tooltip contentStyle={customTooltipStyle} />
              <Legend />
              <Bar dataKey="travelSec" name="Avg Travel Time" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="holdSec" name="Avg Hold Time" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Grid of Other Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vehicle State Distribution */}
        <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">Vehicle State Distribution</h3>
          {stateDistribution.length === 0 ? (
            <EmptyState title="No data" message="No state distribution data available." />
          ) : (
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={stateDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {stateDistribution.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={customTooltipStyle} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Cycles per Vehicle */}
        <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">Cycles per Vehicle</h3>
          {cyclesPerVehicle.length === 0 ? (
            <EmptyState title="No data" message="No cycle data available." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={cyclesPerVehicle}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="vehicle" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                <Tooltip contentStyle={customTooltipStyle} />
                <Bar dataKey="cycles" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Events per Day */}
        <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">Events per Day</h3>
          {eventsPerDay.length === 0 ? (
            <EmptyState title="No data" message="No daily data available." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={eventsPerDay}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                <Tooltip contentStyle={customTooltipStyle} />
                <Area type="monotone" dataKey="count" stroke="#22c55e" fill="url(#colorCount)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Speed Trend */}
        <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">Speed Trend</h3>
          {speedTrend.length === 0 ? (
            <EmptyState title="No data" message="No speed data available." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={speedTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} unit=" km/h" />
                <Tooltip contentStyle={customTooltipStyle} />
                <Line type="monotone" dataKey="speed" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
