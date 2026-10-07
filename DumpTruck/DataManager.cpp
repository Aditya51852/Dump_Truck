#include "DataManager.h"
#include "FirebaseManager.h"
#include "GPSManager.h"
#include "IMUManager.h"
#include "NFCManager.h"

DataManager dataManager;

DataManager::DataManager()
  : rtcOK(false),
    vibA0(0),
    vibD0(0),
    currentState(PARKED),
    currentDriverID(""),
    currentNFCUID(""),
    detectedBeaconID(""),
    detectedZoneName(""),
    cycleNumber(0),
    cycleStartMillis(0),
    excavatorArrivalMillis(0),
    loadingStartMillis(0),
    loadingEndMillis(0),
    dumpingArrivalMillis(0),
    dumpCompleteMillis(0),
    vibrationStartMillis(0),
    vibrationStopMillis(0),
    loadingVibrationDetected(false)
{
  strcpy(dateBuffer, "0000-00-00");
  strcpy(timeBuffer, "00:00:00");
}

void DataManager::begin()
{
  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_YELLOW, OUTPUT);
  pinMode(LED_RED, OUTPUT);

  allLEDOff();
  startupLEDTest();

  pinMode(VIB_D0, INPUT);
  analogReadResolution(12);

  Serial.println("Vibration sensor & LEDs initialized.");
}

void DataManager::initSensorsAndRTC()
{
  Serial.println();
  Serial.println("Initializing DS3231...");

  if (rtc.begin())
  {
    rtcOK = true;
    Serial.println("DS3231 detected.");

    if (rtc.lostPower())
    {
      Serial.println("RTC lost power.");
      rtc.adjust(DateTime(F(__DATE__), F(__TIME__)));
    }
  }
  else
  {
    rtcOK = false;
    Serial.println("ERROR: DS3231 not detected!");
  }
}

void DataManager::updateRTC()
{
  if (!rtcOK)
  {
    strcpy(dateBuffer, "0000-00-00");
    strcpy(timeBuffer, "00:00:00");
    return;
  }

  DateTime now = rtc.now();

  snprintf(dateBuffer, sizeof(dateBuffer), "%04d-%02d-%02d",
           now.year(), now.month(), now.day());

  snprintf(timeBuffer, sizeof(timeBuffer), "%02d:%02d:%02d",
           now.hour(), now.minute(), now.second());
}

void DataManager::updateVibration()
{
  vibA0 = analogRead(VIB_A0);
  vibD0 = digitalRead(VIB_D0);
}

void DataManager::updateAllSensors()
{
  updateRTC();
  gpsManager.update();
  updateVibration();
  imuManager.update();
}

bool DataManager::isVibrationDetected() const
{
  return (vibD0 == HIGH || vibA0 > 2000);
}

bool DataManager::isVehicleMoving() const
{
  return (gpsManager.isLocationValid() &&
          gpsManager.getSpeedKmph() >= MOVEMENT_SPEED_KMPH);
}

String DataManager::getStateName(VehicleState state)
{
  switch (state)
  {
    case PARKED:          return "PARKED";
    case DRIVER_ASSIGNED: return "DRIVER_ASSIGNED";
    case TO_EXCAVATOR:    return "TO_EXCAVATOR";
    case AT_EXCAVATOR:    return "AT_EXCAVATOR";
    case LOADING:         return "LOADING";
    case TO_DUMPING:      return "TO_DUMPING";
    case AT_DUMPING:      return "AT_DUMPING";
    case DUMP_COMPLETE:   return "DUMP_COMPLETE";
    default:              return "UNKNOWN";
  }
}

String DataManager::getStateName() const
{
  return getStateName(currentState);
}

void DataManager::changeState(VehicleState newState)
{
  if (currentState == newState)
  {
    return;
  }

  String oldState = getStateName();
  currentState = newState;

  Serial.println();
  Serial.print("STATE CHANGE: ");
  Serial.print(oldState);
  Serial.print(" -> ");
  Serial.println(getStateName());

  firebaseManager.uploadEvent("STATE_CHANGE");
}

void DataManager::assignDriver(const String &driverID)
{
  currentDriverID = driverID;
}

void DataManager::clearDriver()
{
  currentDriverID = "";
  currentNFCUID = "";
}

void DataManager::resetShift()
{
  cycleNumber = 0;
  cycleStartMillis = 0;
  excavatorArrivalMillis = 0;
  loadingStartMillis = 0;
  loadingEndMillis = 0;
  dumpingArrivalMillis = 0;
  dumpCompleteMillis = 0;

  loadingVibrationDetected = false;
  vibrationStartMillis = 0;
  vibrationStopMillis = 0;
}

void DataManager::processExcavator(const String &beaconID, const String &zoneName)
{
  if (currentState == TO_EXCAVATOR || currentState == PARKED || currentState == DRIVER_ASSIGNED || currentState == DUMP_COMPLETE)
  {
    excavatorArrivalMillis = millis();
    changeState(AT_EXCAVATOR);
    firebaseManager.uploadEvent("EXCAVATOR_ARRIVAL", beaconID, zoneName);

    Serial.println();
    Serial.printf(">>> EXCAVATOR AREA ARRIVED: %s (%s) <<<\n", beaconID.c_str(), zoneName.c_str());
  }

  if (currentState == AT_EXCAVATOR)
  {
    bool stopped = !isVehicleMoving();
    bool vibration = isVibrationDetected();

    if (stopped && vibration)
    {
      if (vibrationStartMillis == 0)
      {
        vibrationStartMillis = millis();
      }

      if (millis() - vibrationStartMillis >= LOADING_VIBRATION_TIME)
      {
        if (!loadingVibrationDetected)
        {
          loadingVibrationDetected = true;
          loadingStartMillis = millis();
          changeState(LOADING);
          firebaseManager.uploadEvent("LOADING_STARTED", beaconID, zoneName);

          Serial.println();
          Serial.println(">>> LOADING STARTED <<<");
        }
      }
    }
    else
    {
      vibrationStartMillis = 0;
    }
  }

  if (currentState == LOADING)
  {
    if (!isVibrationDetected())
    {
      if (vibrationStopMillis == 0)
      {
        vibrationStopMillis = millis();
      }

      if (millis() - vibrationStopMillis >= LOADING_STOP_TIME)
      {
        loadingEndMillis = millis();
        loadingVibrationDetected = false;
        vibrationStopMillis = 0;

        changeState(TO_DUMPING);
        firebaseManager.uploadEvent("LOADING_COMPLETED", beaconID, zoneName);

        Serial.println();
        Serial.println(">>> LOADING COMPLETED <<<");
      }
    }
    else
    {
      vibrationStopMillis = 0;
    }
  }
}

void DataManager::processDumping(const String &beaconID, const String &zoneName)
{
  if (currentState == TO_DUMPING || currentState == AT_EXCAVATOR || currentState == LOADING ||
      currentState == TO_EXCAVATOR || currentState == DRIVER_ASSIGNED || currentState == PARKED)
  {
    dumpingArrivalMillis = millis();
    changeState(AT_DUMPING);
    firebaseManager.uploadEvent("DUMPING_STATION_ARRIVAL", beaconID, zoneName);

    Serial.println();
    Serial.printf(">>> DUMPING STATION ARRIVED: %s (%s) <<<\n", beaconID.c_str(), zoneName.c_str());
  }

  if (currentState == AT_DUMPING)
  {
    if (isVehicleMoving())
    {
      dumpCompleteMillis = millis();
      changeState(DUMP_COMPLETE);
      firebaseManager.uploadEvent("DUMP_COMPLETED", beaconID, zoneName);

      Serial.println();
      Serial.println(">>> DUMP COMPLETED <<<");
    }
  }
}

void DataManager::processNextCycle()
{
  if (currentState == DUMP_COMPLETE)
  {
    if (isVehicleMoving())
    {
      cycleNumber++;
      cycleStartMillis = millis();
      excavatorArrivalMillis = 0;
      loadingStartMillis = 0;
      loadingEndMillis = 0;
      dumpingArrivalMillis = 0;
      dumpCompleteMillis = 0;

      changeState(TO_EXCAVATOR);
      firebaseManager.uploadEvent("NEXT_CYCLE_STARTED");

      Serial.println();
      Serial.print(">>> NEXT CYCLE: ");
      Serial.println(cycleNumber);
    }
  }
}

void DataManager::processParking(const String &beaconID, const String &zoneName)
{
  if (currentState != PARKED)
  {
    firebaseManager.uploadEvent("PARKING_ARRIVAL", beaconID, zoneName);

    clearDriver();
    resetShift();
    changeState(PARKED);
    firebaseManager.uploadEvent("SHIFT_RESET");

    Serial.println();
    Serial.println("==========================================");
    Serial.printf("TRUCK PARKED: %s (%s)\n", beaconID.c_str(), zoneName.c_str());
    Serial.println("SHIFT RESET");
    Serial.println("==========================================");
  }
  else
  {
    static unsigned long lastParkingPrint = 0;
    if (millis() - lastParkingPrint > 10000)
    {
      lastParkingPrint = millis();
      Serial.printf("Confirmed in Parking Area: %s (%s)\n", beaconID.c_str(), zoneName.c_str());
    }
  }
}

void DataManager::processStateMachine(const String &currentBeaconID)
{
  detectedBeaconID = currentBeaconID;

  if (currentBeaconID.length() == 0)
  {
    detectedZoneName = "";
    return;
  }

  // 1. Match beacon ID with Firebase vehicle_beacon_zones
  String zoneName = "";
  String zoneType = "";
  bool matched = firebaseManager.validateBeaconZone(currentBeaconID, zoneName, zoneType);

  if (matched)
  {
    detectedZoneName = zoneName;
    Serial.printf("[ZONE MATCH] ID: %s -> \"%s\" (Zone: %s)\n",
                  currentBeaconID.c_str(), zoneName.c_str(), zoneType.c_str());
  }
  else
  {
    detectedZoneName = "Unknown Zone";
    Serial.printf("[ZONE UNKNOWN] ID: %s (Not in Firebase vehicle_beacon_zones)\n",
                  currentBeaconID.c_str());
  }

  // 2. State & Status Transitions by Zone Type
  if (zoneType == "PARKING")
  {
    processParking(currentBeaconID, zoneName);
    return;
  }
  else if (zoneType == "EXCAVATOR")
  {
    processExcavator(currentBeaconID, zoneName);
    return;
  }
  else if (zoneType == "DUMPING")
  {
    processDumping(currentBeaconID, zoneName);
    return;
  }

  // 3. Fallback for sub-state routines
  if (currentState == AT_EXCAVATOR || currentState == LOADING)
  {
    processExcavator(currentBeaconID, zoneName);
  }
  else if (currentState == AT_DUMPING)
  {
    processDumping(currentBeaconID, zoneName);
  }
  else if (currentState == DUMP_COMPLETE)
  {
    processNextCycle();
  }
}

void DataManager::checkNFCReading()
{
  String uidString;
  if (!nfcManager.readCardUID(uidString))
  {
    return;
  }

  Serial.println();
  Serial.println("================================");
  Serial.println("NFC CARD DETECTED");
  Serial.print("UID: ");
  Serial.println(uidString);
  Serial.println("================================");

  if (uidString == currentNFCUID)
  {
    return;
  }

  currentNFCUID = uidString;
  String driverID = "";

  bool valid = firebaseManager.findDriverFromNFC(uidString, driverID);

  if (valid)
  {
    currentDriverID = driverID;
    currentState = DRIVER_ASSIGNED;
    validDriverLED();

    Serial.println("Driver successfully assigned.");
    Serial.print("Driver ID: ");
    Serial.println(currentDriverID);

    firebaseManager.uploadEvent("DRIVER_ASSIGNED");

    // Start trip
    currentState = TO_EXCAVATOR;
    cycleNumber++;
    cycleStartMillis = millis();

    firebaseManager.uploadEvent("TRIP_STARTED");
  }
  else
  {
    invalidDriverLED();
    Serial.println("Driver NOT assigned.");
    firebaseManager.uploadEvent("INVALID_NFC");
  }

  delay(1000);
  currentNFCUID = "";
}

// ============================================================
// LED CONTROL
// ============================================================
void DataManager::setLedState(uint8_t pin, uint8_t val)
{
  digitalWrite(pin, val);
}

void DataManager::allLEDOff()
{
  digitalWrite(LED_GREEN, LOW);
  digitalWrite(LED_YELLOW, LOW);
  digitalWrite(LED_RED, LOW);
}

void DataManager::startupLEDTest()
{
  digitalWrite(LED_GREEN, HIGH);
  digitalWrite(LED_YELLOW, HIGH);
  digitalWrite(LED_RED, HIGH);
  delay(500);

  allLEDOff();
  delay(300);
}

void DataManager::validDriverLED()
{
  Serial.println("GREEN LED: VALID DRIVER");
  digitalWrite(LED_GREEN, HIGH);
  delay(3000);
  digitalWrite(LED_GREEN, LOW);
}

void DataManager::invalidDriverLED()
{
  Serial.println("YELLOW LED: INVALID DRIVER");
  for (int i = 0; i < 3; i++)
  {
    digitalWrite(LED_YELLOW, HIGH);
    delay(200);
    digitalWrite(LED_YELLOW, LOW);
    delay(200);
  }
}

void DataManager::updateSystemHealthLED()
{
  bool nfcOK = nfcManager.isOk();
  bool mpuOK = imuManager.isOk();
  bool allOK = (rtcOK && nfcOK && mpuOK);

  digitalWrite(LED_RED, allOK ? LOW : HIGH);

  Serial.println();
  Serial.println("======================================");
  Serial.println(" SYSTEM DIAGNOSTIC REPORT");
  Serial.println("--------------------------------------");
  Serial.printf("  RTC  (DS3231)  : %s\n", rtcOK  ? "OK" : "FAIL");
  Serial.printf("  NFC  (PN532)   : %s\n", nfcOK  ? "OK" : "FAIL");
  Serial.printf("  IMU  (MPU6500) : %s\n", mpuOK  ? "OK" : "FAIL");
  Serial.println("--------------------------------------");

  if (allOK)
  {
    Serial.println(" SYSTEM READY");
    Serial.println(" STATE: PARKED");
    Serial.println(" BLE SCANNER: READY");
  }
  else
  {
    if (!nfcOK)
    {
      Serial.println(" WARNING: NFC OFFLINE - Driver assignment disabled");
      Serial.println("   -> Check PN532 wiring and I2C DIP switches");
    }
    if (!mpuOK)
    {
      Serial.println(" WARNING: IMU OFFLINE - No motion data");
    }
    if (!rtcOK)
    {
      Serial.println(" WARNING: RTC OFFLINE - No timestamps");
    }
    Serial.println(" SYSTEM RUNNING IN DEGRADED MODE");
  }
  Serial.println("======================================");
}

// ============================================================
// STATUS CONSOLE LOGGING
// ============================================================
void DataManager::printStatus()
{
  Serial.println();
  Serial.println("--------------------------------");
  Serial.printf("STATE: %s\n", getStateName().c_str());
  Serial.printf("Driver: %s\n", currentDriverID.length() > 0 ? currentDriverID.c_str() : "NONE");
  Serial.printf("Cycle: %d\n", cycleNumber);

  // GPS
  Serial.print("GPS: ");
  if (gpsManager.isLocationValid())
  {
    Serial.printf("%.6f, %.6f", gpsManager.getLatitude(), gpsManager.getLongitude());
  }
  else
  {
    Serial.print("NO FIX");
  }
  Serial.printf(" Speed: %.2f km/h Sat: %d\n", gpsManager.getSpeedKmph(), gpsManager.getSatellites());

  // Vibration
  Serial.printf("Vibration A0: %d D0: %d Detected: %s\n",
                vibA0, vibD0, isVibrationDetected() ? "YES" : "NO");

  // IMU
  Serial.printf("Accel: %.2f, %.2f, %.2f\n", imuManager.getAx(), imuManager.getAy(), imuManager.getAz());
  Serial.printf("Gyro:  %.2f, %.2f, %.2f\n", imuManager.getGx(), imuManager.getGy(), imuManager.getGz());

  // BLE
  Serial.print("BLE Detected: ");
  if (detectedBeaconID.length() > 0)
  {
    Serial.printf("%s (%s)\n", detectedBeaconID.c_str(),
                  detectedZoneName.length() > 0 ? detectedZoneName.c_str() : "Unknown Zone");
  }
  else
  {
    Serial.println("NONE");
  }
  Serial.println("--------------------------------");
}
