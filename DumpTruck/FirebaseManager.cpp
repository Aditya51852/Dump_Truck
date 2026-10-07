#include "FirebaseManager.h"
#include "DataManager.h"
#include "GPSManager.h"
#include "IMUManager.h"
#include "NFCManager.h"
#include "MovementManager.h"
#include "TimeManager.h"
#include "TimingManager.h"
#include "CycleManager.h"
#include "TripManager.h"

// Token & RTDB helper inclusions (only in this .cpp translation unit)
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"

FirebaseManager firebaseManager;

FirebaseManager::FirebaseManager()
  : firebaseStarted(false),
    activeVehicleId(VEHICLE_ID)
{
  // Pre-seed known default beacon zones so system works immediately even before WiFi sync
  cachedZones.push_back({"EXC001", "Excavator / Loding Area", "EXCAVATOR", "AT_EXCAVATOR", true});
  cachedZones.push_back({"DUMP001", "Dumping Staion", "DUMPING", "AT_DUMPING", true});
  cachedZones.push_back({"PARK001", "Parking Area", "PARKING", "PARKED", true});
}

void FirebaseManager::connectWiFi()
{
  if (WiFi.status() == WL_CONNECTED)
  {
    return;
  }

  Serial.println();
  Serial.println("Connecting to WiFi...");

  WiFi.disconnect(true);
  delay(100);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000)
  {
    Serial.print(".");
    delay(500);
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED)
  {
    Serial.println("WiFi Connected!");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
    Serial.print("RSSI: ");
    Serial.println(WiFi.RSSI());
  }
  else
  {
    Serial.println("WiFi connection failed.");
  }
}

void FirebaseManager::checkWiFi()
{
  if (WiFi.status() != WL_CONNECTED)
  {
    connectWiFi();
    if (WiFi.status() == WL_CONNECTED)
    {
      fetchBeaconZones();
      fetchSystemConfig();
    }
  }
}

void FirebaseManager::begin()
{
  Serial.println();
  Serial.println("Initializing Firebase...");

  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;

  auth.user.email = USER_EMAIL;
  auth.user.password = USER_PASSWORD;

  config.token_status_callback = tokenStatusCallback;

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  firebaseStarted = true;
  Serial.println("Firebase initialized.");

  delay(1000);
  if (isReady())
  {
    resolveVehicleId();
    fetchSystemConfig();
    fetchBeaconZones();
  }
}

bool FirebaseManager::isReady()
{
  return (firebaseStarted && (WiFi.status() == WL_CONNECTED) && Firebase.ready());
}

bool FirebaseManager::resolveVehicleId()
{
  if (!isReady()) return false;

  String path = "/modules/" + String(MODULE_ID) + "/vehicleId";
  Serial.printf("Resolving Vehicle ID for Module: %s...\n", path.c_str());

  if (Firebase.RTDB.getString(&fbdo, path))
  {
    String vid = fbdo.stringData();
    vid.trim();
    if (vid.length() > 0)
    {
      activeVehicleId = vid;
      Serial.printf(">>> MODULE RESOLVED: %s -> Vehicle ID: %s <<<\n", MODULE_ID, activeVehicleId.c_str());
      return true;
    }
  }
  else
  {
    Serial.printf("Module mapping not found, using default Vehicle ID: %s\n", activeVehicleId.c_str());
  }
  return false;
}

bool FirebaseManager::fetchSystemConfig()
{
  if (!isReady()) return false;

  Serial.println(">>> Fetching /system_config from Firebase <<<");

  // 1. Movement configuration
  if (Firebase.RTDB.getJSON(&fbdo, "/system_config/movement"))
  {
    FirebaseJson &json = fbdo.jsonObject();
    FirebaseJsonData d;
    if (json.get(d, "speedThresholdKmph") && d.typeNum == FirebaseJson::JSON_FLOAT)
    {
      movementManager.setSpeedThreshold(d.floatValue);
      Serial.printf("  Config: speedThresholdKmph = %.2f\n", d.floatValue);
    }
    if (json.get(d, "distanceThresholdMeters") && d.typeNum == FirebaseJson::JSON_FLOAT)
    {
      movementManager.setDistanceThreshold(d.floatValue);
      Serial.printf("  Config: distanceThresholdMeters = %.2f\n", d.floatValue);
    }
  }

  // 2. GPS configuration
  if (Firebase.RTDB.getJSON(&fbdo, "/system_config/gps"))
  {
    FirebaseJson &json = fbdo.jsonObject();
    FirebaseJsonData d;
    if (json.get(d, "minimumSatellites") && d.typeNum == FirebaseJson::JSON_INT)
    {
      movementManager.setMinimumSatellites(d.intValue);
      Serial.printf("  Config: minimumSatellites = %d\n", d.intValue);
    }
  }

  return true;
}

String FirebaseManager::inferZoneType(const String &id, const String &name)
{
  String idUpper = id;
  idUpper.toUpperCase();
  String nameUpper = name;
  nameUpper.toUpperCase();

  if (idUpper.startsWith("EXC") || nameUpper.indexOf("EXCAVATOR") >= 0 ||
      nameUpper.indexOf("LODING") >= 0 || nameUpper.indexOf("LOADING") >= 0)
  {
    return "EXCAVATOR";
  }
  if (idUpper.startsWith("DUMP") || nameUpper.indexOf("DUMP") >= 0)
  {
    return "DUMPING";
  }
  if (idUpper.startsWith("PARK") || nameUpper.indexOf("PARK") >= 0)
  {
    return "PARKING";
  }
  return "OTHER";
}

bool FirebaseManager::fetchBeaconZones()
{
  if (!isReady()) return false;

  Serial.println();
  Serial.println(">>> Fetching beacon_zones from Firebase RTDB <<<");

  bool loaded = false;

  // Check scalable /beacon_zones structure first
  if (Firebase.RTDB.getJSON(&fbdo, "/beacon_zones"))
  {
    FirebaseJson &json = fbdo.jsonObject();
    size_t len = json.iteratorBegin();
    String key, value;
    int type;

    cachedZones.clear();

    for (size_t i = 0; i < len; i++)
    {
      json.iteratorGet(i, type, key, value);
      key.trim();

      FirebaseJson child;
      child.setJsonData(value);
      FirebaseJsonData d;

      String zName = key;
      String zState = "";
      bool enabled = true;

      if (child.get(d, "zoneName")) zName = d.stringValue;
      if (child.get(d, "state"))    zState = d.stringValue;
      if (child.get(d, "enabled"))  enabled = d.boolValue;

      if (enabled)
      {
        String zType = inferZoneType(key, zName);
        cachedZones.push_back({key, zName, zType, zState, true});
        Serial.printf("  [Beacon Zone] %s: \"%s\" (Type: %s, State: %s)\n",
                      key.c_str(), zName.c_str(), zType.c_str(), zState.c_str());
      }
    }
    json.iteratorEnd();
    loaded = true;
  }

  // Also merge legacy /vehicle_beacon_zones for backwards compatibility
  if (Firebase.RTDB.getJSON(&fbdo, "/vehicle_beacon_zones"))
  {
    FirebaseJson &json = fbdo.jsonObject();
    size_t len = json.iteratorBegin();
    String key, value;
    int type;

    for (size_t i = 0; i < len; i++)
    {
      json.iteratorGet(i, type, key, value);
      key.trim();
      value.trim();

      // Check if already in cachedZones
      bool exists = false;
      for (const auto &cz : cachedZones)
      {
        if (cz.id.equalsIgnoreCase(key)) { exists = true; break; }
      }

      if (!exists)
      {
        String zType = inferZoneType(key, value);
        cachedZones.push_back({key, value, zType, "", true});
        Serial.printf("  [Legacy Zone] %s: \"%s\" (Type: %s)\n",
                      key.c_str(), value.c_str(), zType.c_str());
      }
    }
    json.iteratorEnd();
    loaded = true;
  }

  Serial.printf("Total active beacon zones cached: %d\n", (int)cachedZones.size());
  return loaded;
}

bool FirebaseManager::validateBeaconZone(const String &beaconID, String &zoneName, String &zoneType)
{
  if (beaconID.length() == 0) return false;

  // 1. Check local cache
  for (size_t i = 0; i < cachedZones.size(); i++)
  {
    if (cachedZones[i].id.equalsIgnoreCase(beaconID))
    {
      zoneName = cachedZones[i].name;
      zoneType = cachedZones[i].type;
      return true;
    }
  }

  // 2. Query Firebase directly if not in cache
  if (isReady())
  {
    String path = "/beacon_zones/" + beaconID;
    if (Firebase.RTDB.getJSON(&fbdo, path))
    {
      FirebaseJson &child = fbdo.jsonObject();
      FirebaseJsonData d;
      if (child.get(d, "zoneName"))
      {
        zoneName = d.stringValue;
        zoneType = inferZoneType(beaconID, zoneName);
        cachedZones.push_back({beaconID, zoneName, zoneType, "", true});
        return true;
      }
    }

    String legPath = "/vehicle_beacon_zones/" + beaconID;
    if (Firebase.RTDB.getString(&fbdo, legPath))
    {
      zoneName = fbdo.stringData();
      zoneName.trim();
      if (zoneName.length() > 0)
      {
        zoneType = inferZoneType(beaconID, zoneName);
        cachedZones.push_back({beaconID, zoneName, zoneType, "", true});
        return true;
      }
    }
  }

  // 3. Fallback heuristic based on prefix
  zoneType = inferZoneType(beaconID, "");
  if (zoneType != "OTHER")
  {
    if (zoneType == "EXCAVATOR") zoneName = "Excavator / Loding Area";
    else if (zoneType == "DUMPING") zoneName = "Dumping Staion";
    else if (zoneType == "PARKING") zoneName = "Parking Area";

    cachedZones.push_back({beaconID, zoneName, zoneType, "", true});
    return true;
  }

  return false;
}

bool FirebaseManager::fetchLastKnownState(LastVehicleState &lastState)
{
  lastState.valid = false;
  if (!isReady()) return false;

  String path = "/vehicles/" + activeVehicleId + "/current";
  Serial.printf("Fetching last known state from: %s...\n", path.c_str());

  if (Firebase.RTDB.getJSON(&fbdo, path))
  {
    FirebaseJson &json = fbdo.jsonObject();
    FirebaseJsonData d;

    lastState.valid = true;

    if (json.get(d, "timestamp"))       lastState.timestamp = d.intValue;
    else                                lastState.timestamp = 0;

    if (json.get(d, "gps/latitude"))    lastState.latitude = d.doubleValue;
    else                                lastState.latitude = 0.0;

    if (json.get(d, "gps/longitude"))   lastState.longitude = d.doubleValue;
    else                                lastState.longitude = 0.0;

    if (json.get(d, "state"))           lastState.state = d.intValue;
    else                                lastState.state = 0;

    if (json.get(d, "stateName"))       lastState.stateName = d.stringValue;
    else                                lastState.stateName = "PARKED";

    if (json.get(d, "driverId"))        lastState.driverId = d.stringValue;
    else                                lastState.driverId = "";

    if (json.get(d, "cycleNumber"))     lastState.cycleNumber = d.intValue;
    else                                lastState.cycleNumber = 0;

    if (json.get(d, "beacon/id"))       lastState.beaconId = d.stringValue;
    else                                lastState.beaconId = "";

    if (json.get(d, "beacon/zoneName")) lastState.zoneName = d.stringValue;
    else                                lastState.zoneName = "";

    if (json.get(d, "session/sessionId")) lastState.sessionId = d.stringValue;
    else                                  lastState.sessionId = "";

    if (json.get(d, "trip/tripId"))       lastState.tripId = d.stringValue;
    else                                  lastState.tripId = "";

    if (json.get(d, "trip/tripNumber"))   lastState.tripNumber = d.intValue;
    else                                  lastState.tripNumber = 0;

    if (json.get(d, "trip/status"))       lastState.tripStatus = d.stringValue;
    else                                  lastState.tripStatus = "IDLE";

    Serial.printf("Last State Recovered: State=%s, Driver=%s, Cycle=%d, Session=%s, Trip=%s, Epoch=%lu, Lat=%.6f, Lng=%.6f\n",
                  lastState.stateName.c_str(),
                  lastState.driverId.c_str(),
                  lastState.cycleNumber,
                  lastState.sessionId.c_str(),
                  lastState.tripId.c_str(),
                  (unsigned long)lastState.timestamp,
                  lastState.latitude,
                  lastState.longitude);
    return true;
  }
  else
  {
    Serial.printf("No previous current state found: %s\n", fbdo.errorReason().c_str());
    return false;
  }
}

void FirebaseManager::uploadEvent(const String &eventName, const String &beaconID, const String &zoneName, int beaconRSSI)
{
  if (!isReady()) return;

  FirebaseJson json;

  json.set("vehicleId", activeVehicleId);
  json.set("driverId", dataManager.getCurrentDriverID());
  json.set("event", eventName);
  json.set("state", (int)dataManager.getCurrentState());
  json.set("stateName", dataManager.getStateName());
  json.set("timestamp", (int)timeManager.getEpoch());
  json.set("date", dataManager.getDateString());
  json.set("time", dataManager.getTimeString());
  json.set("latitude", gpsManager.getLatitude());
  json.set("longitude", gpsManager.getLongitude());
  json.set("speedKmph", gpsManager.getSpeedKmph());
  json.set("cycleNumber", dataManager.getCycleNumber());
  json.set("sessionId", tripManager.getSessionId());
  json.set("tripNumber", tripManager.getTripNumber());
  json.set("tripId", tripManager.getTripId());

  if (beaconID != "")
  {
    json.set("beaconId", beaconID);
    if (zoneName != "")
    {
      json.set("zoneName", zoneName);
    }
    json.set("beaconRSSI", beaconRSSI);
  }

  String path = "/vehicles/" + activeVehicleId + "/events";

  if (Firebase.RTDB.pushJSON(&fbdo, path, &json))
  {
    Serial.printf("Event uploaded [%s]: %s\n", activeVehicleId.c_str(), eventName.c_str());
  }
  else
  {
    Serial.print("Event upload failed: ");
    Serial.println(fbdo.errorReason());
  }
}

void FirebaseManager::uploadCurrentStatus()
{
  if (!isReady()) return;

  FirebaseJson json;

  // Vehicle information (preserved compatible fields)
  json.set("vehicleId", activeVehicleId);
  json.set("driverId", dataManager.getCurrentDriverID());
  json.set("state", (int)dataManager.getCurrentState());
  json.set("stateName", dataManager.getStateName());
  json.set("cycleNumber", dataManager.getCycleNumber());

  // Timestamp & RTC
  json.set("timestamp", (int)timeManager.getEpoch());
  json.set("date", dataManager.getDateString());
  json.set("time", dataManager.getTimeString());

  // GPS
  json.set("gps/latitude", gpsManager.getLatitude());
  json.set("gps/longitude", gpsManager.getLongitude());
  json.set("gps/altitude", gpsManager.getAltitude());
  json.set("gps/satellites", gpsManager.getSatellites());
  json.set("gps/speedKmph", gpsManager.getSpeedKmph());
  json.set("gps/locationValid", gpsManager.isLocationValid());

  // Vibration (both analog and digital read, detected flag)
  json.set("vibration/analog", dataManager.getVibA0());
  json.set("vibration/digital", dataManager.getVibD0());
  json.set("vibration/detected", dataManager.isVibrationDetected());

  // MPU6500 IMU
  json.set("imu/accelX", imuManager.getAx());
  json.set("imu/accelY", imuManager.getAy());
  json.set("imu/accelZ", imuManager.getAz());
  json.set("imu/gyroX", imuManager.getGx());
  json.set("imu/gyroY", imuManager.getGy());
  json.set("imu/gyroZ", imuManager.getGz());

  // BLE Beacon / Zone
  json.set("beacon/id", dataManager.getDetectedBeaconID());
  json.set("beacon/zoneName", dataManager.getDetectedZoneName());
  json.set("beacon/present", dataManager.getDetectedBeaconID() != "");

  // Operational Timing metrics (extended)
  json.set("timing/stateStartTime", (int)timingManager.getStateStartEpoch());
  json.set("timing/currentStateDurationSec", (int)timingManager.getCurrentStateDurationSec());
  json.set("timing/currentMovementDurationSec", (int)timingManager.getCurrentMovementDurationSec());
  json.set("timing/currentHoldingDurationSec", (int)timingManager.getCurrentHoldingDurationSec());
  json.set("timing/totalMovementSec", (int)timingManager.getTotalMovementSec());
  json.set("timing/totalHoldingSec", (int)timingManager.getTotalHoldingSec());
  json.set("timing/excavatorHoldingSec", (int)timingManager.getTotalExcavatorHoldingSec());
  json.set("timing/dumpingHoldingSec", (int)timingManager.getTotalDumpingHoldingSec());
  json.set("timing/parkingSec", (int)timingManager.getTotalParkingSec());
  json.set("timing/totalOperatingSec", (int)timingManager.getTotalOperatingSec());

  // Cycle Metrics (extended)
  json.set("cycle/cycleNumber", cycleManager.getCycleNumber());
  json.set("cycle/cycleStartTime", (int)cycleManager.getCycleStartTime());
  json.set("cycle/cycleDurationSec", (int)cycleManager.getCycleDurationSec());

  // Driver Session Metrics (extended)
  json.set("session/sessionId", tripManager.getSessionId());
  json.set("session/driverId", dataManager.getCurrentDriverID());
  json.set("session/status", tripManager.isDriverSessionActive() ? "ACTIVE" : "NONE");
  json.set("session/tripsCompleted", tripManager.getCurrentSession().tripsCompleted);
  json.set("session/startTime", (int)tripManager.getCurrentSession().startTime);

  // Operational Trip Metrics (extended)
  json.set("trip/tripId", tripManager.getTripId());
  json.set("trip/tripNumber", tripManager.getTripNumber());
  json.set("trip/status", tripManager.isTripActive() ? "ACTIVE" : (tripManager.getTripStatus() == TRIP_COMPLETED ? "COMPLETED" : "IDLE"));
  json.set("trip/startZone", tripManager.getCurrentTrip().startZone);
  json.set("trip/startTimestamp", (int)tripManager.getCurrentTrip().startTimestamp);
  json.set("trip/durationSec", (int)tripManager.getCurrentTrip().durationSec);
  json.set("trip/segmentCount", tripManager.getCurrentTrip().segmentCount);
  json.set("trip/routePath", tripManager.getCurrentTrip().routePath);

  // Hardware Diagnostics
  json.set("system/rtc", timeManager.isRtcOk());
  json.set("system/pn532", nfcManager.isOk());
  json.set("system/mpu6500", imuManager.isOk());
  json.set("system/wifi", WiFi.status() == WL_CONNECTED);
  json.set("system/wifiRSSI", WiFi.RSSI());

  String path = "/vehicles/" + activeVehicleId + "/current";

  if (Firebase.RTDB.setJSON(&fbdo, path, &json))
  {
    Serial.println("Current status uploaded.");
  }
  else
  {
    Serial.print("Current upload failed: ");
    Serial.println(fbdo.errorReason());
  }
}

void FirebaseManager::uploadCycle(const CycleData &cycle)
{
  if (!isReady()) return;

  FirebaseJson json;
  json.set("cycleNumber", cycle.cycleNumber);
  json.set("driverId", cycle.driverId);
  json.set("startTime", (int)cycle.startTimeEpoch);
  json.set("endTime", (int)cycle.endTimeEpoch);
  json.set("totalDurationSec", (int)cycle.totalDurationSec);
  json.set("movementSec", (int)cycle.movementSec);
  json.set("holdingSec", (int)cycle.holdingSec);
  json.set("excavatorHoldingSec", (int)cycle.excavatorHoldingSec);
  json.set("dumpingHoldingSec", (int)cycle.dumpingHoldingSec);

  String path = "/vehicles/" + activeVehicleId + "/cycles/" + String(cycle.cycleNumber);

  if (Firebase.RTDB.setJSON(&fbdo, path, &json))
  {
    Serial.printf("Cycle #%d uploaded to %s\n", cycle.cycleNumber, path.c_str());
  }
  else
  {
    Serial.printf("Cycle upload failed: %s\n", fbdo.errorReason().c_str());
  }
}

void FirebaseManager::uploadDailyStats(const DailyStats &stats)
{
  if (!isReady() || stats.date.length() == 0 || stats.date == "0000-00-00") return;

  FirebaseJson json;
  json.set("totalCycles", (int)stats.totalCycles);
  json.set("totalMovementSec", (int)stats.totalMovementSec);
  json.set("totalHoldingSec", (int)stats.totalHoldingSec);
  json.set("totalExcavatorHoldingSec", (int)stats.totalExcavatorHoldingSec);
  json.set("totalDumpingHoldingSec", (int)stats.totalDumpingHoldingSec);
  json.set("totalParkingSec", (int)stats.totalParkingSec);
  json.set("totalOperatingSec", (int)stats.totalOperatingSec);
  json.set("totalDriverAssignedSec", (int)stats.totalDriverAssignedSec);
  json.set("unauthorizedMovementSec", (int)stats.unauthorizedMovementSec);

  String path = "/daily_stats/" + stats.date + "/" + activeVehicleId;

  if (Firebase.RTDB.setJSON(&fbdo, path, &json))
  {
    Serial.printf("Daily stats uploaded to %s\n", path.c_str());
  }
  else
  {
    Serial.printf("Daily stats upload failed: %s\n", fbdo.errorReason().c_str());
  }
}

bool FirebaseManager::findDriverFromNFC(const String &uid, String &driverID)
{
  if (WiFi.status() != WL_CONNECTED || !Firebase.ready())
  {
    Serial.println("WiFi/Firebase unavailable - cannot validate driver.");
    return false;
  }

  // 1. Try /nfc_cards/{uid}/driverId
  String path = "/nfc_cards/" + uid + "/driverId";
  if (Firebase.RTDB.getString(&fbdo, path))
  {
    driverID = fbdo.stringData();
    driverID.trim();
    if (driverID.length() > 0)
    {
      // Check if card has enabled field
      String enPath = "/nfc_cards/" + uid + "/enabled";
      if (Firebase.RTDB.getBool(&fbdo, enPath))
      {
        if (!fbdo.boolData())
        {
          Serial.printf("NFC Card %s is disabled.\n", uid.c_str());
          driverID = "";
          return false;
        }
      }

      Serial.printf("Driver found: %s\n", driverID.c_str());
      return true;
    }
  }

  // 2. Fallback: string directly under /nfc_cards/{uid}
  String directPath = "/nfc_cards/" + uid;
  if (Firebase.RTDB.getString(&fbdo, directPath))
  {
    driverID = fbdo.stringData();
    driverID.trim();
    if (driverID.length() > 0 && !driverID.startsWith("{"))
    {
      Serial.printf("Driver found directly: %s\n", driverID.c_str());
      return true;
    }
  }

  Serial.printf("Driver lookup failed for UID %s: %s\n", uid.c_str(), fbdo.errorReason().c_str());
  return false;
}

void FirebaseManager::uploadTrip(const TripData &trip)
{
  if (!isReady()) return;

  FirebaseJson json;
  json.set("tripId", trip.tripId);
  json.set("vehicleId", trip.vehicleId);
  json.set("driverId", trip.driverId);
  json.set("sessionId", trip.sessionId);
  json.set("tripNumber", trip.tripNumber);
  json.set("startZone", trip.startZone);
  json.set("endZone", trip.endZone);
  json.set("startTimestamp", (int)trip.startTimestamp);
  json.set("endTimestamp", (int)trip.endTimestamp);
  json.set("durationSec", (int)trip.durationSec);
  json.set("status", trip.status);
  json.set("segmentCount", trip.segmentCount);
  json.set("movementSec", (int)trip.movementSec);
  json.set("holdingSec", (int)trip.holdingSec);
  json.set("routePath", trip.routePath);

  String path = "/vehicles/" + activeVehicleId + "/trips/" + trip.tripId;

  if (Firebase.RTDB.setJSON(&fbdo, path, &json))
  {
    Serial.printf("Trip #%d uploaded to %s\n", trip.tripNumber, path.c_str());
  }
  else
  {
    Serial.printf("Trip upload failed: %s\n", fbdo.errorReason().c_str());
  }
}

void FirebaseManager::uploadSegment(const String &tripId, const SegmentData &segment)
{
  if (!isReady()) return;

  FirebaseJson json;
  json.set("segmentId", segment.segmentId);
  json.set("fromZone", segment.fromZone);
  json.set("toZone", segment.toZone);
  json.set("departureTimestamp", (int)segment.departureTimestamp);
  json.set("arrivalTimestamp", (int)segment.arrivalTimestamp);
  json.set("travelTimeSec", (int)segment.travelTimeSec);
  json.set("holdTimeSec", (int)segment.holdTimeSec);
  json.set("driverId", segment.driverId);
  json.set("sessionId", segment.sessionId);
  json.set("tripNumber", segment.tripNumber);

  String path = "/vehicles/" + activeVehicleId + "/trips/" + tripId + "/segments/" + segment.segmentId;

  if (Firebase.RTDB.setJSON(&fbdo, path, &json))
  {
    Serial.printf("Segment %s uploaded to %s\n", segment.segmentId.c_str(), path.c_str());
  }
  else
  {
    Serial.printf("Segment upload failed: %s\n", fbdo.errorReason().c_str());
  }
}

void FirebaseManager::uploadDriverSession(const DriverSessionData &session)
{
  if (!isReady() || session.sessionId.length() == 0) return;

  FirebaseJson json;
  json.set("sessionId", session.sessionId);
  json.set("driverId", session.driverId);
  json.set("vehicleId", activeVehicleId);
  json.set("startTime", (int)session.startTime);
  json.set("endTime", (int)session.endTime);
  json.set("status", session.status);
  json.set("tripsCompleted", session.tripsCompleted);
  json.set("totalDurationSec", (int)session.totalDurationSec);
  json.set("movementSec", (int)session.movementSec);
  json.set("holdingSec", (int)session.holdingSec);

  String path = "/vehicles/" + activeVehicleId + "/driver_sessions/" + session.sessionId;

  if (Firebase.RTDB.setJSON(&fbdo, path, &json))
  {
    Serial.printf("Driver session %s uploaded to %s\n", session.sessionId.c_str(), path.c_str());
  }
  else
  {
    Serial.printf("Driver session upload failed: %s\n", fbdo.errorReason().c_str());
  }
}

void FirebaseManager::uploadRouteAnalytics(const RouteAnalyticsData &analytics)
{
  if (!isReady() || analytics.routeKey.length() == 0) return;

  FirebaseJson json;
  json.set("fromZone", analytics.fromZone);
  json.set("toZone", analytics.toZone);
  json.set("routeKey", analytics.routeKey);
  json.set("occurrenceCount", analytics.occurrenceCount);
  json.set("totalTravelTimeSec", (int)analytics.totalTravelTimeSec);
  json.set("averageTravelTimeSec", (int)analytics.averageTravelTimeSec);
  json.set("totalHoldTimeSec", (int)analytics.totalHoldTimeSec);
  json.set("averageHoldTimeSec", (int)analytics.averageHoldTimeSec);

  String path = "/vehicles/" + activeVehicleId + "/route_analytics/" + analytics.routeKey;

  if (Firebase.RTDB.setJSON(&fbdo, path, &json))
  {
    Serial.printf("Route Analytics %s uploaded to %s\n", analytics.routeKey.c_str(), path.c_str());
  }
  else
  {
    Serial.printf("Route Analytics upload failed: %s\n", fbdo.errorReason().c_str());
  }
}
