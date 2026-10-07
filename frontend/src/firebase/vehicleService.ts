// src/firebase/vehicleService.ts
import { ref, onValue, off, set, remove, update } from 'firebase/database';
import database from './config';
import type { VehicleCurrent, Vehicle } from '../types';

type VehiclesCallback = (vehicles: Record<string, Vehicle>) => void;
type VehicleCurrentCallback = (current: VehicleCurrent | null) => void;
type ErrorCallback = (error: Error) => void;

/**
 * Subscribe to all vehicles in real-time
 */
export function subscribeToVehicles(
  onData: VehiclesCallback,
  onError?: ErrorCallback
): () => void {
  const vehiclesRef = ref(database, 'vehicles');
  const unsubscribe = onValue(
    vehiclesRef,
    (snapshot) => {
      const data = snapshot.val();
      onData(data || {});
    },
    (error) => {
      if (onError) onError(error);
    }
  );
  return unsubscribe;
}

/**
 * Subscribe to a single vehicle's current data in real-time
 */
export function subscribeToVehicleCurrent(
  vehicleId: string,
  onData: VehicleCurrentCallback,
  onError?: ErrorCallback
): () => void {
  const currentRef = ref(database, `vehicles/${vehicleId}/current`);
  const unsubscribe = onValue(
    currentRef,
    (snapshot) => {
      const data = snapshot.val();
      onData(data);
    },
    (error) => {
      if (onError) onError(error);
    }
  );
  return unsubscribe;
}

/**
 * Subscribe to Firebase connection status
 */
export function subscribeToConnectionStatus(
  onData: (connected: boolean) => void
): () => void {
  const connectedRef = ref(database, '.info/connected');
  onValue(connectedRef, (snapshot) => {
    onData(snapshot.val() === true);
  });
  return () => off(connectedRef);
}

/**
 * Add or initialize a vehicle directly in Firebase
 * Path: vehicles/{vehicleId}/current
 */
export async function addVehicle(
  vehicleId: string,
  initialData?: {
    driverId?: string;
    stateName?: string;
  }
): Promise<void> {
  const cleanId = vehicleId.trim().toUpperCase();
  if (!cleanId) throw new Error('Vehicle ID is required');

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
  const epoch = Math.floor(now.getTime() / 1000);

  const vehicleCurrent: VehicleCurrent = {
    vehicleId: cleanId,
    driverId: initialData?.driverId || '',
    cycleNumber: 0,
    state: initialData?.driverId ? 1 : 0,
    stateName: initialData?.stateName || (initialData?.driverId ? 'DRIVER_ASSIGNED' : 'PARKED'),
    date: dateStr,
    time: timeStr,
    timestamp: epoch,
    gps: {
      altitude: 0,
      latitude: 0,
      longitude: 0,
      locationValid: false,
      satellites: 0,
      speedKmph: 0,
    },
    imu: {
      accelX: 0,
      accelY: 0,
      accelZ: 1.0,
      gyroX: 0,
      gyroY: 0,
      gyroZ: 0,
    },
    beacon: {
      id: '',
      present: false,
      zoneName: '',
    },
    system: {
      mpu6500: true,
      pn532: true,
      rtc: true,
      wifi: true,
      wifiRSSI: -65,
    },
    vibration: {
      analog: 0,
      detected: false,
      digital: 0,
    },
    timing: {
      stateStartTime: epoch,
      currentStateDurationSec: 0,
      currentMovementDurationSec: 0,
      currentHoldingDurationSec: 0,
      totalMovementSec: 0,
      totalHoldingSec: 0,
      excavatorHoldingSec: 0,
      dumpingHoldingSec: 0,
      parkingSec: 0,
      totalOperatingSec: 0,
    },
    cycle: {
      cycleNumber: 0,
      cycleStartTime: epoch,
      cycleDurationSec: 0,
    },
  };

  const currentRef = ref(database, `vehicles/${cleanId}/current`);
  await set(currentRef, vehicleCurrent);
}

/**
 * Delete a vehicle directly from Firebase
 */
export async function deleteVehicle(vehicleId: string): Promise<void> {
  const cleanId = vehicleId.trim().toUpperCase();
  if (!cleanId) return;
  const vehicleRef = ref(database, `vehicles/${cleanId}`);
  await remove(vehicleRef);
}

/**
 * Update vehicle current fields directly on Firebase
 */
export async function updateVehicleCurrent(
  vehicleId: string,
  updates: Partial<VehicleCurrent>
): Promise<void> {
  const cleanId = vehicleId.trim();
  if (!cleanId) return;
  const currentRef = ref(database, `vehicles/${cleanId}/current`);
  await update(currentRef, updates as Record<string, unknown>);
}
