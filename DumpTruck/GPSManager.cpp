#include "GPSManager.h"

GPSManager gpsManager;

GPSManager::GPSManager()
  : gpsSerial(2),
    latitude(0.0),
    longitude(0.0),
    altitude(0.0),
    speedKmph(0.0),
    satellites(0),
    gpsLocationValid(false),
    gpsAltitudeValid(false)
{
}

void GPSManager::begin(uint8_t rxPin, uint8_t txPin, unsigned long baud)
{
  gpsSerial.begin(baud, SERIAL_8N1, rxPin, txPin);
  Serial.printf("GPS initialized on RX=%d, TX=%d at %lu baud.\n", rxPin, txPin, baud);
}

void GPSManager::update()
{
  while (gpsSerial.available())
  {
    gps.encode(gpsSerial.read());
  }

  if (gps.location.isUpdated() && gps.location.isValid())
  {
    latitude = gps.location.lat();
    longitude = gps.location.lng();
    gpsLocationValid = true;
  }

  if (gps.altitude.isUpdated() && gps.altitude.isValid())
  {
    altitude = gps.altitude.meters();
    gpsAltitudeValid = true;
  }

  if (gps.speed.isValid())
  {
    speedKmph = gps.speed.kmph();
  }

  if (gps.satellites.isValid())
  {
    satellites = gps.satellites.value();
  }
}
