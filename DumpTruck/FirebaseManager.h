#pragma once

#include <Arduino.h>
#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <vector>
#include "Config.h"

struct BeaconZoneInfo
{
  String id;
  String name;
  String type; // "EXCAVATOR", "DUMPING", "PARKING", "OTHER"
};

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

  // Dynamic Firebase vehicle_beacon_zones matching
  bool fetchBeaconZones();
  bool validateBeaconZone(const String &beaconID, String &zoneName, String &zoneType);
  static String inferZoneType(const String &id, const String &name);

  void uploadEvent(const String &eventName, const String &beaconID = "", const String &zoneName = "", int beaconRSSI = -127);
  void uploadCurrentStatus();
  bool findDriverFromNFC(const String &uid, String &driverID);

private:
  FirebaseData fbdo;
  FirebaseAuth auth;
  FirebaseConfig config;
  bool firebaseStarted;
  std::vector<BeaconZoneInfo> cachedZones;
};

extern FirebaseManager firebaseManager;
