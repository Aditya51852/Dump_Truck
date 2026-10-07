// src/pages/EventLogs.tsx
import { useMemo, useState } from 'react';
import { FileText, Filter, Search } from 'lucide-react';
import { useVehicles } from '../hooks/useVehicles';
import { useAllEvents } from '../hooks/useVehicleEvents';
import StatusBadge from '../components/StatusBadge';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';
import { formatEventName, formatSpeed, formatCoordinates } from '../utils/formatters';
import { getEventColor } from '../utils/stateColors';

export default function EventLogs() {
  const { vehicles } = useVehicles();
  const vehicleIds = useMemo(() => Object.keys(vehicles), [vehicles]);
  const { events, loading } = useAllEvents(vehicleIds, 100);

  const [filterVehicle, setFilterVehicle] = useState('');
  const [filterEvent, setFilterEvent] = useState('');
  const [filterDriver, setFilterDriver] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Get unique values for filters
  const uniqueVehicles = useMemo(() => [...new Set(events.map((e) => e.vehicleId))], [events]);
  const uniqueEvents = useMemo(() => [...new Set(events.map((e) => e.event))], [events]);
  const uniqueDrivers = useMemo(() => [...new Set(events.map((e) => e.driverId).filter(Boolean))], [events]);
  const uniqueDates = useMemo(() => [...new Set(events.map((e) => e.date).filter(Boolean))], [events]);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (filterVehicle && e.vehicleId !== filterVehicle) return false;
      if (filterEvent && e.event !== filterEvent) return false;
      if (filterDriver && e.driverId !== filterDriver) return false;
      if (filterDate && e.date !== filterDate) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          e.vehicleId?.toLowerCase().includes(q) ||
          e.event?.toLowerCase().includes(q) ||
          e.driverId?.toLowerCase().includes(q) ||
          e.stateName?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [events, filterVehicle, filterEvent, filterDriver, filterDate, searchQuery]);

  if (loading) return <LoadingState message="Loading events..." />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Event Logs</h1>
        <p className="text-sm text-slate-500 mt-1">Real-time event stream from all vehicles</p>
      </div>

      {/* Filters */}
      <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-300">Filters</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-900/60 border border-slate-700/50 rounded-lg text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-amber-500/50"
            />
          </div>
          <select
            value={filterVehicle}
            onChange={(e) => setFilterVehicle(e.target.value)}
            className="bg-slate-900/60 border border-slate-700/50 rounded-lg text-sm text-slate-300 px-3 py-2 focus:outline-none focus:border-amber-500/50"
          >
            <option value="">All Vehicles</option>
            {uniqueVehicles.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
          <select
            value={filterEvent}
            onChange={(e) => setFilterEvent(e.target.value)}
            className="bg-slate-900/60 border border-slate-700/50 rounded-lg text-sm text-slate-300 px-3 py-2 focus:outline-none focus:border-amber-500/50"
          >
            <option value="">All Events</option>
            {uniqueEvents.map((e) => (
              <option key={e} value={e}>{formatEventName(e)}</option>
            ))}
          </select>
          <select
            value={filterDriver}
            onChange={(e) => setFilterDriver(e.target.value)}
            className="bg-slate-900/60 border border-slate-700/50 rounded-lg text-sm text-slate-300 px-3 py-2 focus:outline-none focus:border-amber-500/50"
          >
            <option value="">All Drivers</option>
            {uniqueDrivers.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <select
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="bg-slate-900/60 border border-slate-700/50 rounded-lg text-sm text-slate-300 px-3 py-2 focus:outline-none focus:border-amber-500/50"
          >
            <option value="">All Dates</option>
            {uniqueDates.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Events Table */}
      <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-700/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold text-slate-200">Events</span>
          </div>
          <span className="text-xs text-slate-500">{filtered.length} events</span>
        </div>
        {filtered.length === 0 ? (
          <EmptyState title="No events match your filters" message="Try adjusting your filter criteria." />
        ) : (
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-800/95 z-10">
                <tr className="border-b border-slate-700/50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Vehicle</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Driver</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Cycle</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Event</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">State</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Speed</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">GPS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {filtered.map((event, i) => (
                  <tr key={event.id || i} className="hover:bg-slate-700/20 transition-colors">
                    <td className="px-4 py-2.5 text-slate-400 text-xs font-mono">{event.date}</td>
                    <td className="px-4 py-2.5 text-slate-300 text-xs font-mono">{event.time}</td>
                    <td className="px-4 py-2.5 text-slate-200 font-semibold text-xs">{event.vehicleId}</td>
                    <td className="px-4 py-2.5 text-slate-400 text-xs font-mono">{event.driverId || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-400 text-xs">#{event.cycleNumber}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs font-semibold ${getEventColor(event.event)}`}>
                        {formatEventName(event.event)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge stateName={event.stateName} size="sm" />
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 text-xs font-mono">{formatSpeed(event.speedKmph)}</td>
                    <td className="px-4 py-2.5 text-slate-500 text-[11px] font-mono">
                      {formatCoordinates(event.latitude, event.longitude)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
