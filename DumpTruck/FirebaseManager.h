#pragma once

#include <Arduino.h>
#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <vector>
#include "Config.h"
#include "CycleManager.h"
#include "TimingManager.h"

struct BeaconZoneInfo
{
  String id;
  String name;
  String type; // "EXCAVATOR", "DUMPING", "PARKING", "OTHER"
  String targetState;
  bool enabled;
};

struct LastVehicleState
{
  bool valid;
  uint32_t timestamp;
  double latitude;
  double longitude;
  int state;
  String stateName;
  String driverId;
  int cycleNumber;
  String beaconId;
  String zoneName;
  String sessionId;
  String tripId;
  int tripNumber;
  String tripStatus;
};

struct TripData;
struct SegmentData;
struct DriverSessionData;
struct RouteAnalyticsData;

class FirebaseManager
{
public:
  FirebaseManager();

  void begin();
  void connectWiFi();
  void checkWiFi();
  bool isWiFiConnected() const { return WiFi.status() == WL_CONNECTED; }
  int getWiFiRSSI() const { return WiFi.RSSI(); }

  bool isReady();
  bool isStarted() const { return firebaseStarted; }

  // Vehicle / Module Identification
  bool resolveVehicleId();
  String getVehicleId() const { return activeVehicleId; }

  // Remote System Configuration & Beacon Zones
  bool fetchSystemConfig();
  bool fetchBeaconZones();
  bool validateBeaconZone(const String &beaconID, String &zoneName, String &zoneType);
  static String inferZoneType(const String &id, const String &name);

  // Power-on recovery: fetch last recorded state from Firebase
  bool fetchLastKnownState(LastVehicleState &lastState);

  // Telemetry, Events & History Uploads
  void uploadEvent(const String &eventName, const String &beaconID = "", const String &zoneName = "", int beaconRSSI = -127);
  void uploadCurrentStatus();
  void uploadCycle(const CycleData &cycle);
  void uploadDailyStats(const DailyStats &stats);

  // Trip, Segment, Driver Session & Route Analytics Uploads
  void uploadTrip(const TripData &trip);
  void uploadSegment(const String &tripId, const SegmentData &segment);
  void uploadDriverSession(const DriverSessionData &session);
  void uploadRouteAnalytics(const RouteAnalyticsData &analytics);

  // Driver validation via NFC
  bool findDriverFromNFC(const String &uid, String &driverID);

private:
  FirebaseData fbdo;
  FirebaseAuth auth;
  FirebaseConfig config;
  bool firebaseStarted;

  String activeVehicleId;
  std::vector<BeaconZoneInfo> cachedZones;
};

extern FirebaseManager firebaseManager;
