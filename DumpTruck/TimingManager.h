#pragma once

#include <Arduino.h>
#include "Config.h"

struct DailyStats
{
  String date;
  uint32_t totalCycles;
  uint32_t totalMovementSec;
  uint32_t totalHoldingSec;
  uint32_t totalExcavatorHoldingSec;
  uint32_t totalDumpingHoldingSec;
  uint32_t totalParkingSec;
  uint32_t totalOperatingSec;
  uint32_t totalDriverAssignedSec;
  uint32_t unauthorizedMovementSec;
};

class TimingManager
{
public:
  TimingManager();

  void begin();
  void update(VehicleState currentState, bool isMoving, const String &currentZoneType, const String &driverId);

  // State Timing
  void onStateChanged(VehicleState newState);
  uint32_t getStateStartEpoch() const { return stateStartEpoch; }
  uint32_t getCurrentStateDurationSec() const;

  // Running Active Durations
  uint32_t getCurrentMovementDurationSec() const;
  uint32_t getCurrentHoldingDurationSec() const;

  // Driver Session Timing
  void onDriverAssigned(const String &driverId);
  void onDriverCleared();
  uint32_t getDriverAssignedEpoch() const { return driverAssignedEpoch; }
  uint32_t getDriverSessionDurationSec() const;

  // Cumulative Totals
  uint32_t getTotalMovementSec() const { return totalMovementSec; }
  uint32_t getTotalHoldingSec() const { return totalHoldingSec; }
  uint32_t getTotalExcavatorHoldingSec() const { return totalExcavatorHoldingSec; }
  uint32_t getTotalDumpingHoldingSec() const { return totalDumpingHoldingSec; }
  uint32_t getTotalParkingSec() const { return totalParkingSec; }
  uint32_t getTotalOperatingSec() const { return totalOperatingSec; }
  uint32_t getTotalDriverAssignedSec() const { return totalDriverAssignedSec; }
  uint32_t getUnauthorizedMovementSec() const { return unauthorizedMovementSec; }

  // Power-on Recovery Timing Contribution
  void addRecoveredHolding(uint32_t durationSec, VehicleState lastState);
  void addRecoveredMovement(uint32_t durationSec, bool hadDriver);

  // Daily statistics
  const DailyStats& getDailyStats() const { return dailyStats; }
  void incrementDailyCycleCount() { dailyStats.totalCycles++; }
  void resetShift();

private:
  uint32_t stateStartEpoch;
  VehicleState activeState;

  uint32_t movementStartEpoch;
  uint32_t holdingStartEpoch;

  uint32_t driverAssignedEpoch;
  bool isDriverActive;

  // Cumulative seconds
  uint32_t totalMovementSec;
  uint32_t totalHoldingSec;
  uint32_t totalExcavatorHoldingSec;
  uint32_t totalDumpingHoldingSec;
  uint32_t totalParkingSec;
  uint32_t totalOperatingSec;
  uint32_t totalDriverAssignedSec;
  uint32_t unauthorizedMovementSec;

  uint32_t lastTickEpoch;
  DailyStats dailyStats;
};

extern TimingManager timingManager;
