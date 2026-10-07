/*
  ============================================================
             DUMPER 001 - COMPLETE VEHICLE MODULE
  ============================================================

  ESP32 MAIN / TRUCK MODULE

  Architecture:
  - Config.h          : Pinouts, credentials, thresholds, and enums
  - TimeManager       : RTC DS3231, epoch time, and formatted timestamps
  - MovementManager   : Haversine distance, speed, and motion state
  - TimingManager     : Operational movement, holding, and zone durations
  - CycleManager      : Cycle tracking and historical cycle records
  - BLEManager        : Background BLE beacon scanning and filtering
  - GPSManager        : Serial GPS parser using TinyGPSPlus
  - NFCManager        : Adafruit PN532 RFID/NFC driver
  - IMUManager        : MPU6500 6-DOF Accelerometer and Gyroscope
  - DataManager       : State machine, dual vibration detection, and recovery
  - FirebaseManager   : WiFi, dynamic config, RTDB telemetry, and history
  ============================================================
*/

#include <Wire.h>
#include "Config.h"
#include "TimeManager.h"
#include "MovementManager.h"
#include "TimingManager.h"
#include "CycleManager.h"
#include "TripManager.h"
#include "DataManager.h"
#include "GPSManager.h"
#include "IMUManager.h"
#include "BLEManager.h"
#include "NFCManager.h"
#include "FirebaseManager.h"

// Hardware / Subsystem Managers
BLEManager ble;

// Task timers
static unsigned long lastSensorRead      = 0;
static unsigned long lastFirebaseUpload  = 0;
static unsigned long lastWiFiCheck       = 0;
static unsigned long lastBeaconCheck     = 0;
static unsigned long lastNFCCheck        = 0;
static unsigned long lastDailyStatsUpload = 0;

void setup()
{
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("======================================");
  Serial.println(" ESP32 DUMPER MONITORING SYSTEM");
  Serial.println("======================================");

  // 1. Initialize GPIO, LEDs, and Vibration sensor
  dataManager.begin();

  // 2. Initialize Shared I2C Bus
  Wire.begin(I2C_SDA, I2C_SCL);
  Wire.setClock(400000);
  Serial.println("I2C bus initialized at 400kHz.");

  // 2.5 I2C Bus Scanner — diagnose which devices are present
  Serial.println();
  Serial.println("--- I2C BUS SCAN ---");
  int devicesFound = 0;
  for (uint8_t addr = 1; addr < 127; addr++)
  {
    Wire.beginTransmission(addr);
    uint8_t error = Wire.endTransmission();
    if (error == 0)
    {
      Serial.printf("  I2C device found at 0x%02X", addr);
      if (addr == 0x24)      Serial.print("  (PN532 NFC)");
      else if (addr == 0x48) Serial.print("  (PN532 NFC alt)");
      else if (addr == 0x68) Serial.print("  (DS3231 RTC)");
      else if (addr == 0x69) Serial.print("  (MPU6500 IMU)");
      Serial.println();
      devicesFound++;
    }
  }
  Serial.printf("Total I2C devices found: %d\n", devicesFound);
  Serial.println("--- END I2C SCAN ---");
  Serial.println();

  // 3. Initialize DS3231 RTC & Modular Managers
  dataManager.initSensorsAndRTC();

  // 4. Initialize PN532 NFC Module (with retry)
  {
    bool nfcOK = false;
    for (int attempt = 1; attempt <= 3; attempt++)
    {
      Serial.printf("PN532 init attempt %d/3...\n", attempt);
      nfcOK = nfcManager.begin(PN532_IRQ, PN532_RESET);
      if (nfcOK) break;
      delay(500);
      // Reset the I2C bus between retries
      Wire.end();
      delay(100);
      Wire.begin(I2C_SDA, I2C_SCL);
      Wire.setClock(400000);
    }
    if (!nfcOK)
    {
      Serial.println("WARNING: PN532 failed after 3 attempts!");
      Serial.println("  -> Check I2C wiring (SDA=21, SCL=22)");
      Serial.println("  -> Check PN532 power supply (3.3V)");
      Serial.println("  -> Verify PN532 I2C mode (DIP switches: SEL0=OFF, SEL1=ON)");
    }
  }

  // 5. Initialize MPU6500 IMU
  imuManager.begin(MPU6500_ADDR);

  // 6. Initialize GPS Module
  gpsManager.begin(GPS_RX, GPS_TX, 9600);

  // 7. Initialize BLE Beacon Scanner
  ble.begin();

  // 8. Connect to WiFi
  firebaseManager.connectWiFi();

  // 9. Initialize Firebase RTDB
  firebaseManager.begin();

  // 10. Perform Power-On Recovery (Fetch last known state, calculate offline movement/holding)
  dataManager.performBootRecovery();

  // 11. Perform System Diagnostic & LED indication
  dataManager.updateSystemHealthLED();
}

void loop()
{
  // ----------------------------------------------------------
  // Continuous GPS stream ingestion
  // ----------------------------------------------------------
  gpsManager.update();

  // ----------------------------------------------------------
  // WiFi connectivity monitor
  // ----------------------------------------------------------
  if (millis() - lastWiFiCheck >= WIFI_CHECK_INTERVAL)
  {
    lastWiFiCheck = millis();
    firebaseManager.checkWiFi();
  }

  // ----------------------------------------------------------
  // Periodic sensor readings & status print
  // ----------------------------------------------------------
  if (millis() - lastSensorRead >= SENSOR_INTERVAL)
  {
    lastSensorRead = millis();
    dataManager.updateAllSensors();
    dataManager.printStatus();
  }

  // ----------------------------------------------------------
  // NFC badge detection & driver check
  // ----------------------------------------------------------
  if (millis() - lastNFCCheck >= NFC_INTERVAL)
  {
    lastNFCCheck = millis();
    dataManager.checkNFCReading();
  }

  // ----------------------------------------------------------
  // BLE beacon scan & state machine evaluation
  // ----------------------------------------------------------
  if (millis() - lastBeaconCheck >= BEACON_INTERVAL)
  {
    lastBeaconCheck = millis();

    // Active BLE scan
    ble.update();

    String detectedUUID = ble.getUUID();
    String beaconZone = ble.getBeaconZone();

    if (detectedUUID != "")
    {
      Serial.print("BLE UUID Detected: ");
      Serial.println(detectedUUID);
      Serial.print("BLE Beacon Zone: ");
      Serial.println(beaconZone.length() > 0 ? beaconZone : "UNKNOWN");
    }

    // Update vehicle state machine based on extracted beacon zone ID
    dataManager.processStateMachine(beaconZone);
  }

  // ----------------------------------------------------------
  // Firebase telemetry status upload
  // ----------------------------------------------------------
  if (millis() - lastFirebaseUpload >= FIREBASE_INTERVAL)
  {
    lastFirebaseUpload = millis();
    firebaseManager.uploadCurrentStatus();
  }

  // ----------------------------------------------------------
  // Periodic Daily Statistics upload
  // ----------------------------------------------------------
  if (millis() - lastDailyStatsUpload >= DAILY_STATS_INTERVAL)
  {
    lastDailyStatsUpload = millis();
    firebaseManager.uploadDailyStats(timingManager.getDailyStats());
  }
}
