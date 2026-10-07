#pragma once

#include <Arduino.h>
#include <RTClib.h>

class TimeManager
{
public:
  TimeManager();

  bool begin(TwoWire &wirePort = Wire);
  void update();

  bool isRtcOk() const { return rtcOK; }

  // Current Epoch / Unix timestamp in seconds
  uint32_t getEpoch() const { return currentEpoch; }

  // Formatted date ("YYYY-MM-DD") and time ("HH:MM:SS")
  const char* getDateString() const { return dateBuffer; }
  const char* getTimeString() const { return timeBuffer; }

  // Set or synchronize RTC with Unix timestamp (e.g. from NTP or Firebase)
  void setEpoch(uint32_t epoch);

  // Helper to compute duration in seconds between two epoch timestamps
  static uint32_t getDurationSec(uint32_t startEpoch, uint32_t endEpoch);

private:
  RTC_DS3231 rtc;
  bool rtcOK;

  uint32_t currentEpoch;
  char dateBuffer[20];
  char timeBuffer[20];

  unsigned long lastSyncMillis;
};

extern TimeManager timeManager;
