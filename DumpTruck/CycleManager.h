#pragma once

#include <Arduino.h>

struct CycleData
{
  int cycleNumber;
  String driverId;
  uint32_t startTimeEpoch;
  uint32_t endTimeEpoch;
  uint32_t totalDurationSec;
  uint32_t movementSec;
  uint32_t holdingSec;
  uint32_t excavatorHoldingSec;
  uint32_t dumpingHoldingSec;
  bool isCompleted;
};

class CycleManager
{
public:
  CycleManager();

  void begin();
  void startCycle(int cycleNum, const String &driverId);
  void update(bool isMoving, const String &currentZoneType);
  void completeCycle();

  int getCycleNumber() const { return currentCycle.cycleNumber; }
  void setCycleNumber(int num) { currentCycle.cycleNumber = num; }

  uint32_t getCycleStartTime() const { return currentCycle.startTimeEpoch; }
  uint32_t getCycleDurationSec() const;

  const CycleData& getCurrentCycle() const { return currentCycle; }
  const CycleData& getLastCompletedCycle() const { return lastCompletedCycle; }
  bool hasCompletedCycleToUpload() const { return uploadPending; }
  void clearUploadPending() { uploadPending = false; }

private:
  CycleData currentCycle;
  CycleData lastCompletedCycle;
  uint32_t lastTickEpoch;
  bool uploadPending;
};

extern CycleManager cycleManager;
