// src/hooks/useTripsAndAnalytics.ts
import { useState, useEffect, useMemo } from 'react';
import {
  subscribeToVehicleTrips,
  subscribeToDriverSessions,
  subscribeToRouteAnalytics,
} from '../firebase/tripService';
import type { OperationalTrip, DriverSession, RouteAnalytics } from '../types';

interface UseTripsAndAnalyticsReturn {
  trips: Record<string, OperationalTrip>;
  activeTrip: OperationalTrip | null;
  completedTrips: OperationalTrip[];
  todayTripsCount: number;
  driverSessions: Record<string, DriverSession>;
  currentSession: DriverSession | null;
  completedSessions: DriverSession[];
  routeAnalytics: RouteAnalytics[];
  loading: boolean;
  error: Error | null;
}

export function useTripsAndAnalytics(vehicleId = 'DUMPER_001'): UseTripsAndAnalyticsReturn {
  const [trips, setTrips] = useState<Record<string, OperationalTrip>>({});
  const [driverSessions, setDriverSessions] = useState<Record<string, DriverSession>>({});
  const [routeAnalyticsMap, setRouteAnalyticsMap] = useState<Record<string, RouteAnalytics>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!vehicleId) return;

    setLoading(true);
    let loadedCount = 0;
    const checkLoaded = () => {
      loadedCount++;
      if (loadedCount >= 3) setLoading(false);
    };

    const unsubTrips = subscribeToVehicleTrips(
      vehicleId,
      (data) => {
        setTrips(data);
        checkLoaded();
      },
      (err) => {
        setError(err);
        checkLoaded();
      }
    );

    const unsubSessions = subscribeToDriverSessions(
      vehicleId,
      (data) => {
        setDriverSessions(data);
        checkLoaded();
      },
      (err) => {
        setError(err);
        checkLoaded();
      }
    );

    const unsubAnalytics = subscribeToRouteAnalytics(
      vehicleId,
      (data) => {
        setRouteAnalyticsMap(data);
        checkLoaded();
      },
      (err) => {
        setError(err);
        checkLoaded();
      }
    );

    return () => {
      unsubTrips();
      unsubSessions();
      unsubAnalytics();
    };
  }, [vehicleId]);

  // Active & Completed Trips
  const { activeTrip, completedTrips, todayTripsCount } = useMemo(() => {
    const list = Object.values(trips);
    let active: OperationalTrip | null = null;
    const completed: OperationalTrip[] = [];

    const now = new Date();
    const startOfTodayEpoch = Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000);
    let todayCount = 0;

    list.forEach((t) => {
      if (t.status === 'ACTIVE') {
        active = t;
      } else if (t.status === 'COMPLETED') {
        completed.push(t);
        if (t.endTimestamp && t.endTimestamp >= startOfTodayEpoch) {
          todayCount++;
        }
      }
    });

    // Sort completed trips: newest first
    completed.sort((a, b) => (b.endTimestamp || b.startTimestamp) - (a.endTimestamp || a.startTimestamp));

    return {
      activeTrip: active,
      completedTrips: completed,
      todayTripsCount: todayCount,
    };
  }, [trips]);

  // Current & Completed Driver Sessions
  const { currentSession, completedSessions } = useMemo(() => {
    const list = Object.values(driverSessions);
    let active: DriverSession | null = null;
    const completed: DriverSession[] = [];

    list.forEach((s) => {
      if (s.status === 'ACTIVE') {
        active = s;
      } else {
        completed.push(s);
      }
    });

    completed.sort((a, b) => (b.endTime || b.startTime) - (a.endTime || a.startTime));

    return {
      currentSession: active,
      completedSessions: completed,
    };
  }, [driverSessions]);

  // Route Analytics Array
  const routeAnalytics = useMemo(() => {
    return Object.values(routeAnalyticsMap).sort((a, b) => b.occurrenceCount - a.occurrenceCount);
  }, [routeAnalyticsMap]);

  return {
    trips,
    activeTrip,
    completedTrips,
    todayTripsCount,
    driverSessions,
    currentSession,
    completedSessions,
    routeAnalytics,
    loading,
    error,
  };
}
