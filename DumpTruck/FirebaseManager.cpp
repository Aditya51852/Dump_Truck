#include "FirebaseManager.h"
#include "DataManager.h"
#include "GPSManager.h"
#include "IMUManager.h"
#include "NFCManager.h"

// Token & RTDB helper inclusions (only in this .cpp translation unit)
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"

FirebaseManager firebaseManager;

FirebaseManager::FirebaseManager()
  : firebaseStarted(false)
{
  // Pre-seed known default beacon zones so system works immediately even before WiFi sync
  cachedZones.push_back({"EXC001", "Excavator / Loding Area", "EXCAVATOR"});
  cachedZones.push_back({"DUMP001", "Dumping Staion", "DUMPING"});
  cachedZones.push_back({"PARK001", "Parking Area", "PARKING"});
}

void FirebaseManager::connectWiFi()
{
  if (WiFi.status() == WL_CONNECTED)
  {
    return;
  }

  Serial.println();
  Serial.println("Connecting to WiFi...");

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

  // Wait briefly and fetch dynamic beacon zones from Firebase
  delay(1000);
  if (isReady())
  {
    fetchBeaconZones();
  }
}

bool FirebaseManager::isReady()
{
  return (firebaseStarted && (WiFi.status() == WL_CONNECTED) && Firebase.ready());
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
  if (!isReady())
  {
    return false;
  }

  Serial.println();
  Serial.println(">>> Fetching vehicle_beacon_zones from Firebase RTDB <<<");

  if (Firebase.RTDB.getJSON(&fbdo, "/vehicle_beacon_zones"))
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
      value.trim();
      String zType = inferZoneType(key, value);
      cachedZones.push_back({key, value, zType});
      Serial.printf("  [Firebase Zone] %s: \"%s\" (Type: %s)\n",
                    key.c_str(), value.c_str(), zType.c_str());
    }
    json.iteratorEnd();

    Serial.printf("Loaded %d beacon zones from Firebase.\n", (int)cachedZones.size());
    return true;
  }
  else
  {
    Serial.print("Failed to fetch vehicle_beacon_zones: ");
    Serial.println(fbdo.errorReason());
    return false;
  }
}

bool FirebaseManager::validateBeaconZone(const String &beaconID, String &zoneName, String &zoneType)
{
  if (beaconID.length() == 0)
  {
    return false;
  }

  // 1. Check local cache (fastest)
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
    String path = "/vehicle_beacon_zones/" + beaconID;
    Serial.printf("Querying Firebase for beacon zone: %s\n", path.c_str());

    if (Firebase.RTDB.getString(&fbdo, path))
    {
      zoneName = fbdo.stringData();
      zoneName.trim();
      if (zoneName.length() > 0)
      {
        zoneType = inferZoneType(beaconID, zoneName);
        cachedZones.push_back({beaconID, zoneName, zoneType});
        Serial.printf("Firebase Zone matched: %s -> %s (%s)\n",
                      beaconID.c_str(), zoneName.c_str(), zoneType.c_str());
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

    cachedZones.push_back({beaconID, zoneName, zoneType});
    return true;
  }

  return false;
}

void FirebaseManager::uploadEvent(const String &eventName, const String &beaconID, const String &zoneName, int beaconRSSI)
{
  if (!isReady())
  {
    return;
  }

  FirebaseJson json;

  json.set("vehicleId", VEHICLE_ID);
  json.set("driverId", dataManager.getCurrentDriverID());
  json.set("event", eventName);
  json.set("state", (int)dataManager.getCurrentState());
  json.set("stateName", dataManager.getStateName());
  json.set("date", dataManager.getDateString());
  json.set("time", dataManager.getTimeString());
  json.set("latitude", gpsManager.getLatitude());
  json.set("longitude", gpsManager.getLongitude());
  json.set("speedKmph", gpsManager.getSpeedKmph());
  json.set("cycleNumber", dataManager.getCycleNumber());

  if (beaconID != "")
  {
    json.set("beaconId", beaconID);
    if (zoneName != "")
    {
      json.set("zoneName", zoneName);
    }
    json.set("beaconRSSI", beaconRSSI);
  }

  String path = "/vehicles/" + String(VEHICLE_ID) + "/events";

  if (Firebase.RTDB.pushJSON(&fbdo, path, &json))
  {
    Serial.print("Event uploaded: ");
    Serial.println(eventName);
  }
  else
  {
    Serial.print("Event upload failed: ");
    Serial.println(fbdo.errorReason());
  }
}

void FirebaseManager::uploadCurrentStatus()
{
  if (!isReady())
  {
    return;
  }

  FirebaseJson json;

  // Vehicle information
  json.set("vehicleId", VEHICLE_ID);
  json.set("driverId", dataManager.getCurrentDriverID());
  json.set("state", (int)dataManager.getCurrentState());
  json.set("stateName", dataManager.getStateName());
  json.set("cycleNumber", dataManager.getCycleNumber());

  // RTC
  json.set("date", dataManager.getDateString());
  json.set("time", dataManager.getTimeString());

  // GPS
  json.set("gps/latitude", gpsManager.getLatitude());
  json.set("gps/longitude", gpsManager.getLongitude());
  json.set("gps/altitude", gpsManager.getAltitude());
  json.set("gps/satellites", gpsManager.getSatellites());
  json.set("gps/speedKmph", gpsManager.getSpeedKmph());
  json.set("gps/locationValid", gpsManager.isLocationValid());

  // Vibration
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

  // Hardware Diagnostics
  json.set("system/rtc", dataManager.isRtcOk());
  json.set("system/pn532", nfcManager.isOk());
  json.set("system/mpu6500", imuManager.isOk());
  json.set("system/wifi", WiFi.status() == WL_CONNECTED);
  json.set("system/wifiRSSI", WiFi.RSSI());

  String path = "/vehicles/" + String(VEHICLE_ID) + "/current";

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

bool FirebaseManager::findDriverFromNFC(const String &uid, String &driverID)
{
  if (WiFi.status() != WL_CONNECTED)
  {
    Serial.println("WiFi unavailable - cannot validate driver.");
    return false;
  }

  if (!Firebase.ready())
  {
    Serial.println("Firebase not ready.");
    return false;
  }

  String path = "/nfc_cards/" + uid + "/driverId";

  Serial.print("Checking driver: ");
  Serial.println(path);

  if (Firebase.RTDB.getString(&fbdo, path))
  {
    driverID = fbdo.stringData();
    if (driverID.length() > 0)
    {
      Serial.print("Driver found: ");
      Serial.println(driverID);
      return true;
    }
  }

  Serial.print("Driver lookup failed: ");
  Serial.println(fbdo.errorReason());
  return false;
}
