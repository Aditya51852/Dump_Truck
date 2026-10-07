#include "CycleManager.h"
#include "TimeManager.h"

CycleManager cycleManager;

CycleManager::CycleManager()
  : lastTickEpoch(0),
    uploadPending(false)
{
  currentCycle.cycleNumber = 0;
  currentCycle.driverId = "";
  currentCycle.startTimeEpoch = 0;
  currentCycle.endTimeEpoch = 0;
  currentCycle.totalDurationSec = 0;
  currentCycle.movementSec = 0;
  currentCycle.holdingSec = 0;
  currentCycle.excavatorHoldingSec = 0;
  currentCycle.dumpingHoldingSec = 0;
  currentCycle.isCompleted = false;
}

void CycleManager::begin()
{
  uploadPending = false;
  lastTickEpoch = timeManager.getEpoch();
  Serial.println("CycleManager initialized.");
}

void CycleManager::startCycle(int cycleNum, const String &driverId)
{
  uint32_t nowEpoch = timeManager.getEpoch();

  currentCycle.cycleNumber = cycleNum;
  currentCycle.driverId = driverId;
  currentCycle.startTimeEpoch = nowEpoch;
  currentCycle.endTimeEpoch = 0;
  currentCycle.totalDurationSec = 0;
  currentCycle.movementSec = 0;
  currentCycle.holdingSec = 0;
  currentCycle.excavatorHoldingSec = 0;
  currentCycle.dumpingHoldingSec = 0;
  currentCycle.isCompleted = false;

  lastTickEpoch = nowEpoch;
  uploadPending = false;

  Serial.printf("CycleManager: Started Cycle #%d for Driver '%s' at epoch %lu\n",
                cycleNum, driverId.c_str(), (unsigned long)nowEpoch);
}

void CycleManager::update(bool isMoving, const String &currentZoneType)
{
  if (currentCycle.isCompleted || currentCycle.startTimeEpoch == 0)
  {
    return;
  }

  uint32_t nowEpoch = timeManager.getEpoch();
  if (lastTickEpoch == 0)
  {
    lastTickEpoch = nowEpoch;
    return;
  }

  uint32_t delta = 0;
  if (nowEpoch > lastTickEpoch)
  {
    delta = nowEpoch - lastTickEpoch;
    lastTickEpoch = nowEpoch;
  }
  else
  {
    return;
  }

  currentCycle.totalDurationSec += delta;

  if (isMoving)
  {
    currentCycle.movementSec += delta;
  }
  else
  {
    currentCycle.holdingSec += delta;

    if (currentZoneType == "EXCAVATOR")
    {
      currentCycle.excavatorHoldingSec += delta;
    }
    else if (currentZoneType == "DUMPING")
    {
      currentCycle.dumpingHoldingSec += delta;
    }
  }
}

uint32_t CycleManager::getCycleDurationSec() const
{
  uint32_t nowEpoch = timeManager.getEpoch();
  if (currentCycle.startTimeEpoch > 0 && nowEpoch >= currentCycle.startTimeEpoch)
  {
    return nowEpoch - currentCycle.startTimeEpoch;
  }
  return currentCycle.totalDurationSec;
}

void CycleManager::completeCycle()
{
  if (currentCycle.isCompleted || currentCycle.startTimeEpoch == 0)
  {
    return;
  }

  uint32_t nowEpoch = timeManager.getEpoch();
  currentCycle.endTimeEpoch = nowEpoch;
  currentCycle.totalDurationSec = (nowEpoch >= currentCycle.startTimeEpoch) ?
                                  (nowEpoch - currentCycle.startTimeEpoch) :
                                  currentCycle.totalDurationSec;
  currentCycle.isCompleted = true;

  lastCompletedCycle = currentCycle;
  uploadPending = true;

  Serial.printf("CycleManager: Completed Cycle #%d! Total: %lu s (Move: %lu s, Hold: %lu s, Exc: %lu s, Dump: %lu s)\n",
                currentCycle.cycleNumber,
                (unsigned long)currentCycle.totalDurationSec,
                (unsigned long)currentCycle.movementSec,
                (unsigned long)currentCycle.holdingSec,
                (unsigned long)currentCycle.excavatorHoldingSec,
                (unsigned long)currentCycle.dumpingHoldingSec);
}
