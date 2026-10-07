// src/firebase/beaconService.ts
import { ref, onValue, off, set, remove } from 'firebase/database';
import database from './config';
import type { BeaconZoneData } from '../types';

type BeaconZonesCallback = (zones: Record<string, BeaconZoneData>) => void;
type ErrorCallback = (error: Error) => void;

function inferZoneType(id: string, name: string = ''): string {
  const idUpper = id.toUpperCase();
  const nameUpper = name.toUpperCase();
  if (idUpper.startsWith('EXC') || nameUpper.includes('EXCAVATOR') || nameUpper.includes('LODING') || nameUpper.includes('LOADING')) {
    return 'EXCAVATOR';
  }
  if (idUpper.startsWith('DUMP') || nameUpper.includes('DUMP')) {
    return 'DUMPING';
  }
  if (idUpper.startsWith('PARK') || nameUpper.includes('PARK')) {
    return 'PARKING';
  }
  if (idUpper.startsWith('CRUSH') || nameUpper.includes('CRUSHER')) {
    return 'CRUSHER';
  }
  if (idUpper.startsWith('WEIGH') || nameUpper.includes('WEIGH')) {
    return 'WEIGHBRIDGE';
  }
  return 'OTHER';
}

function inferTargetState(type: string): string {
  if (type === 'EXCAVATOR') return 'AT_EXCAVATOR';
  if (type === 'DUMPING') return 'AT_DUMPING';
  if (type === 'PARKING') return 'PARKED';
  return '';
}

/**
 * Subscribe to beacon zones in real-time.
 * Synchronizes with both /beacon_zones and legacy /vehicle_beacon_zones
 * to perfectly match the ESP32 firmware structure.
 */
export function subscribeToBeaconZones(
  onData: BeaconZonesCallback,
  onError?: ErrorCallback
): () => void {
  const scalableRef = ref(database, 'beacon_zones');
  const legacyRef = ref(database, 'vehicle_beacon_zones');

  let scalableData: Record<string, unknown> = {};
  let legacyData: Record<string, unknown> = {};

  const notify = () => {
    const merged: Record<string, BeaconZoneData> = {};

    // 1. Ingest legacy /vehicle_beacon_zones (stores "ID": "Zone Name" strings)
    Object.entries(legacyData).forEach(([id, val]) => {
      const cleanId = id.trim().toUpperCase();
      let zoneName = cleanId;
      if (typeof val === 'string') {
        zoneName = val;
      } else if (val && typeof val === 'object' && 'zoneName' in val) {
        zoneName = (val as { zoneName: string }).zoneName || cleanId;
      }
      merged[cleanId] = {
        zoneName,
        type: inferZoneType(cleanId, zoneName),
        state: inferTargetState(inferZoneType(cleanId, zoneName)),
        enabled: true,
      };
    });

    // 2. Ingest /beacon_zones (stores rich objects: zoneName, type, state, enabled, coordinates)
    Object.entries(scalableData).forEach(([id, val]) => {
      const cleanId = id.trim().toUpperCase();
      if (val && typeof val === 'object') {
        const obj = val as Record<string, unknown>;
        const zName = (obj.zoneName as string) || merged[cleanId]?.zoneName || cleanId;
        const zType = (obj.type as string) || inferZoneType(cleanId, zName);
        merged[cleanId] = {
          ...merged[cleanId],
          zoneName: zName,
          type: zType,
          state: (obj.state as string) || inferTargetState(zType),
          enabled: obj.enabled !== false,
          latitude: typeof obj.latitude === 'number' ? obj.latitude : merged[cleanId]?.latitude,
          longitude: typeof obj.longitude === 'number' ? obj.longitude : merged[cleanId]?.longitude,
          radius: typeof obj.radius === 'number' ? obj.radius : 50,
          description: (obj.description as string) || merged[cleanId]?.description || '',
          updatedAt: (obj.updatedAt as string) || undefined,
        };
      }
    });

    onData(merged);
  };

  const unsubScalable = onValue(
    scalableRef,
    (snap) => {
      scalableData = snap.val() || {};
      notify();
    },
    (err) => {
      if (onError) onError(err);
    }
  );

  const unsubLegacy = onValue(
    legacyRef,
    (snap) => {
      legacyData = snap.val() || {};
      notify();
    },
    (err) => {
      if (onError) onError(err);
    }
  );

  return () => {
    unsubScalable();
    unsubLegacy();
    off(scalableRef);
    off(legacyRef);
  };
}

/**
 * Add or update a Beacon Zone directly on Firebase.
 * Writes to BOTH:
 * 1) /vehicle_beacon_zones/{zoneId}: String zone name (read by firmware legacy fallback)
 * 2) /beacon_zones/{zoneId}: Full object (read by firmware scalable fetchBeaconZones)
 */
export async function addOrUpdateBeaconZone(
  zoneId: string,
  zoneData: {
    zoneName: string;
    type?: string;
    state?: string;
    enabled?: boolean;
    latitude?: number | null;
    longitude?: number | null;
    radius?: number;
    description?: string;
    [key: string]: unknown;
  }
): Promise<void> {
  const cleanId = zoneId.trim().toUpperCase();
  if (!cleanId) {
    throw new Error('Beacon Zone ID is required');
  }

  const finalName = zoneData.zoneName.trim() || cleanId;
  const finalType = zoneData.type || inferZoneType(cleanId, finalName);
  const finalState = zoneData.state || inferTargetState(finalType);

  // 1. Update /vehicle_beacon_zones (string value as expected by firmware)
  const legacyZoneRef = ref(database, `vehicle_beacon_zones/${cleanId}`);
  await set(legacyZoneRef, finalName);

  // 2. Update /beacon_zones (full schema object)
  const scalableZoneRef = ref(database, `beacon_zones/${cleanId}`);
  const payload: Record<string, unknown> = {
    zoneName: finalName,
    type: finalType,
    state: finalState,
    enabled: zoneData.enabled !== false,
    updatedAt: new Date().toISOString(),
  };

  if (zoneData.latitude !== undefined && zoneData.latitude !== null && !isNaN(Number(zoneData.latitude))) {
    payload.latitude = Number(zoneData.latitude);
  }
  if (zoneData.longitude !== undefined && zoneData.longitude !== null && !isNaN(Number(zoneData.longitude))) {
    payload.longitude = Number(zoneData.longitude);
  }
  if (zoneData.radius !== undefined && zoneData.radius !== null && !isNaN(Number(zoneData.radius))) {
    payload.radius = Number(zoneData.radius);
  }
  if (zoneData.description?.trim()) {
    payload.description = zoneData.description.trim();
  }

  await set(scalableZoneRef, payload);
}

/**
 * Delete a Beacon Zone directly from Firebase.
 * Removes from both /beacon_zones and /vehicle_beacon_zones.
 */
export async function deleteBeaconZone(zoneId: string): Promise<void> {
  const cleanId = zoneId.trim().toUpperCase();
  if (!cleanId) return;

  const legacyRef = ref(database, `vehicle_beacon_zones/${cleanId}`);
  const scalableRef = ref(database, `beacon_zones/${cleanId}`);

  await Promise.all([remove(legacyRef), remove(scalableRef)]);
}
