// src/pages/TripHistory.tsx
import { useState, useMemo } from 'react';
import {
  Truck,
  Timer,
  Compass,
  UserCheck,
  CheckCircle2,
  Clock,
  Layers,
  ChevronDown,
  ChevronUp,
  MapPin,
  Calendar,
} from 'lucide-react';
import { useVehicles } from '../hooks/useVehicles';
import { useAllEvents } from '../hooks/useVehicleEvents';
import { useTripsAndAnalytics } from '../hooks/useTripsAndAnalytics';
import StatusBadge from '../components/StatusBadge';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';
import { formatEventName, formatSpeed } from '../utils/formatters';

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
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function TripHistory() {
  const { vehicles } = useVehicles();
  const vehicleIds = useMemo(() => Object.keys(vehicles), [vehicles]);
  const [selectedVehicle, setSelectedVehicle] = useState('DUMPER_001');
  const [activeTab, setActiveTab] = useState<'trips' | 'sessions' | 'cycles'>('trips');
  const [expandedTripId, setExpandedTripId] = useState<string | null>(null);

  const activeVehicleId = vehicleIds.includes(selectedVehicle)
    ? selectedVehicle
    : (vehicleIds[0] || 'DUMPER_001');

  const {
    completedTrips,
    activeTrip,
    driverSessions,
    completedSessions,
    currentSession,
    loading: tripsLoading,
  } = useTripsAndAnalytics(activeVehicleId);

  const { events, loading: eventsLoading } = useAllEvents([activeVehicleId], 150);

  // Group events by cycle for legacy cycle view
  const cycles = useMemo(() => {
    const cycleMap: Record<number, any> = {};
    events.forEach((event) => {
      if (!cycleMap[event.cycleNumber]) {
        cycleMap[event.cycleNumber] = {
          cycleNumber: event.cycleNumber,
          vehicleId: event.vehicleId,
          driverId: event.driverId,
          events: [],
          tripStart: null,
          parkingArrival: null,
        };
      }
      cycleMap[event.cycleNumber].events.push(event);
      const ev = (event.event || '').toUpperCase();
      if (ev.includes('TRIP_STARTED')) cycleMap[event.cycleNumber].tripStart = event.time;
      if (ev.includes('PARKING_ARRIVAL') || ev.includes('PARKED')) cycleMap[event.cycleNumber].parkingArrival = event.time;
    });
    return Object.values(cycleMap).sort((a: any, b: any) => b.cycleNumber - a.cycleNumber);
  }, [events]);

  const allSessionsList = useMemo(() => {
    const list = Object.values(driverSessions);
    list.sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
    return list;
  }, [driverSessions]);

  const allTripsList = useMemo(() => {
    const list = [...completedTrips];
    if (activeTrip && !list.find((t) => t.tripId === activeTrip.tripId)) {
      list.unshift(activeTrip);
    }
    return list;
  }, [completedTrips, activeTrip]);

  if (tripsLoading && eventsLoading) {
    return <LoadingState message="Loading trips and operational records..." />;
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Trip & Driver Session Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">Parking-to-Parking operational trip lifecycle records</p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={activeVehicleId}
            onChange={(e) => setSelectedVehicle(e.target.value)}
            className="bg-slate-800/80 border border-slate-700/60 rounded-lg text-sm text-slate-300 px-3 py-2 focus:outline-none focus:border-amber-500/50"
          >
            {vehicleIds.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-700/60 pb-2">
        <button
          onClick={() => setActiveTab('trips')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
            activeTab === 'trips'
              ? 'bg-amber-500 text-slate-900 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Compass className="w-4 h-4" /> Operational Trips ({allTripsList.length})
        </button>
        <button
          onClick={() => setActiveTab('sessions')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
            activeTab === 'sessions'
              ? 'bg-amber-500 text-slate-900 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <UserCheck className="w-4 h-4" /> Driver Sessions ({allSessionsList.length})
        </button>
        <button
          onClick={() => setActiveTab('cycles')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
            activeTab === 'cycles'
              ? 'bg-amber-500 text-slate-900 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Layers className="w-4 h-4" /> Cycle Events ({cycles.length})
        </button>
      </div>

      {/* TAB 1: OPERATIONAL TRIPS */}
      {activeTab === 'trips' && (
        <div className="space-y-4">
          {allTripsList.length === 0 ? (
            <EmptyState
              title="No operational trips yet"
              message={`Truck ${activeVehicleId} has not departed and returned to parking for a logged trip yet.`}
            />
          ) : (
            allTripsList.map((trip) => {
              const isExpanded = expandedTripId === trip.tripId;
              const segmentsList = trip.segments ? Object.values(trip.segments) : [];

              return (
                <div
                  key={trip.tripId}
                  className="bg-slate-800/60 rounded-xl border border-slate-700/50 overflow-hidden shadow-sm"
                >
                  <div
                    className="p-4 flex items-center justify-between flex-wrap gap-3 cursor-pointer hover:bg-slate-700/20 transition-colors"
                    onClick={() => setExpandedTripId(isExpanded ? null : trip.tripId)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 bg-amber-500/10 text-amber-400 rounded-lg text-xs font-bold border border-amber-500/30">
                        {trip.tripId} (#{trip.tripNumber})
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-200">
                            Driver: {trip.driverId || 'Unassigned'}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              trip.status === 'ACTIVE'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse'
                                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            }`}
                          >
                            {trip.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-500" />
                          Route: <span className="text-slate-300 font-semibold">{trip.routePath || 'PARKING'}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <span className="text-[11px] text-slate-500 block">Duration</span>
                        <span className="font-mono text-sm font-bold text-emerald-400">
                          {formatDurationSec(trip.durationSec)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] text-slate-500 block">Segments</span>
                        <span className="font-mono text-sm font-bold text-blue-400">
                          {trip.segmentCount || segmentsList.length}
                        </span>
                      </div>
                      <button className="text-slate-400 hover:text-slate-200">
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Breakdown */}
                  {isExpanded && (
                    <div className="px-5 pb-5 pt-2 border-t border-slate-700/40 bg-slate-900/30 space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs pt-2">
                        <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/40">
                          <span className="text-slate-500 block">Departure (Parking)</span>
                          <span className="font-mono text-slate-200 font-semibold">
                            {formatClockTime(trip.startTimestamp)}
                          </span>
                        </div>
                        <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/40">
                          <span className="text-slate-500 block">Arrival (Parking)</span>
                          <span className="font-mono text-slate-200 font-semibold">
                            {trip.endTimestamp ? formatClockTime(trip.endTimestamp) : 'In Progress'}
                          </span>
                        </div>
                        <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/40">
                          <span className="text-slate-500 block">Movement Time</span>
                          <span className="font-mono text-emerald-400 font-semibold">
                            {formatDurationSec(trip.movementSec)}
                          </span>
                        </div>
                        <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/40">
                          <span className="text-slate-500 block">Holding Time</span>
                          <span className="font-mono text-blue-400 font-semibold">
                            {formatDurationSec(trip.holdingSec)}
                          </span>
                        </div>
                      </div>

                      {/* Segments list if available */}
                      {segmentsList.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-2">
                            Route Segments
                          </h4>
                          <div className="space-y-1.5">
                            {segmentsList.map((seg, idx) => (
                              <div
                                key={seg.segmentId || idx}
                                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/30 text-xs"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="w-5 h-5 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center text-[10px] font-bold">
                                    {idx + 1}
                                  </span>
                                  <span className="font-semibold text-slate-200">{seg.fromZone}</span>
                                  <span className="text-slate-500">→</span>
                                  <span className="font-semibold text-amber-400">{seg.toZone}</span>
                                </div>
                                <div className="flex items-center gap-4 font-mono text-xs">
                                  <span className="text-slate-400">
                                    Travel: <span className="text-emerald-400">{formatDurationSec(seg.travelTimeSec)}</span>
                                  </span>
                                  <span className="text-slate-400">
                                    Hold: <span className="text-blue-400">{formatDurationSec(seg.holdTimeSec)}</span>
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 2: DRIVER SESSIONS */}
      {activeTab === 'sessions' && (
        <div className="space-y-4">
          {allSessionsList.length === 0 ? (
            <EmptyState
              title="No driver sessions"
              message={`No driver sessions have been logged for ${activeVehicleId} yet.`}
            />
          ) : (
            allSessionsList.map((session) => (
              <div
                key={session.sessionId}
                className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-5 shadow-sm"
              >
                <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 bg-violet-500/10 text-violet-400 rounded-lg text-xs font-bold border border-violet-500/20">
                      {session.sessionId}
                    </span>
                    <span className="text-sm font-bold text-slate-100">
                      Driver: {session.driverId}
                    </span>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      session.status === 'ACTIVE'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 animate-pulse'
                        : 'bg-slate-700 text-slate-400'
                    }`}
                  >
                    {session.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs pt-2 border-t border-slate-700/40">
                  <div>
                    <span className="text-slate-500 block">Session Start</span>
                    <span className="font-mono text-slate-200">
                      {formatClockTime(session.startTime)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Session End</span>
                    <span className="font-mono text-slate-200">
                      {session.endTime ? formatClockTime(session.endTime) : 'Active Session'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Trips Completed</span>
                    <span className="font-bold text-amber-400">
                      {session.tripsCompleted || 0}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Total Duration</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      {formatDurationSec(session.totalDurationSec)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 3: CYCLE EVENTS (PRESERVED LEGACY VIEW) */}
      {activeTab === 'cycles' && (
        <div className="space-y-4">
          {cycles.length === 0 ? (
            <EmptyState title="No cycle events" message="No cycle event logs available." />
          ) : (
            cycles.map((cycle: any) => (
              <div
                key={`${cycle.vehicleId}-${cycle.cycleNumber}`}
                className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-4"
              >
                <div className="flex items-center justify-between mb-3 border-b border-slate-700/40 pb-2">
                  <span className="text-xs font-bold text-amber-400">Cycle #{cycle.cycleNumber}</span>
                  <span className="text-xs text-slate-400">{cycle.driverId || '—'}</span>
                </div>
                <div className="space-y-1">
                  {cycle.events.map((e: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-1 rounded text-xs hover:bg-slate-700/20">
                      <span className="font-mono text-slate-500">{e.time}</span>
                      <span className="text-slate-200 font-medium">{formatEventName(e.event)}</span>
                      <StatusBadge stateName={e.stateName} size="sm" />
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
