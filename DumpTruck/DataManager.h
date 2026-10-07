#pragma once

#include <Arduino.h>
#include <RTClib.h>
#include "Config.h"

struct SystemStatus
{
  bool rtcOK;
  bool pn532OK;
  bool mpuOK;
  bool firebaseOK;
  bool wifiOK;
  int wifiRSSI;
};

class DataManager
{
public:
  DataManager();

  void begin();
  void initSensorsAndRTC();
  void performBootRecovery();
  void updateRTC();
  void updateVibration();
  void updateAllSensors();

  // Hardware Status Checks
  bool isRtcOk() const { return rtcOK; }
  void setRtcOk(bool ok) { rtcOK = ok; }

  // Vibration logic (reads both analog & digital; digital triggers detection = YES)
  int getVibA0() const { return vibA0; }
  int getVibD0() const { return vibD0; }
  bool isVibrationDetected() const;

  // Vehicle motion & state
  bool isVehicleMoving() const;
  VehicleState getCurrentState() const { return currentState; }
  String getStateName() const;
  static String getStateName(VehicleState state);
  void changeState(VehicleState newState);

  // Driver management
  String getCurrentDriverID() const { return currentDriverID; }
  void assignDriver(const String &driverID);
  void clearDriver();

  // Cycle tracking
  int getCycleNumber() const { return cycleNumber; }
  void resetShift();

  // State Machine & Zone logic
  void processStateMachine(const String &currentBeaconID);
  void checkNFCReading();
  void checkMovementSecurity();

  // LED indications
  void setLedState(uint8_t pin, uint8_t val);
  void allLEDOff();
  void startupLEDTest();
  void validDriverLED();
  void invalidDriverLED();
  void updateSystemHealthLED();

  // RTC time string buffers
  const char* getDateString() const;
  const char* getTimeString() const;

  // Beacon / UUID tracking
  String getDetectedBeaconID() const { return detectedBeaconID; }
  String getDetectedZoneName() const { return detectedZoneName; }

  // Console output
  void printStatus();

private:
  RTC_DS3231 rtc;
  bool rtcOK;

  char dateBuffer[20];
  char timeBuffer[20];

  int vibA0;
  int vibD0;

  VehicleState currentState;
  String currentDriverID;
  String currentNFCUID;
  String detectedBeaconID;
  String detectedZoneName;
  String lastArrivalBeaconID;

  int cycleNumber;
  unsigned long cycleStartMillis;
  unsigned long excavatorArrivalMillis;
  unsigned long loadingStartMillis;
  unsigned long loadingEndMillis;
  unsigned long dumpingArrivalMillis;
  unsigned long dumpCompleteMillis;

  // Loading detection vibration timing
  unsigned long vibrationStartMillis;
  unsigned long vibrationStopMillis;
  bool loadingVibrationDetected;

  bool unauthorizedMovementReported;

  // Sub-state machine routines
  void processExcavator(const String &beacon, const String &zoneName);
  void processDumping(const String &beacon, const String &zoneName);
  void processNextCycle();
  void processParking(const String &beacon, const String &zoneName);
};

extern DataManager dataManager;
