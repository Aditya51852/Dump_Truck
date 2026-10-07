#pragma once

#include <Arduino.h>

enum MotionState
{
  MOTION_STOPPED,
  MOTION_MOVING,
  MOTION_HOLDING
};

class MovementManager
{
public:
  MovementManager();

  void begin();
  void update();

  // Dynamic threshold configuration (set from Firebase or Config.h defaults)
  void setSpeedThreshold(float kmph) { speedThresholdKmph = kmph; }
  void setDistanceThreshold(float meters) { distanceThresholdMeters = meters; }
  void setMinimumSatellites(int minSats) { minimumSatellites = minSats; }

  float getSpeedThreshold() const { return speedThresholdKmph; }
  float getDistanceThreshold() const { return distanceThresholdMeters; }
  int getMinimumSatellites() const { return minimumSatellites; }

  MotionState getMotionState() const { return currentMotion; }
  bool isMoving() const { return currentMotion == MOTION_MOVING; }
  bool isStopped() const { return currentMotion == MOTION_STOPPED; }
  bool isHolding() const { return currentMotion == MOTION_HOLDING; }

  // Distance calculation utility (Haversine formula in meters)
  static double calculateDistanceMeters(double lat1, double lon1, double lat2, double lon2);

  // Movement metrics
  uint32_t getMovementStartTime() const { return movementStartEpoch; }
  uint32_t getMovementEndTime() const { return movementEndEpoch; }
  uint32_t getMovementDurationSec() const { return currentMovementDurationSec; }
  double getTotalDistanceMeters() const { return totalDistanceMeters; }

  // Detects if unauthorized movement has just triggered
  bool checkAndClearUnauthorizedMovementFlag();

private:
  float speedThresholdKmph;
  float distanceThresholdMeters;
  int minimumSatellites;

  MotionState currentMotion;
  MotionState previousMotion;

  double lastValidLat;
  double lastValidLng;
  bool hasInitialFix;

  uint32_t movementStartEpoch;
  uint32_t movementEndEpoch;
  uint32_t currentMovementDurationSec;
  double totalDistanceMeters;

  unsigned long lastStoppedCheckMillis;
  bool unauthorizedMovementTriggered;
};

extern MovementManager movementManager;
