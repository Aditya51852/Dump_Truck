// src/hooks/useDrivers.ts
import { useState, useEffect } from 'react';
import { subscribeToDrivers } from '../firebase/driverService';
import type { DriverInfo } from '../types';

interface UseDriversReturn {
  drivers: DriverInfo[];
  loading: boolean;
  error: Error | null;
}

export function useDrivers(): UseDriversReturn {
  const [drivers, setDrivers] = useState<DriverInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToDrivers(
      (data) => {
        setDrivers(data);
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

  return { drivers, loading, error };
}
