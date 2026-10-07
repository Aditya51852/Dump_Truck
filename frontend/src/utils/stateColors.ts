// src/utils/stateColors.ts

export interface StateStyle {
  bg: string;
  text: string;
  border: string;
  dot: string;
  label: string;
}

const STATE_MAP: Record<string, StateStyle> = {
  PARKED: {
    bg: 'bg-slate-500/20',
    text: 'text-slate-300',
    border: 'border-slate-500/40',
    dot: 'bg-slate-400',
    label: 'Parked',
  },
  DRIVER_ASSIGNED: {
    bg: 'bg-blue-500/20',
    text: 'text-blue-300',
    border: 'border-blue-500/40',
    dot: 'bg-blue-400',
    label: 'Driver Assigned',
  },
  TO_EXCAVATOR: {
    bg: 'bg-amber-500/20',
    text: 'text-amber-300',
    border: 'border-amber-500/40',
    dot: 'bg-amber-400',
    label: 'To Excavator',
  },
  AT_EXCAVATOR: {
    bg: 'bg-orange-500/20',
    text: 'text-orange-300',
    border: 'border-orange-500/40',
    dot: 'bg-orange-400',
    label: 'At Excavator',
  },
  EXCAVATOR_ARRIVAL: {
    bg: 'bg-orange-500/20',
    text: 'text-orange-300',
    border: 'border-orange-500/40',
    dot: 'bg-orange-400',
    label: 'Excavator Arrival',
  },
  LOADING: {
    bg: 'bg-yellow-500/20',
    text: 'text-yellow-300',
    border: 'border-yellow-500/40',
    dot: 'bg-yellow-400',
    label: 'Loading (Shovel Active)',
  },
  TO_DUMPING: {
    bg: 'bg-emerald-500/20',
    text: 'text-emerald-300',
    border: 'border-emerald-500/40',
    dot: 'bg-emerald-400',
    label: 'To Dumping',
  },
  AT_DUMPING: {
    bg: 'bg-green-500/20',
    text: 'text-green-300',
    border: 'border-green-500/40',
    dot: 'bg-green-400',
    label: 'At Dumping',
  },
  DUMP_COMPLETE: {
    bg: 'bg-teal-500/20',
    text: 'text-teal-300',
    border: 'border-teal-500/40',
    dot: 'bg-teal-400',
    label: 'Dump Complete',
  },
  DUMPING_STATION_ARRIVAL: {
    bg: 'bg-green-500/20',
    text: 'text-green-300',
    border: 'border-green-500/40',
    dot: 'bg-green-400',
    label: 'Dumping Station Arrival',
  },
  RETURNING: {
    bg: 'bg-cyan-500/20',
    text: 'text-cyan-300',
    border: 'border-cyan-500/40',
    dot: 'bg-cyan-400',
    label: 'Returning',
  },
  PARKING_ARRIVAL: {
    bg: 'bg-slate-500/20',
    text: 'text-slate-300',
    border: 'border-slate-500/40',
    dot: 'bg-slate-400',
    label: 'Parking Arrival',
  },
  IDLE: {
    bg: 'bg-gray-500/20',
    text: 'text-gray-300',
    border: 'border-gray-500/40',
    dot: 'bg-gray-400',
    label: 'Idle',
  },
};

const DEFAULT_STYLE: StateStyle = {
  bg: 'bg-violet-500/20',
  text: 'text-violet-300',
  border: 'border-violet-500/40',
  dot: 'bg-violet-400',
  label: 'Unknown',
};

export function getStateStyle(stateName: string | undefined | null): StateStyle {
  if (!stateName) return DEFAULT_STYLE;
  const upper = stateName.toUpperCase();
  return STATE_MAP[upper] || { ...DEFAULT_STYLE, label: formatStateName(stateName) };
}

export function formatStateName(stateName: string): string {
  if (!stateName) return 'Unknown';
  return stateName
    .replace(/_/g, ' ')
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function getEventColor(event: string): string {
  const upper = (event || '').toUpperCase();
  if (upper.includes('DRIVER_ASSIGNED')) return 'text-blue-400';
  if (upper.includes('TRIP_STARTED')) return 'text-emerald-400';
  if (upper.includes('STATE_CHANGE')) return 'text-amber-400';
  if (upper.includes('EXCAVATOR')) return 'text-orange-400';
  if (upper.includes('DUMPING')) return 'text-green-400';
  if (upper.includes('PARKING')) return 'text-slate-400';
  if (upper.includes('SHIFT_RESET')) return 'text-red-400';
  if (upper.includes('INVALID_NFC')) return 'text-red-500';
  return 'text-violet-400';
}

// Map marker colors for vehicles
export function getMarkerColor(stateName: string): string {
  const upper = (stateName || '').toUpperCase();
  if (upper.includes('PARKED') || upper.includes('PARKING')) return '#64748b';
  if (upper.includes('EXCAVATOR')) return '#f59e0b';
  if (upper.includes('DUMPING')) return '#22c55e';
  if (upper.includes('TO_EXCAVATOR')) return '#f59e0b';
  if (upper.includes('TO_DUMPING')) return '#10b981';
  if (upper.includes('DRIVER_ASSIGNED')) return '#3b82f6';
  return '#8b5cf6';
}
