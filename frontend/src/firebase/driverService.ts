// src/firebase/driverService.ts
import { ref, onValue, off, set, update, remove, push } from 'firebase/database';
import database from './config';
import type { Vehicle, DriverInfo, VehicleEvent, DriverRecord } from '../types';

type DriversCallback = (drivers: DriverInfo[]) => void;
type ErrorCallback = (error: Error) => void;

/**
 * Subscribe to drivers in real-time.
 * Synchronizes with both the persistent 'drivers' registry and active 'vehicles'.
 */
export function subscribeToDrivers(
  onData: DriversCallback,
  onError?: ErrorCallback
): () => void {
  const vehiclesRef = ref(database, 'vehicles');
  const driversRef = ref(database, 'drivers');

  let latestVehicles: Record<string, Vehicle> = {};
  let latestDriverRecords: Record<string, DriverRecord> = {};

  const notify = () => {
    const driverMap: Record<string, DriverInfo> = {};

    // 1. Populate registered drivers from the 'drivers' table
    Object.entries(latestDriverRecords).forEach(([id, rec]) => {
      const driverId = rec.driverId || id;
      driverMap[driverId] = {
        driverId,
        name: rec.name || driverId,
        phone: rec.phone || '',
        licenseNumber: rec.licenseNumber || '',
        status: rec.status || 'AVAILABLE',
        assignedVehicles: rec.assignedVehicle ? [rec.assignedVehicle] : [],
        currentVehicle: rec.assignedVehicle || null,
        currentState: null,
        totalCycles: 0,
        recentEvents: [],
        isRegistered: true,
      };
    });

    // 2. Merge data from active vehicles
    Object.entries(latestVehicles).forEach(([vehicleId, vehicle]) => {
      const v = vehicle as Vehicle;
      const driverId = v.current?.driverId;

      if (driverId) {
        if (!driverMap[driverId]) {
          driverMap[driverId] = {
            driverId,
            name: driverId,
            phone: '',
            licenseNumber: '',
            status: 'ON_DUTY',
            assignedVehicles: [],
            currentVehicle: null,
            currentState: null,
            totalCycles: 0,
            recentEvents: [],
            isRegistered: false,
          };
        }

        if (!driverMap[driverId].assignedVehicles.includes(vehicleId)) {
          driverMap[driverId].assignedVehicles.push(vehicleId);
        }
        driverMap[driverId].currentVehicle = vehicleId;
        driverMap[driverId].currentState = v.current?.stateName || null;
        driverMap[driverId].totalCycles = Math.max(
          driverMap[driverId].totalCycles,
          v.current?.cycleNumber || 0
        );

        // Collect recent events for this driver
        if (v.events) {
          const events: VehicleEvent[] = Object.entries(v.events)
            .map(([id, event]) => ({
              ...(event as VehicleEvent),
              id,
            }))
            .filter((e) => e.driverId === driverId)
            .sort((a, b) => {
              const dtA = `${a.date || ''} ${a.time || ''}`;
              const dtB = `${b.date || ''} ${b.time || ''}`;
              return dtB.localeCompare(dtA);
            })
            .slice(0, 10);

          driverMap[driverId].recentEvents = [
            ...driverMap[driverId].recentEvents,
            ...events,
          ].slice(0, 20);
        }
      }
    });

    onData(Object.values(driverMap));
  };

  const unsubVehicles = onValue(
    vehiclesRef,
    (snapshot) => {
      latestVehicles = snapshot.val() || {};
      notify();
    },
    (err) => {
      if (onError) onError(err);
    }
  );

  const unsubDrivers = onValue(
    driversRef,
    (snapshot) => {
      latestDriverRecords = snapshot.val() || {};
      notify();
    },
    (err) => {
      if (onError) onError(err);
    }
  );

  return () => {
    unsubVehicles();
    unsubDrivers();
    off(vehiclesRef);
    off(driversRef);
  };
}

/**
 * Add or update a driver profile directly in Firebase Realtime Database
 * Path: drivers/{driverId}
 */
export async function addOrUpdateDriver(
  driverId: string,
  profile: {
    name?: string;
    phone?: string;
    licenseNumber?: string;
    status?: string;
    assignedVehicle?: string | null;
    notes?: string;
  }
): Promise<void> {
  const cleanId = driverId.trim().toUpperCase();
  if (!cleanId) {
    throw new Error('Driver ID is required');
  }

  const driverRef = ref(database, `drivers/${cleanId}`);
  const payload: Record<string, unknown> = {
    driverId: cleanId,
    name: profile.name?.trim() || cleanId,
    phone: profile.phone?.trim() || '',
    licenseNumber: profile.licenseNumber?.trim() || '',
    status: profile.status || (profile.assignedVehicle ? 'ON_DUTY' : 'AVAILABLE'),
    assignedVehicle: profile.assignedVehicle || null,
    notes: profile.notes?.trim() || '',
    updatedAt: new Date().toISOString(),
  };

  await set(driverRef, payload);

  // If vehicle assignment was provided, also update the vehicle node
  if (profile.assignedVehicle) {
    await assignDriverToVehicle(cleanId, profile.assignedVehicle);
  }
}

/**
 * Assign a driver to a vehicle directly in Firebase
 * Updates vehicles/{vehicleId}/current/driverId, vehicle state, and pushes an event
 */
export async function assignDriverToVehicle(
  driverId: string,
  vehicleId: string
): Promise<void> {
  const cleanDriverId = driverId.trim();
  const cleanVehicleId = vehicleId.trim();
  if (!cleanVehicleId) throw new Error('Vehicle ID is required');

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
  const epoch = Math.floor(now.getTime() / 1000);

  // 1. Update vehicle current state
  const currentRef = ref(database, `vehicles/${cleanVehicleId}/current`);
  await update(currentRef, {
    driverId: cleanDriverId,
    stateName: 'DRIVER_ASSIGNED',
    state: 1,
    time: timeStr,
    date: dateStr,
    timestamp: epoch,
  });

  // 2. Push event to vehicle timeline
  const eventsRef = ref(database, `vehicles/${cleanVehicleId}/events`);
  const newEvent: VehicleEvent = {
    vehicleId: cleanVehicleId,
    driverId: cleanDriverId,
    event: 'DRIVER_ASSIGNED',
    stateName: 'DRIVER_ASSIGNED',
    state: 1,
    date: dateStr,
    time: timeStr,
    timestamp: epoch,
    cycleNumber: 0,
    speedKmph: 0,
    latitude: 0,
    longitude: 0,
  };
  await push(eventsRef, newEvent);

  // 3. Update driver record if it exists
  if (cleanDriverId) {
    const driverRef = ref(database, `drivers/${cleanDriverId}`);
    try {
      await update(driverRef, {
        assignedVehicle: cleanVehicleId,
        status: 'ON_DUTY',
        updatedAt: now.toISOString(),
      });
    } catch {
      // Driver might not be in registered node yet, which is fine
    }
  }
}

/**
 * Unassign driver from vehicle directly in Firebase
 */
export async function unassignDriverFromVehicle(
  vehicleId: string,
  driverId?: string
): Promise<void> {
  const cleanVehicleId = vehicleId.trim();
  if (!cleanVehicleId) return;

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
  const epoch = Math.floor(now.getTime() / 1000);

  // 1. Update vehicle current state
  const currentRef = ref(database, `vehicles/${cleanVehicleId}/current`);
  await update(currentRef, {
    driverId: '',
    stateName: 'PARKED',
    state: 0,
    time: timeStr,
    timestamp: epoch,
  });

  // 2. Push event
  const eventsRef = ref(database, `vehicles/${cleanVehicleId}/events`);
  const newEvent: VehicleEvent = {
    vehicleId: cleanVehicleId,
    driverId: driverId || '',
    event: 'DRIVER_UNASSIGNED',
    stateName: 'PARKED',
    state: 0,
    date: dateStr,
    time: timeStr,
    timestamp: epoch,
    cycleNumber: 0,
    speedKmph: 0,
    latitude: 0,
    longitude: 0,
  };
  await push(eventsRef, newEvent);

  // 3. If driverId is provided, clear assignedVehicle in drivers registry
  if (driverId) {
    const cleanDriverId = driverId.trim();
    const driverRef = ref(database, `drivers/${cleanDriverId}`);
    try {
      await update(driverRef, {
        assignedVehicle: null,
        status: 'AVAILABLE',
        updatedAt: now.toISOString(),
      });
    } catch {
      // Ignore if not present in drivers registry
    }
  }
}

/**
 * Delete a driver record from Firebase
 */
export async function deleteDriver(driverId: string): Promise<void> {
  const cleanId = driverId.trim();
  if (!cleanId) return;
  const driverRef = ref(database, `drivers/${cleanId}`);
  await remove(driverRef);
}
