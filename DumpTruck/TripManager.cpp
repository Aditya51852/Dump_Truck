#include "TripManager.h"
#include "TimeManager.h"
#include "FirebaseManager.h"
#include "MovementManager.h"

TripManager tripManager;

TripManager::TripManager()
  : sessionStatus(SESSION_NONE),
    tripStatus(TRIP_IDLE),
    sessionCounter(0),
    currentTripNumber(0),
    tripUploadPending(false),
    inSegment(false),
    activeDepartureEpoch(0),
    currentZoneArrivalEpoch(0),
    currentSegmentIndex(0),
    segmentUploadPending(false),
    routeAnalyticsUploadPending(false),
    sessionUploadPending(false),
    lastTickEpoch(0),
    wasMoving(false),
    previousZoneID("")
{
  currentSession.sessionId = "";
  currentSession.driverId = "";
  currentSession.status = "NONE";
  currentSession.tripsCompleted = 0;
  currentSession.startTime = 0;
  currentSession.endTime = 0;
  currentSession.totalDurationSec = 0;
  currentSession.movementSec = 0;
  currentSession.holdingSec = 0;

  currentTrip.tripNumber = 0;
  currentTrip.tripId = "";
  currentTrip.status = "IDLE";
  currentTrip.durationSec = 0;
}

void TripManager::begin()
{
  lastTickEpoch = timeManager.getEpoch();
  Serial.println("TripManager initialized.");
}

bool TripManager::onDriverTappedNFC(const String &driverId, bool isAtParking)
{
  uint32_t nowEpoch = timeManager.getEpoch();

  // 1. If no active session, start a new driver session
  if (sessionStatus != SESSION_ACTIVE)
  {
    sessionCounter++;
    currentSession.sessionId = "SESSION_" + String(nowEpoch);
    currentSession.driverId = driverId;
    currentSession.vehicleId = firebaseManager.getVehicleId();
    currentSession.startTime = nowEpoch;
    currentSession.endTime = 0;
    currentSession.status = "ACTIVE";
    currentSession.tripsCompleted = 0;
    currentSession.totalDurationSec = 0;
    currentSession.movementSec = 0;
    currentSession.holdingSec = 0;

    sessionStatus = SESSION_ACTIVE;
    tripStatus = TRIP_IDLE; // Ready at parking, waits for truck to move
    sessionUploadPending = true;

    Serial.println();
    Serial.println("==========================================");
    Serial.printf(">>> DRIVER SESSION STARTED <<<\n");
    Serial.printf("  Driver: %s | Session: %s\n", driverId.c_str(), currentSession.sessionId.c_str());
    Serial.println("  Status: READY AT PARKING (Waiting for movement to start trip)");
    Serial.println("==========================================");

    firebaseManager.uploadEvent("DRIVER_ASSIGNED");
    return true; // Driver assigned
  }

  // 2. An active session exists. Check if this is the currently assigned driver
  if (driverId.equalsIgnoreCase(currentSession.driverId))
  {
    // Driver wishes to exit. Verify safe exit conditions:
    // Must be at Parking AND trip must not be currently active!
    if (isAtParking && tripStatus != TRIP_ACTIVE)
    {
      Serial.println();
      Serial.println("==========================================");
      Serial.printf(">>> DRIVER EXIT CONFIRMED <<<\n");
      Serial.printf("  Driver: %s | Trips Completed: %d\n",
                    driverId.c_str(), currentSession.tripsCompleted);
      Serial.println("==========================================");

      endDriverSession();
      return false; // Driver unassigned
    }
    else
    {
      Serial.println();
      Serial.println("WARNING: DRIVER EXIT REJECTED!");
      if (!isAtParking)
      {
        Serial.println("  -> Reason: Vehicle is NOT at Parking.");
      }
      if (tripStatus == TRIP_ACTIVE)
      {
        Serial.println("  -> Reason: Operational trip is currently ACTIVE.");
      }

      firebaseManager.uploadEvent("DRIVER_EXIT_REJECTED_NOT_AT_PARKING");
      return true; // Keep driver assigned
    }
  }

  // 3. Different driver tapped while another session is active
  if (isAtParking && tripStatus != TRIP_ACTIVE)
  {
    Serial.printf("Switching driver at parking: closing %s, starting for %s\n",
                  currentSession.driverId.c_str(), driverId.c_str());
    endDriverSession();
    return onDriverTappedNFC(driverId, isAtParking);
  }
  else
  {
    Serial.println("Cannot switch drivers while outside parking or mid-trip.");
    firebaseManager.uploadEvent("DRIVER_EXIT_REJECTED_NOT_AT_PARKING");
    return true;
  }
}

void TripManager::endDriverSession()
{
  uint32_t nowEpoch = timeManager.getEpoch();
  currentSession.endTime = nowEpoch;
  currentSession.totalDurationSec = TimeManager::getDurationSec(currentSession.startTime, nowEpoch);
  currentSession.status = "COMPLETED";

  sessionStatus = SESSION_COMPLETED;
  sessionUploadPending = true;

  firebaseManager.uploadDriverSession(currentSession);
  firebaseManager.uploadEvent("DRIVER_EXIT");

  currentSession.driverId = "";
  currentSession.sessionId = "";
}

void TripManager::startTrip()
{
  uint32_t nowEpoch = timeManager.getEpoch();
  currentTripNumber++;

  currentTrip.tripNumber = currentTripNumber;
  currentTrip.tripId = "TRIP_" + String(currentTripNumber);
  currentTrip.vehicleId = firebaseManager.getVehicleId();
  currentTrip.driverId = currentSession.driverId;
  currentTrip.sessionId = currentSession.sessionId;
  currentTrip.startZone = "PARKING";
  currentTrip.endZone = "";
  currentTrip.startTimestamp = nowEpoch;
  currentTrip.endTimestamp = 0;
  currentTrip.durationSec = 0;
  currentTrip.status = "ACTIVE";
  currentTrip.segmentCount = 0;
  currentTrip.movementSec = 0;
  currentTrip.holdingSec = 0;
  currentTrip.routePath = "PARKING";

  tripStatus = TRIP_ACTIVE;
  tripUploadPending = true;

  // Initialize initial route segment starting from PARKING
  inSegment = true;
  activeFromZone = "PARKING";
  activeDepartureEpoch = nowEpoch;
  currentAtZone = "";
  currentSegmentIndex = 0;

  Serial.println();
  Serial.println("******************************************");
  Serial.printf(">>> OPERATIONAL TRIP STARTED: #%d <<<\n", currentTripNumber);
  Serial.printf("  Trip ID: %s | Driver: %s | Session: %s\n",
                currentTrip.tripId.c_str(), currentTrip.driverId.c_str(), currentTrip.sessionId.c_str());
  Serial.println("  Departed from: PARKING");
  Serial.println("******************************************");

  firebaseManager.uploadTrip(currentTrip);
  firebaseManager.uploadEvent("TRIP_STARTED");
}

void TripManager::recordZoneArrival(const String &zoneID)
{
  if (!inSegment || zoneID.length() == 0) return;

  uint32_t nowEpoch = timeManager.getEpoch();
  currentAtZone = zoneID;
  currentZoneArrivalEpoch = nowEpoch;

  currentTrip.routePath += " -> " + zoneID;
  Serial.printf("Trip #%d: Arrived at Zone '%s' (Travel time from '%s': %lu s)\n",
                currentTripNumber, zoneID.c_str(), activeFromZone.c_str(),
                (unsigned long)TimeManager::getDurationSec(activeDepartureEpoch, nowEpoch));
}

void TripManager::recordZoneDeparture(const String &zoneID)
{
  if (currentAtZone.length() == 0) return;

  uint32_t nowEpoch = timeManager.getEpoch();
  uint32_t holdTime = TimeManager::getDurationSec(currentZoneArrivalEpoch, nowEpoch);

  // Complete and upload the previous segment
  currentSegmentIndex++;
  lastCompletedSegment.segmentId = "SEG_" + String(currentSegmentIndex);
  lastCompletedSegment.fromZone = activeFromZone;
  lastCompletedSegment.toZone = currentAtZone;
  lastCompletedSegment.departureTimestamp = activeDepartureEpoch;
  lastCompletedSegment.arrivalTimestamp = currentZoneArrivalEpoch;
  lastCompletedSegment.travelTimeSec = TimeManager::getDurationSec(activeDepartureEpoch, currentZoneArrivalEpoch);
  lastCompletedSegment.holdTimeSec = holdTime;
  lastCompletedSegment.driverId = currentSession.driverId;
  lastCompletedSegment.sessionId = currentSession.sessionId;
  lastCompletedSegment.tripNumber = currentTripNumber;

  currentTrip.segmentCount = currentSegmentIndex;
  segmentUploadPending = true;

  Serial.printf("Segment completed: %s -> %s (Travel: %lu s, Hold: %lu s)\n",
                lastCompletedSegment.fromZone.c_str(),
                lastCompletedSegment.toZone.c_str(),
                (unsigned long)lastCompletedSegment.travelTimeSec,
                (unsigned long)lastCompletedSegment.holdTimeSec);

  // Update Route Analytics aggregation
  updateRouteAnalytics(lastCompletedSegment.fromZone, lastCompletedSegment.toZone,
                       lastCompletedSegment.travelTimeSec, lastCompletedSegment.holdTimeSec);

  firebaseManager.uploadSegment(currentTrip.tripId, lastCompletedSegment);

  // Advance to next segment
  activeFromZone = currentAtZone;
  activeDepartureEpoch = nowEpoch;
  currentAtZone = "";
}

void TripManager::updateRouteAnalytics(const String &from, const String &to, uint32_t travelTime, uint32_t holdTime)
{
  String key = from + "_" + to;
  key.replace(" ", "_");

  bool found = false;
  for (auto &r : routeAnalyticsList)
  {
    if (r.routeKey == key)
    {
      r.occurrenceCount++;
      r.totalTravelTimeSec += travelTime;
      r.averageTravelTimeSec = r.totalTravelTimeSec / r.occurrenceCount;
      r.totalHoldTimeSec += holdTime;
      r.averageHoldTimeSec = r.totalHoldTimeSec / r.occurrenceCount;
      lastRouteAnalytics = r;
      found = true;
      break;
    }
  }

  if (!found)
  {
    RouteAnalyticsData newR;
    newR.fromZone = from;
    newR.toZone = to;
    newR.routeKey = key;
    newR.occurrenceCount = 1;
    newR.totalTravelTimeSec = travelTime;
    newR.averageTravelTimeSec = travelTime;
    newR.totalHoldTimeSec = holdTime;
    newR.averageHoldTimeSec = holdTime;
    routeAnalyticsList.push_back(newR);
    lastRouteAnalytics = newR;
  }

  routeAnalyticsUploadPending = true;
  firebaseManager.uploadRouteAnalytics(lastRouteAnalytics);
}

void TripManager::completeTrip()
{
  uint32_t nowEpoch = timeManager.getEpoch();

  // Finalize the last segment back into PARKING
  currentSegmentIndex++;
  lastCompletedSegment.segmentId = "SEG_" + String(currentSegmentIndex);
  lastCompletedSegment.fromZone = activeFromZone;
  lastCompletedSegment.toZone = "PARKING";
  lastCompletedSegment.departureTimestamp = activeDepartureEpoch;
  lastCompletedSegment.arrivalTimestamp = nowEpoch;
  lastCompletedSegment.travelTimeSec = TimeManager::getDurationSec(activeDepartureEpoch, nowEpoch);
  lastCompletedSegment.holdTimeSec = 0;
  lastCompletedSegment.driverId = currentSession.driverId;
  lastCompletedSegment.sessionId = currentSession.sessionId;
  lastCompletedSegment.tripNumber = currentTripNumber;

  currentTrip.segmentCount = currentSegmentIndex;
  segmentUploadPending = true;

  updateRouteAnalytics(lastCompletedSegment.fromZone, "PARKING",
                       lastCompletedSegment.travelTimeSec, 0);
  firebaseManager.uploadSegment(currentTrip.tripId, lastCompletedSegment);

  // Complete Trip
  currentTrip.endTimestamp = nowEpoch;
  currentTrip.endZone = "PARKING";
  currentTrip.durationSec = TimeManager::getDurationSec(currentTrip.startTimestamp, nowEpoch);
  currentTrip.status = "COMPLETED";
  currentTrip.routePath += " -> PARKING";

  lastCompletedTrip = currentTrip;
  tripUploadPending = true;
  tripStatus = TRIP_COMPLETED;
  currentSession.tripsCompleted++;

  Serial.println();
  Serial.println("******************************************");
  Serial.printf(">>> OPERATIONAL TRIP COMPLETED: #%d <<<\n", currentTripNumber);
  Serial.printf("  Duration: %lu s | Total Segments: %d\n",
                (unsigned long)currentTrip.durationSec, currentTrip.segmentCount);
  Serial.printf("  Route: %s\n", currentTrip.routePath.c_str());
  Serial.println("******************************************");

  firebaseManager.uploadTrip(currentTrip);
  firebaseManager.uploadEvent("TRIP_COMPLETED");

  inSegment = false;
  activeFromZone = "PARKING";
  currentAtZone = "";
}

void TripManager::update(bool isMoving, const String &currentZoneID, const String &currentZoneType)
{
  uint32_t nowEpoch = timeManager.getEpoch();
  if (lastTickEpoch == 0) lastTickEpoch = nowEpoch;
  uint32_t delta = (nowEpoch > lastTickEpoch) ? (nowEpoch - lastTickEpoch) : 0;
  lastTickEpoch = nowEpoch;

  // Accumulate session timing
  if (sessionStatus == SESSION_ACTIVE && delta > 0)
  {
    currentSession.totalDurationSec += delta;
    if (isMoving) currentSession.movementSec += delta;
    else currentSession.holdingSec += delta;
  }

  // Accumulate trip timing
  if (tripStatus == TRIP_ACTIVE && delta > 0)
  {
    currentTrip.durationSec += delta;
    if (isMoving) currentTrip.movementSec += delta;
    else currentTrip.holdingSec += delta;
  }

  // -------------------------------------------------------------------------
  // 1. TRIP START CHECK (From PARKING with Driver)
  // -------------------------------------------------------------------------
  if (sessionStatus == SESSION_ACTIVE && (tripStatus == TRIP_IDLE || tripStatus == TRIP_COMPLETED))
  {
    bool atParking = (currentZoneType == "PARKING" || previousZoneID.startsWith("PARK"));

    // When the truck starts moving away from Parking
    if (isMoving && !wasMoving && atParking)
    {
      startTrip();
    }
  }

  // -------------------------------------------------------------------------
  // 2. ZONE TRANSITIONS INSIDE ACTIVE TRIP
  // -------------------------------------------------------------------------
  if (tripStatus == TRIP_ACTIVE)
  {
    // A. Detected leaving a zone (started moving while holding at a zone)
    if (isMoving && !wasMoving && currentAtZone.length() > 0)
    {
      recordZoneDeparture(currentAtZone);
    }

    // B. Detected entering a new zone
    if (currentZoneID.length() > 0 && currentZoneID != previousZoneID)
    {
      if (currentZoneType == "PARKING")
      {
        // Trip has successfully returned to PARKING!
        completeTrip();
      }
      else
      {
        recordZoneArrival(currentZoneID);
      }
    }
  }

  wasMoving = isMoving;
  if (currentZoneID.length() > 0)
  {
    previousZoneID = currentZoneID;
  }
}

void TripManager::recoverState(const String &sessionId, const String &driverId, int tripNumber,
                              const String &tripId, bool tripActive, uint32_t tripStartTime, const String &lastZone)
{
  if (driverId.length() > 0)
  {
    sessionStatus = SESSION_ACTIVE;
    currentSession.sessionId = (sessionId.length() > 0) ? sessionId : ("SESSION_" + String(tripStartTime));
    currentSession.driverId = driverId;
    currentSession.vehicleId = firebaseManager.getVehicleId();
    currentSession.startTime = tripStartTime;
    currentSession.status = "ACTIVE";
    currentTripNumber = tripNumber;

    if (tripActive)
    {
      tripStatus = TRIP_ACTIVE;
      currentTrip.tripNumber = tripNumber;
      currentTrip.tripId = (tripId.length() > 0) ? tripId : ("TRIP_" + String(tripNumber));
      currentTrip.driverId = driverId;
      currentTrip.sessionId = currentSession.sessionId;
      currentTrip.startTimestamp = tripStartTime;
      currentTrip.startZone = "PARKING";
      currentTrip.status = "ACTIVE";
      inSegment = true;
      activeFromZone = (lastZone.length() > 0) ? lastZone : "PARKING";
      activeDepartureEpoch = tripStartTime;
      Serial.printf("TripManager: Recovered active Trip #%d for Driver '%s'\n", tripNumber, driverId.c_str());
    }
    else
    {
      tripStatus = TRIP_IDLE;
      Serial.printf("TripManager: Recovered Driver Session for '%s' (Waiting at Parking)\n", driverId.c_str());
    }
  }
}
