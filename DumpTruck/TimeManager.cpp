#include "TimeManager.h"

TimeManager timeManager;

TimeManager::TimeManager()
  : rtcOK(false),
    currentEpoch(0),
    lastSyncMillis(0)
{
  strcpy(dateBuffer, "0000-00-00");
  strcpy(timeBuffer, "00:00:00");
}

bool TimeManager::begin(TwoWire &wirePort)
{
  Serial.println();
  Serial.println("Initializing TimeManager (DS3231 RTC)...");

  if (rtc.begin(&wirePort))
  {
    rtcOK = true;
    Serial.println("DS3231 RTC detected successfully.");

    if (rtc.lostPower())
    {
      Serial.println("WARNING: RTC lost power! Initializing with compile time.");
      rtc.adjust(DateTime(F(__DATE__), F(__TIME__)));
    }

    update();
    Serial.printf("Current RTC Time: %s %s (Epoch: %lu)\n",
                  dateBuffer, timeBuffer, (unsigned long)currentEpoch);
    return true;
  }
  else
  {
    rtcOK = false;
    Serial.println("ERROR: DS3231 RTC not detected!");
    return false;
  }
}

void TimeManager::update()
{
  if (!rtcOK)
  {
    // Fallback: estimate epoch using millis() if RTC is absent
    if (currentEpoch > 0)
    {
      unsigned long nowMs = millis();
      if (nowMs - lastSyncMillis >= 1000)
      {
        currentEpoch += (nowMs - lastSyncMillis) / 1000;
        lastSyncMillis = nowMs;
      }
    }
    return;
  }

  DateTime now = rtc.now();
  currentEpoch = now.unixtime();
  lastSyncMillis = millis();

  snprintf(dateBuffer, sizeof(dateBuffer), "%04d-%02d-%02d",
           now.year(), now.month(), now.day());

  snprintf(timeBuffer, sizeof(timeBuffer), "%02d:%02d:%02d",
           now.hour(), now.minute(), now.second());
}

void TimeManager::setEpoch(uint32_t epoch)
{
  if (epoch == 0) return;

  currentEpoch = epoch;
  if (rtcOK)
  {
    rtc.adjust(DateTime(epoch));
    Serial.printf("RTC adjusted to Epoch: %lu\n", (unsigned long)epoch);
  }
  update();
}

uint32_t TimeManager::getDurationSec(uint32_t startEpoch, uint32_t endEpoch)
{
  if (endEpoch >= startEpoch)
  {
    return endEpoch - startEpoch;
  }
  return 0;
}
