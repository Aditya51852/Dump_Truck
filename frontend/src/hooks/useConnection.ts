// src/hooks/useConnection.ts
import { useState, useEffect } from 'react';
import { subscribeToConnectionStatus } from '../firebase/vehicleService';

interface UseConnectionReturn {
  connected: boolean;
  lastUpdate: Date | null;
}

export function useConnection(): UseConnectionReturn {
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToConnectionStatus((isConnected) => {
      setConnected(isConnected);
      if (isConnected) {
        setLastUpdate(new Date());
      }
    });

    return () => unsubscribe();
  }, []);

  return { connected, lastUpdate };
}
