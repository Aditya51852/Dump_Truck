#pragma once

#include <Arduino.h>
#include <TinyGPSPlus.h>

class GPSManager
{
public:
  GPSManager();

  void begin(uint8_t rxPin, uint8_t txPin, unsigned long baud = 9600);
  void update();

  double getLatitude() const { return latitude; }
  double getLongitude() const { return longitude; }
  double getAltitude() const { return altitude; }
  double getSpeedKmph() const { return speedKmph; }
  int getSatellites() const { return satellites; }
  bool isLocationValid() const { return gpsLocationValid; }
  bool isAltitudeValid() const { return gpsAltitudeValid; }

private:
  HardwareSerial gpsSerial;
  TinyGPSPlus gps;

  double latitude;
  double longitude;
  double altitude;
  double speedKmph;
  int satellites;

  bool gpsLocationValid;
  bool gpsAltitudeValid;
};

extern GPSManager gpsManager;
