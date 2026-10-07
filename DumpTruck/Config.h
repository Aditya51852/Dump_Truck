#pragma once

#include <Arduino.h>

// ============================================================
// DEVICE / MODULE IDENTIFICATION
// ============================================================
#define MODULE_ID       "MODULE_001"
#define VEHICLE_ID      "DUMPER_001"

// ============================================================
// WIFI CONFIGURATION
// ============================================================
#define WIFI_SSID "Housetech_4G"
#define WIFI_PASSWORD "Housetech@76907"

// ============================================================
// FIREBASE CONFIGURATION
// ============================================================
#define API_KEY "AIzaSyAtpstAmJiPxkjQ1RSUslfm6Ws4Tq9QDR8"
#define DATABASE_URL                                                           \
  "https://dump-truck-876a6-default-rtdb.asia-southeast1.firebasedatabase.app"
#define USER_EMAIL "esp32@heuronics.com"
#define USER_PASSWORD "Aditya@5#"

// ============================================================
// PIN DEFINITIONS
// ============================================================
// I2C Pins (Used by DS3231, PN532, MPU6500)
#define I2C_SDA 21
#define I2C_SCL 22

// PN532 NFC Pins
#define PN532_IRQ 26
#define PN532_RESET 25

// GPS Serial Pins
#define GPS_RX 16
#define GPS_TX 17

// Vibration Sensor Pins
#define VIB_A0 34
#define VIB_D0 27

// Status Indicator LEDs
#define LED_GREEN 4
#define LED_YELLOW 32
#define LED_RED 33

// ============================================================
// SENSOR CONFIGURATIONS
// ============================================================
// MPU6500
#define MPU6500_ADDR 0x69
#define MPU_WHO_AM_I 0x75
#define MPU_PWR_MGMT_1 0x6B
#define MPU_ACCEL_CONFIG 0x1C
#define MPU_GYRO_CONFIG 0x1B
#define MPU_ACCEL_XOUT_H 0x3B
#define MPU_GYRO_XOUT_H 0x43

// ============================================================
// BLE BEACON CONFIGURATION
// ============================================================
#define BEACON_SERVICE_UUID "12345678-1234-5678-1234-56789abcdef0"
#define EXCAVATOR_BEACON_ID "EXC001"
#define DUMPING_BEACON_ID "DUMP001"
#define PARKING_BEACON_ID "PARK001"

#define BEACON_TIMEOUT 3500      // ms before beacon is considered lost
#define BEACON_MIN_RSSI -100     // dBm minimum threshold
#define BEACON_CONFIRM_COUNT 2   // Consecutive detections
#define BEACON_CONFIRM_TIME 1500 // ms confirmation window

// ============================================================
// LOGIC THRESHOLDS & TIMERS
// ============================================================
#define LOADING_VIBRATION_TIME 3000 // ms continuous vibration to start loading
#define LOADING_STOP_TIME 5000      // ms without vibration to complete loading
#define MOVEMENT_SPEED_KMPH 2.0     // km/h threshold for movement detection
#define MOVEMENT_DIST_METERS 20.0   // meters threshold for movement detection
#define GPS_MIN_SATELLITES   4      // minimum satellites for valid fix

// Task Execution Intervals (ms)
#define SENSOR_INTERVAL      1000
#define FIREBASE_INTERVAL    5000
#define WIFI_CHECK_INTERVAL  5000
#define BEACON_INTERVAL      1000
#define NFC_INTERVAL         300
#define DAILY_STATS_INTERVAL 30000

// ============================================================
// VEHICLE STATE ENUM
// ============================================================
enum VehicleState {
  PARKED,
  DRIVER_ASSIGNED,
  TO_EXCAVATOR,
  AT_EXCAVATOR,
  LOADING,
  TO_DUMPING,
  AT_DUMPING,
  DUMP_COMPLETE
};
