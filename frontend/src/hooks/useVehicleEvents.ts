// src/hooks/useVehicleEvents.ts
import { useState, useEffect } from 'react';
import { subscribeToVehicleEvents, subscribeToAllEvents } from '../firebase/eventService';
import type { VehicleEvent } from '../types';

interface UseVehicleEventsReturn {
  events: VehicleEvent[];
  loading: boolean;
  error: Error | null;
}

/**
 * Subscribe to events for a single vehicle
 */
export function useVehicleEvents(
  vehicleId: string | undefined,
  limit: number = 100
): UseVehicleEventsReturn {
  const [events, setEvents] = useState<VehicleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!vehicleId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = subscribeToVehicleEvents(
      vehicleId,
      limit,
      (data) => {
        setEvents(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [vehicleId, limit]);

  return { events, loading, error };
}

/**
 * Subscribe to events across all vehicles
 */
export function useAllEvents(
  vehicleIds: string[],
  limitPerVehicle: number = 50
): UseVehicleEventsReturn {
  const [events, setEvents] = useState<VehicleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (vehicleIds.length === 0) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = subscribeToAllEvents(
      vehicleIds,
      limitPerVehicle,
      (data) => {
        setEvents(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [vehicleIds.join(','), limitPerVehicle]);

  return { events, loading, error };
}
