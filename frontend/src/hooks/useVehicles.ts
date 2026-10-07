// src/hooks/useVehicles.ts
import { useState, useEffect } from 'react';
import { subscribeToVehicles } from '../firebase/vehicleService';
import type { Vehicle, VehicleCurrent, FleetSummary } from '../types';

interface UseVehiclesReturn {
  vehicles: Record<string, Vehicle>;
  vehicleList: { id: string; current: VehicleCurrent }[];
  fleetSummary: FleetSummary;
  loading: boolean;
  error: Error | null;
  lastUpdate: Date | null;
}

export function useVehicles(): UseVehiclesReturn {
  const [vehicles, setVehicles] = useState<Record<string, Vehicle>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToVehicles(
      (data) => {
        setVehicles(data);
        setLoading(false);
        setError(null);
        setLastUpdate(new Date());
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const vehicleList = Object.entries(vehicles)
    .filter(([, v]) => v.current)
    .map(([id, v]) => ({ id, current: v.current }));

  const fleetSummary: FleetSummary = vehicleList.reduce(
    (summary, { current }) => {
      summary.total++;
      const state = (current.stateName || '').toUpperCase();

      if (state === 'PARKED' || state === 'PARKING_ARRIVAL') {
        summary.parked++;
      } else if (state === 'AT_EXCAVATOR' || state === 'EXCAVATOR_ARRIVAL') {
        summary.atExcavator++;
      } else if (state === 'AT_DUMPING' || state === 'DUMPING_STATION_ARRIVAL') {
        summary.atDumping++;
      } else if (state === 'TO_EXCAVATOR') {
        summary.toExcavator++;
        summary.running++;
      } else if (state === 'TO_DUMPING' || state === 'RETURNING') {
        summary.running++;
      } else if (state === 'DRIVER_ASSIGNED') {
        summary.driverAssigned++;
      } else {
        // Unknown state — check if it seems active
        if (current.gps?.speedKmph > 0) {
          summary.running++;
        }
      }

      if (current.driverId) {
        summary.driverAssigned = Math.max(summary.driverAssigned, 
          vehicleList.filter(v => v.current.driverId).length);
      }

      if (!current.system?.wifi) {
        summary.offline++;
      }

      return summary;
    },
    {
      total: 0,
      running: 0,
      atExcavator: 0,
      atDumping: 0,
      parked: 0,
      driverAssigned: 0,
      offline: 0,
      toExcavator: 0,
    } as FleetSummary
  );

  // Fix driver assigned count to be total vehicles with drivers
  fleetSummary.driverAssigned = vehicleList.filter(v => v.current.driverId).length;

  return {
    vehicles,
    vehicleList,
    fleetSummary,
    loading,
    error,
    lastUpdate,
  };
}
