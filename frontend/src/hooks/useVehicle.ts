// src/hooks/useVehicle.ts
import { useState, useEffect } from 'react';
import { subscribeToVehicleCurrent } from '../firebase/vehicleService';
import type { VehicleCurrent } from '../types';

interface UseVehicleReturn {
  vehicle: VehicleCurrent | null;
  loading: boolean;
  error: Error | null;
  lastUpdate: Date | null;
}

export function useVehicle(vehicleId: string | undefined): UseVehicleReturn {
  const [vehicle, setVehicle] = useState<VehicleCurrent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    if (!vehicleId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToVehicleCurrent(
      vehicleId,
      (data) => {
        setVehicle(data);
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
  }, [vehicleId]);

  return { vehicle, loading, error, lastUpdate };
}
