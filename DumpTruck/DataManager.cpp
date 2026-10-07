#include "DataManager.h"
#include "FirebaseManager.h"
#include "GPSManager.h"
#include "IMUManager.h"
#include "NFCManager.h"
#include "TimeManager.h"
#include "MovementManager.h"
#include "TimingManager.h"
#include "CycleManager.h"

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
    lastArrivalBeaconID(""),
    cycleNumber(0),
    cycleStartMillis(0),
    excavatorArrivalMillis(0),
    loadingStartMillis(0),
    loadingEndMillis(0),
    dumpingArrivalMillis(0),
    dumpCompleteMillis(0),
    vibrationStartMillis(0),
    vibrationStopMillis(0),
    loadingVibrationDetected(false),
    unauthorizedMovementReported(false)
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
  rtcOK = timeManager.begin(Wire);
  movementManager.begin();
  timingManager.begin();
  cycleManager.begin();
}

void DataManager::performBootRecovery()
{
  Serial.println();
  Serial.println("==========================================");
  Serial.println(">>> EXECUTING POWER-ON STATE RECOVERY <<<");
  Serial.println("==========================================");

  LastVehicleState lastState;
  bool fetched = firebaseManager.fetchLastKnownState(lastState);

  if (fetched && lastState.valid)
  {
    currentDriverID = lastState.driverId;
    cycleNumber = lastState.cycleNumber;
    cycleManager.setCycleNumber(cycleNumber);
    currentState = (VehicleState)lastState.state;

    if (currentDriverID.length() > 0)
    {
      timingManager.onDriverAssigned(currentDriverID);
      Serial.printf("Recovered Driver: %s\n", currentDriverID.c_str());
    }

    uint32_t nowEpoch = timeManager.getEpoch();
    if (lastState.timestamp > 0 && nowEpoch >= lastState.timestamp)
    {
      uint32_t offlineSec = nowEpoch - lastState.timestamp;
      Serial.printf("System was offline for: %lu seconds\n", (unsigned long)offlineSec);

      bool locationValid = gpsManager.isLocationValid();
      int sats = gpsManager.getSatellites();

      if (locationValid && sats >= movementManager.getMinimumSatellites() &&
          lastState.latitude != 0.0 && lastState.longitude != 0.0)
      {
        double dist = MovementManager::calculateDistanceMeters(
          lastState.latitude, lastState.longitude,
          gpsManager.getLatitude(), gpsManager.getLongitude()
        );

        Serial.printf("Calculated displacement during offline: %.2f meters\n", dist);

        if (dist >= movementManager.getDistanceThreshold())
        {
          Serial.println("ALERT: Vehicle moved while offline!");
          bool hadDriver = (currentDriverID.length() > 0);
          timingManager.addRecoveredMovement(offlineSec, hadDriver);

          if (!hadDriver)
          {
            firebaseManager.uploadEvent("MOVEMENT_WITHOUT_DRIVER");
          }
        }
        else
        {
          Serial.println("Vehicle remained stationary while offline.");
          timingManager.addRecoveredHolding(offlineSec, currentState);
        }
      }
      else
      {
        Serial.println("GPS fix unavailable at boot; attributing offline duration to holding.");
        timingManager.addRecoveredHolding(offlineSec, currentState);
      }
    }

    firebaseManager.uploadEvent("POWER_ON_RECOVERY");
  }
  else
  {
    Serial.println("No previous state to recover. Starting fresh in PARKED state.");
    currentState = PARKED;
    cycleNumber = 0;
    currentDriverID = "";
    cycleManager.setCycleNumber(0);
  }

  timingManager.onStateChanged(currentState);
  Serial.println("==========================================");
}

void DataManager::updateRTC()
{
  timeManager.update();
  strncpy(dateBuffer, timeManager.getDateString(), sizeof(dateBuffer) - 1);
  strncpy(timeBuffer, timeManager.getTimeString(), sizeof(timeBuffer) - 1);
}

const char* DataManager::getDateString() const
{
  return timeManager.getDateString();
}

const char* DataManager::getTimeString() const
{
  return timeManager.getTimeString();
}

void DataManager::updateVibration()
{
  // Read both analog and digital signals simultaneously
  vibA0 = analogRead(VIB_A0);
  vibD0 = digitalRead(VIB_D0);
}

bool DataManager::isVibrationDetected() const
{
  // If digital detection triggers (HIGH) OR analog threshold is exceeded, detection state is YES
  return (vibD0 == HIGH || vibA0 > 2000);
}

bool DataManager::isVehicleMoving() const
{
  return movementManager.isMoving();
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

  Serial.printf("State transition: %s -> %s\n",
                getStateName(currentState).c_str(),
                getStateName(newState).c_str());

  currentState = newState;
  timingManager.onStateChanged(newState);
  firebaseManager.uploadEvent("STATE_CHANGE");
}

void DataManager::assignDriver(const String &driverID)
{
  currentDriverID = driverID;
  timingManager.onDriverAssigned(driverID);
}

void DataManager::clearDriver()
{
  currentDriverID = "";
  timingManager.onDriverCleared();
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
  lastArrivalBeaconID = "";

  timingManager.resetShift();
  cycleManager.setCycleNumber(0);
}

void DataManager::checkMovementSecurity()
{
  if (isVehicleMoving() && currentDriverID.length() == 0)
  {
    if (!unauthorizedMovementReported)
    {
      unauthorizedMovementReported = true;
      Serial.println();
      Serial.println("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
      Serial.println("ALERT: MOVEMENT WITHOUT DRIVER DETECTED!");
      Serial.println("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
      firebaseManager.uploadEvent("MOVEMENT_WITHOUT_DRIVER");
    }
  }
  else if (!isVehicleMoving())
  {
    unauthorizedMovementReported = false;
  }
}

void DataManager::updateAllSensors()
{
  updateRTC();
  gpsManager.update();
  movementManager.update();
  updateVibration();
  imuManager.update();

  String zoneType = firebaseManager.inferZoneType(detectedBeaconID, detectedZoneName);
  bool moving = isVehicleMoving();

  timingManager.update(currentState, moving, zoneType, currentDriverID);
  cycleManager.update(moving, zoneType);

  checkMovementSecurity();

  // If a cycle just completed, upload it immediately
  if (cycleManager.hasCompletedCycleToUpload())
  {
    firebaseManager.uploadCycle(cycleManager.getLastCompletedCycle());
    firebaseManager.uploadDailyStats(timingManager.getDailyStats());
    cycleManager.clearUploadPending();
  }
}

void DataManager::processExcavator(const String &beaconID, const String &zoneName)
{
  if (currentState == TO_EXCAVATOR || currentState == PARKED ||
      currentState == DRIVER_ASSIGNED || currentState == DUMP_COMPLETE)
  {
    excavatorArrivalMillis = millis();
    changeState(AT_EXCAVATOR);

    if (lastArrivalBeaconID != beaconID)
    {
      lastArrivalBeaconID = beaconID;
      firebaseManager.uploadEvent("EXCAVATOR_ARRIVAL", beaconID, zoneName);
    }

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

    if (lastArrivalBeaconID != beaconID)
    {
      lastArrivalBeaconID = beaconID;
      firebaseManager.uploadEvent("DUMPING_STATION_ARRIVAL", beaconID, zoneName);
    }

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
      cycleManager.completeCycle();
      timingManager.incrementDailyCycleCount();
      firebaseManager.uploadCycle(cycleManager.getLastCompletedCycle());
      firebaseManager.uploadEvent("CYCLE_COMPLETED");

      cycleNumber++;
      cycleManager.startCycle(cycleNumber, currentDriverID);

      cycleStartMillis = millis();
      excavatorArrivalMillis = 0;
      loadingStartMillis = 0;
      loadingEndMillis = 0;
      dumpingArrivalMillis = 0;
      dumpCompleteMillis = 0;
      lastArrivalBeaconID = "";

      changeState(TO_EXCAVATOR);
      firebaseManager.uploadEvent("NEXT_CYCLE_STARTED");

      Serial.println();
      Serial.printf(">>> NEXT CYCLE STARTED: #%d <<<\n", cycleNumber);
    }
  }
}

void DataManager::processParking(const String &beaconID, const String &zoneName)
{
  if (currentState != PARKED)
  {
    if (lastArrivalBeaconID != beaconID)
    {
      lastArrivalBeaconID = beaconID;
      firebaseManager.uploadEvent("PARKING_ARRIVAL", beaconID, zoneName);
    }

    cycleManager.completeCycle();
    timingManager.incrementDailyCycleCount();
    firebaseManager.uploadCycle(cycleManager.getLastCompletedCycle());

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

  // 1. Match beacon ID with Firebase beacon configuration
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
    Serial.printf("[ZONE UNKNOWN] ID: %s (Not in Firebase configured zones)\n",
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

    timingManager.onDriverAssigned(currentDriverID);
    firebaseManager.uploadEvent("DRIVER_ASSIGNED");

    // Start trip
    currentState = TO_EXCAVATOR;
    cycleNumber++;
    cycleStartMillis = millis();
    cycleManager.startCycle(cycleNumber, currentDriverID);

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
  bool allOK = (timeManager.isRtcOk() && nfcOK && mpuOK);

  digitalWrite(LED_RED, allOK ? LOW : HIGH);

  Serial.println();
  Serial.println("======================================");
  Serial.println(" SYSTEM DIAGNOSTIC REPORT");
  Serial.println("--------------------------------------");
  Serial.printf("  RTC  (DS3231)  : %s\n", timeManager.isRtcOk() ? "OK" : "FAIL");
  Serial.printf("  NFC  (PN532)   : %s\n", nfcOK  ? "OK" : "FAIL");
  Serial.printf("  IMU  (MPU6500) : %s\n", mpuOK  ? "OK" : "FAIL");
  Serial.println("--------------------------------------");

  if (allOK)
  {
    Serial.println(" SYSTEM READY");
    Serial.printf(" STATE: %s\n", getStateName().c_str());
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
    if (!timeManager.isRtcOk())
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
  Serial.printf("VEHICLE: %s | STATE: %s\n", firebaseManager.getVehicleId().c_str(), getStateName().c_str());
  Serial.printf("Driver: %s | Cycle: %d (Dur: %lu s)\n",
                currentDriverID.length() > 0 ? currentDriverID.c_str() : "NONE",
                cycleManager.getCycleNumber(),
                (unsigned long)cycleManager.getCycleDurationSec());

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

  // Motion & Timing
  Serial.printf("Motion: %s | Move: %lu s | Hold: %lu s | Oper: %lu s\n",
                movementManager.isMoving() ? "MOVING" : "STOPPED",
                (unsigned long)timingManager.getTotalMovementSec(),
                (unsigned long)timingManager.getTotalHoldingSec(),
                (unsigned long)timingManager.getTotalOperatingSec());

  // Vibration (both analog and digital reported)
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
