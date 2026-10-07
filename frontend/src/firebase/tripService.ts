// src/firebase/tripService.ts
import { ref, onValue, off } from 'firebase/database';
import database from './config';
import type { OperationalTrip, DriverSession, RouteAnalytics } from '../types';

type TripsCallback = (trips: Record<string, OperationalTrip>) => void;
type SessionsCallback = (sessions: Record<string, DriverSession>) => void;
type RouteAnalyticsCallback = (analytics: Record<string, RouteAnalytics>) => void;
type ErrorCallback = (error: Error) => void;

/**
 * Subscribe to trips for a specific vehicle in real-time
 */
export function subscribeToVehicleTrips(
  vehicleId: string,
  onData: TripsCallback,
  onError?: ErrorCallback
): () => void {
  const tripsRef = ref(database, `vehicles/${vehicleId}/trips`);
  const unsubscribe = onValue(
    tripsRef,
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
 * Subscribe to driver sessions for a specific vehicle in real-time
 */
export function subscribeToDriverSessions(
  vehicleId: string,
  onData: SessionsCallback,
  onError?: ErrorCallback
): () => void {
  const sessionsRef = ref(database, `vehicles/${vehicleId}/driver_sessions`);
  const unsubscribe = onValue(
    sessionsRef,
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
 * Subscribe to route analytics aggregation for a specific vehicle
 */
export function subscribeToRouteAnalytics(
  vehicleId: string,
  onData: RouteAnalyticsCallback,
  onError?: ErrorCallback
): () => void {
  const analyticsRef = ref(database, `vehicles/${vehicleId}/route_analytics`);
  const unsubscribe = onValue(
    analyticsRef,
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
