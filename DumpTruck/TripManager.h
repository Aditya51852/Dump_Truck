#pragma once

#include <Arduino.h>
#include <vector>
#include "Config.h"

enum TripStatus
{
  TRIP_IDLE,      // Ready at parking, waiting for movement
  TRIP_ACTIVE,    // Currently travelling/working outside parking
  TRIP_COMPLETED  // Reached parking, trip finalized
};

enum DriverSessionStatus
{
  SESSION_NONE,
  SESSION_ACTIVE,
  SESSION_COMPLETED
};

struct SegmentData
{
  String segmentId;
  String fromZone;
  String toZone;
  uint32_t departureTimestamp;
  uint32_t arrivalTimestamp;
  uint32_t travelTimeSec;
  uint32_t holdTimeSec;
  String driverId;
  String sessionId;
  int tripNumber;
};

struct TripData
{
  String tripId;
  String vehicleId;
  String driverId;
  String sessionId;
  int tripNumber;
  String startZone;
  String endZone;
  uint32_t startTimestamp;
  uint32_t endTimestamp;
  uint32_t durationSec;
  String status; // "ACTIVE", "COMPLETED"
  int segmentCount;
  uint32_t movementSec;
  uint32_t holdingSec;
  String routePath; // e.g. "PARKING -> EXC001 -> DUMP001 -> PARK001"
};

struct DriverSessionData
{
  String sessionId;
  String driverId;
  String vehicleId;
  uint32_t startTime;
  uint32_t endTime;
  String status; // "ACTIVE", "COMPLETED"
  int tripsCompleted;
  uint32_t totalDurationSec;
  uint32_t movementSec;
  uint32_t holdingSec;
};

struct RouteAnalyticsData
{
  String fromZone;
  String toZone;
  String routeKey; // "FROM_TO"
  int occurrenceCount;
  uint32_t totalTravelTimeSec;
  uint32_t averageTravelTimeSec;
  uint32_t totalHoldTimeSec;
  uint32_t averageHoldTimeSec;
};

class TripManager
{
public:
  TripManager();

  void begin();
  void update(bool isMoving, const String &currentZoneID, const String &currentZoneType);

  // Driver Session Controls
  bool onDriverTappedNFC(const String &driverId, bool isAtParking);
  void endDriverSession();
  bool isDriverSessionActive() const { return sessionStatus == SESSION_ACTIVE; }
  const DriverSessionData& getCurrentSession() const { return currentSession; }

  // Trip Lifecycle
  bool isTripActive() const { return tripStatus == TRIP_ACTIVE; }
  const TripData& getCurrentTrip() const { return currentTrip; }
  const TripData& getLastCompletedTrip() const { return lastCompletedTrip; }
  bool hasTripToUpload() const { return tripUploadPending; }
  void clearTripUploadPending() { tripUploadPending = false; }

  // Segment Tracking
  bool hasSegmentToUpload() const { return segmentUploadPending; }
  const SegmentData& getLastCompletedSegment() const { return lastCompletedSegment; }
  void clearSegmentUploadPending() { segmentUploadPending = false; }

  // Route Analytics
  bool hasRouteAnalyticsToUpload() const { return routeAnalyticsUploadPending; }
  const RouteAnalyticsData& getLastRouteAnalytics() const { return lastRouteAnalytics; }
  void clearRouteAnalyticsUploadPending() { routeAnalyticsUploadPending = false; }

  // Session upload
  bool hasSessionToUpload() const { return sessionUploadPending; }
  void clearSessionUploadPending() { sessionUploadPending = false; }

  // Helpers
  int getTripNumber() const { return currentTripNumber; }
  String getSessionId() const { return currentSession.sessionId; }
  String getTripId() const { return currentTrip.tripId; }
  TripStatus getTripStatus() const { return tripStatus; }

  // Recovery
  void recoverState(const String &sessionId, const String &driverId, int tripNumber,
                    const String &tripId, bool tripActive, uint32_t tripStartTime, const String &lastZone);

private:
  DriverSessionStatus sessionStatus;
  TripStatus tripStatus;

  DriverSessionData currentSession;
  int sessionCounter;

  TripData currentTrip;
  TripData lastCompletedTrip;
  int currentTripNumber;
  bool tripUploadPending;

  // Active Segment State
  bool inSegment;
  String activeFromZone;
  uint32_t activeDepartureEpoch;
  String currentAtZone;
  uint32_t currentZoneArrivalEpoch;
  int currentSegmentIndex;
  SegmentData lastCompletedSegment;
  bool segmentUploadPending;

  // Route Analytics Tracking
  std::vector<RouteAnalyticsData> routeAnalyticsList;
  RouteAnalyticsData lastRouteAnalytics;
  bool routeAnalyticsUploadPending;
  bool sessionUploadPending;

  uint32_t lastTickEpoch;
  bool wasMoving;
  String previousZoneID;

  void startTrip();
  void completeTrip();
  void recordZoneArrival(const String &zoneID);
  void recordZoneDeparture(const String &zoneID);
  void updateRouteAnalytics(const String &from, const String &to, uint32_t travelTime, uint32_t holdTime);
};

extern TripManager tripManager;
