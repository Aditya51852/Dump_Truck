// src/firebase/eventService.ts
import { ref, onValue, onChildAdded, off, query, limitToLast, orderByKey } from 'firebase/database';
import database from './config';
import type { VehicleEvent } from '../types';

type EventsCallback = (events: VehicleEvent[]) => void;
type NewEventCallback = (event: VehicleEvent) => void;
type ErrorCallback = (error: Error) => void;

/**
 * Subscribe to vehicle events (limited to recent N events)
 */
export function subscribeToVehicleEvents(
  vehicleId: string,
  limit: number,
  onData: EventsCallback,
  onError?: ErrorCallback
): () => void {
  const eventsRef = query(
    ref(database, `vehicles/${vehicleId}/events`),
    orderByKey(),
    limitToLast(limit)
  );

  onValue(
    eventsRef,
    (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        onData([]);
        return;
      }
      const events: VehicleEvent[] = Object.entries(data).map(
        ([id, event]) => ({
          ...(event as VehicleEvent),
          id,
        })
      );
      // Sort by date+time descending
      events.sort((a, b) => {
        const dateTimeA = `${a.date} ${a.time}`;
        const dateTimeB = `${b.date} ${b.time}`;
        return dateTimeB.localeCompare(dateTimeA);
      });
      onData(events);
    },
    (error) => {
      if (onError) onError(error);
    }
  );

  return () => off(eventsRef);
}

/**
 * Subscribe to ALL vehicle events across the fleet (limited)
 */
export function subscribeToAllEvents(
  vehicleIds: string[],
  limitPerVehicle: number,
  onData: EventsCallback,
  onError?: ErrorCallback
): () => void {
  const unsubscribes: (() => void)[] = [];
  const allEventsMap: Record<string, VehicleEvent[]> = {};

  vehicleIds.forEach((vehicleId) => {
    const eventsRef = query(
      ref(database, `vehicles/${vehicleId}/events`),
      orderByKey(),
      limitToLast(limitPerVehicle)
    );

    onValue(
      eventsRef,
      (snapshot) => {
        const data = snapshot.val();
        if (!data) {
          allEventsMap[vehicleId] = [];
        } else {
          allEventsMap[vehicleId] = Object.entries(data).map(
            ([id, event]) => ({
              ...(event as VehicleEvent),
              id,
            })
          );
        }

        // Merge all events and sort
        const merged = Object.values(allEventsMap).flat();
        merged.sort((a, b) => {
          const dateTimeA = `${a.date} ${a.time}`;
          const dateTimeB = `${b.date} ${b.time}`;
          return dateTimeB.localeCompare(dateTimeA);
        });
        onData(merged);
      },
      (error) => {
        if (onError) onError(error);
      }
    );

    unsubscribes.push(() => off(eventsRef));
  });

  return () => unsubscribes.forEach((unsub) => unsub());
}

/**
 * Listen for new events added to a vehicle (for toast notifications)
 */
export function onNewEvent(
  vehicleId: string,
  callback: NewEventCallback
): () => void {
  const eventsRef = ref(database, `vehicles/${vehicleId}/events`);

  // We use onChildAdded which fires for each existing child first,
  // then for new ones. We skip initial load.
  let initialLoadComplete = false;
  let count = 0;

  const unsubscribe = onChildAdded(eventsRef, (snapshot) => {
    // Skip initial bulk load - mark complete after a short delay
    if (!initialLoadComplete) {
      count++;
      setTimeout(() => {
        initialLoadComplete = true;
      }, 2000);
      return;
    }

    const event = snapshot.val() as VehicleEvent;
    callback({ ...event, id: snapshot.key || undefined });
  });

  return unsubscribe;
}
