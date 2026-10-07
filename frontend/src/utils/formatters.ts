// src/utils/formatters.ts
export { formatStateName } from './stateColors';

/**
 * Format a timestamp string for display
 */
export function formatTime(time: string | undefined): string {
  if (!time) return '—';
  return time;
}

/**
 * Format a date string for display
 */
export function formatDate(date: string | undefined): string {
  if (!date) return '—';
  return date;
}

/**
 * Format speed with unit
 */
export function formatSpeed(speed: number | undefined): string {
  if (speed === undefined || speed === null) return '—';
  return `${speed.toFixed(1)} km/h`;
}

/**
 * Format GPS coordinates
 */
export function formatCoordinates(lat: number | undefined, lng: number | undefined): string {
  if (lat === undefined || lng === undefined) return '—';
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

/**
 * Format WiFi RSSI with signal strength indicator
 */
export function formatRSSI(rssi: number | undefined): string {
  if (rssi === undefined || rssi === null) return '—';
  return `${rssi} dBm`;
}

/**
 * Get WiFi signal strength level
 */
export function getSignalStrength(rssi: number | undefined): 'excellent' | 'good' | 'fair' | 'weak' | 'none' {
  if (rssi === undefined || rssi === null) return 'none';
  if (rssi >= -50) return 'excellent';
  if (rssi >= -60) return 'good';
  if (rssi >= -70) return 'fair';
  return 'weak';
}

/**
 * Format a Date object to HH:MM:SS
 */
export function formatDateTime(date: Date | null): string {
  if (!date) return '—';
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Format beacon zone name to human-readable
 */
export function formatZoneName(zoneName: string | undefined): string {
  if (!zoneName) return '—';
  const mapping: Record<string, string> = {
    DUMP001: 'Dumping Station',
    EXC001: 'Excavator / Loading Area',
    PARK001: 'Parking Area',
  };
  return mapping[zoneName] || zoneName.replace(/_/g, ' ');
}

/**
 * Format event name for display
 */
export function formatEventName(event: string): string {
  if (!event) return '—';
  return event
    .replace(/_/g, ' ')
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Get relative time description
 */
export function getRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (seconds < 5) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString();
}
