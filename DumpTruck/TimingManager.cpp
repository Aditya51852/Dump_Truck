#include "TimingManager.h"
#include "TimeManager.h"

TimingManager timingManager;

TimingManager::TimingManager()
  : stateStartEpoch(0),
    activeState(PARKED),
    movementStartEpoch(0),
    holdingStartEpoch(0),
    driverAssignedEpoch(0),
    isDriverActive(false),
    totalMovementSec(0),
    totalHoldingSec(0),
    totalExcavatorHoldingSec(0),
    totalDumpingHoldingSec(0),
    totalParkingSec(0),
    totalOperatingSec(0),
    totalDriverAssignedSec(0),
    unauthorizedMovementSec(0),
    lastTickEpoch(0)
{
}

void TimingManager::begin()
{
  uint32_t nowEpoch = timeManager.getEpoch();
  stateStartEpoch = nowEpoch;
  holdingStartEpoch = nowEpoch;
  lastTickEpoch = nowEpoch;

  dailyStats.date = timeManager.getDateString();
  dailyStats.totalCycles = 0;
  dailyStats.totalMovementSec = 0;
  dailyStats.totalHoldingSec = 0;
  dailyStats.totalExcavatorHoldingSec = 0;
  dailyStats.totalDumpingHoldingSec = 0;
  dailyStats.totalParkingSec = 0;
  dailyStats.totalOperatingSec = 0;
  dailyStats.totalDriverAssignedSec = 0;
  dailyStats.unauthorizedMovementSec = 0;

  Serial.println("TimingManager initialized.");
}

void TimingManager::onStateChanged(VehicleState newState)
{
  activeState = newState;
  stateStartEpoch = timeManager.getEpoch();
}

uint32_t TimingManager::getCurrentStateDurationSec() const
{
  uint32_t nowEpoch = timeManager.getEpoch();
  if (stateStartEpoch > 0 && nowEpoch >= stateStartEpoch)
  {
    return nowEpoch - stateStartEpoch;
  }
  return 0;
}

uint32_t TimingManager::getCurrentMovementDurationSec() const
{
  uint32_t nowEpoch = timeManager.getEpoch();
  if (movementStartEpoch > 0 && nowEpoch >= movementStartEpoch)
  {
    return nowEpoch - movementStartEpoch;
  }
  return 0;
}

uint32_t TimingManager::getCurrentHoldingDurationSec() const
{
  uint32_t nowEpoch = timeManager.getEpoch();
  if (holdingStartEpoch > 0 && nowEpoch >= holdingStartEpoch)
  {
    return nowEpoch - holdingStartEpoch;
  }
  return 0;
}

void TimingManager::onDriverAssigned(const String &driverId)
{
  driverAssignedEpoch = timeManager.getEpoch();
  isDriverActive = true;
  Serial.printf("TimingManager: Driver %s session started at epoch %lu\n",
                driverId.c_str(), (unsigned long)driverAssignedEpoch);
}

void TimingManager::onDriverCleared()
{
  isDriverActive = false;
  driverAssignedEpoch = 0;
}

uint32_t TimingManager::getDriverSessionDurationSec() const
{
  uint32_t nowEpoch = timeManager.getEpoch();
  if (isDriverActive && driverAssignedEpoch > 0 && nowEpoch >= driverAssignedEpoch)
  {
    return nowEpoch - driverAssignedEpoch;
  }
  return 0;
}

void TimingManager::addRecoveredHolding(uint32_t durationSec, VehicleState lastState)
{
  totalHoldingSec += durationSec;
  totalOperatingSec += durationSec;

  if (lastState == AT_EXCAVATOR || lastState == LOADING)
  {
    totalExcavatorHoldingSec += durationSec;
  }
  else if (lastState == AT_DUMPING)
  {
    totalDumpingHoldingSec += durationSec;
  }
  else if (lastState == PARKED)
  {
    totalParkingSec += durationSec;
  }

  dailyStats.totalHoldingSec = totalHoldingSec;
  dailyStats.totalOperatingSec = totalOperatingSec;
  dailyStats.totalExcavatorHoldingSec = totalExcavatorHoldingSec;
  dailyStats.totalDumpingHoldingSec = totalDumpingHoldingSec;
  dailyStats.totalParkingSec = totalParkingSec;

  Serial.printf("TimingManager: Recovered %lu sec offline holding (Last State: %d)\n",
                (unsigned long)durationSec, (int)lastState);
}

void TimingManager::addRecoveredMovement(uint32_t durationSec, bool hadDriver)
{
  totalMovementSec += durationSec;
  totalOperatingSec += durationSec;

  if (!hadDriver)
  {
    unauthorizedMovementSec += durationSec;
  }

  dailyStats.totalMovementSec = totalMovementSec;
  dailyStats.totalOperatingSec = totalOperatingSec;
  dailyStats.unauthorizedMovementSec = unauthorizedMovementSec;

  Serial.printf("TimingManager: Recovered %lu sec offline movement (Had Driver: %s)\n",
                (unsigned long)durationSec, hadDriver ? "YES" : "NO");
}

void TimingManager::update(VehicleState currentState, bool isMoving, const String &currentZoneType, const String &driverId)
{
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

  // Operating time accumulator
  totalOperatingSec += delta;

  // Driver assigned time accumulator
  if (driverId.length() > 0)
  {
    totalDriverAssignedSec += delta;
  }

  // Movement vs Holding accumulation
  if (isMoving)
  {
    totalMovementSec += delta;
    holdingStartEpoch = 0;

    if (movementStartEpoch == 0)
    {
      movementStartEpoch = nowEpoch;
    }

    // Check movement without driver
    if (driverId.length() == 0)
    {
      unauthorizedMovementSec += delta;
    }
  }
  else
  {
    totalHoldingSec += delta;
    movementStartEpoch = 0;

    if (holdingStartEpoch == 0)
    {
      holdingStartEpoch = nowEpoch;
    }

    // Categorized zone holding
    if (currentZoneType == "EXCAVATOR" || currentState == AT_EXCAVATOR || currentState == LOADING)
    {
      totalExcavatorHoldingSec += delta;
    }
    else if (currentZoneType == "DUMPING" || currentState == AT_DUMPING)
    {
      totalDumpingHoldingSec += delta;
    }
    else if (currentZoneType == "PARKING" || currentState == PARKED)
    {
      totalParkingSec += delta;
    }
  }

  // Keep daily stats synced
  dailyStats.date = timeManager.getDateString();
  dailyStats.totalMovementSec = totalMovementSec;
  dailyStats.totalHoldingSec = totalHoldingSec;
  dailyStats.totalExcavatorHoldingSec = totalExcavatorHoldingSec;
  dailyStats.totalDumpingHoldingSec = totalDumpingHoldingSec;
  dailyStats.totalParkingSec = totalParkingSec;
  dailyStats.totalOperatingSec = totalOperatingSec;
  dailyStats.totalDriverAssignedSec = totalDriverAssignedSec;
  dailyStats.unauthorizedMovementSec = unauthorizedMovementSec;
}

void TimingManager::resetShift()
{
  totalMovementSec = 0;
  totalHoldingSec = 0;
  totalExcavatorHoldingSec = 0;
  totalDumpingHoldingSec = 0;
  totalParkingSec = 0;
  totalOperatingSec = 0;
  totalDriverAssignedSec = 0;
  unauthorizedMovementSec = 0;
  movementStartEpoch = 0;
  holdingStartEpoch = timeManager.getEpoch();
  stateStartEpoch = holdingStartEpoch;
  driverAssignedEpoch = 0;
  isDriverActive = false;

  dailyStats.totalMovementSec = 0;
  dailyStats.totalHoldingSec = 0;
  dailyStats.totalExcavatorHoldingSec = 0;
  dailyStats.totalDumpingHoldingSec = 0;
  dailyStats.totalParkingSec = 0;
  dailyStats.totalOperatingSec = 0;
  dailyStats.totalDriverAssignedSec = 0;
  dailyStats.unauthorizedMovementSec = 0;

  Serial.println("TimingManager: Shift timings reset.");
}
