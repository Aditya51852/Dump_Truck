// src/hooks/useBeaconZones.ts
import { useState, useEffect } from 'react';
import { subscribeToBeaconZones } from '../firebase/beaconService';
import type { BeaconZoneData } from '../types';

interface UseBeaconZonesReturn {
  zones: Record<string, BeaconZoneData>;
  zoneList: { id: string; data: BeaconZoneData }[];
  loading: boolean;
  error: Error | null;
}

export function useBeaconZones(): UseBeaconZonesReturn {
  const [zones, setZones] = useState<Record<string, BeaconZoneData>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToBeaconZones(
      (data) => {
        setZones(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const zoneList = Object.entries(zones).map(([id, data]) => ({ id, data }));

  return { zones, zoneList, loading, error };
}
