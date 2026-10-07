#include "MovementManager.h"
#include "GPSManager.h"
#include "TimeManager.h"
#include "Config.h"
#include <math.h>

MovementManager movementManager;

MovementManager::MovementManager()
  : speedThresholdKmph(MOVEMENT_SPEED_KMPH),
    distanceThresholdMeters(20.0f),
    minimumSatellites(4),
    currentMotion(MOTION_STOPPED),
    previousMotion(MOTION_STOPPED),
    lastValidLat(0.0),
    lastValidLng(0.0),
    hasInitialFix(false),
    movementStartEpoch(0),
    movementEndEpoch(0),
    currentMovementDurationSec(0),
    totalDistanceMeters(0.0),
    lastStoppedCheckMillis(0),
    unauthorizedMovementTriggered(false)
{
}

void MovementManager::begin()
{
  currentMotion = MOTION_STOPPED;
  previousMotion = MOTION_STOPPED;
  hasInitialFix = false;
  totalDistanceMeters = 0.0;
  movementStartEpoch = 0;
  movementEndEpoch = 0;
  currentMovementDurationSec = 0;
  unauthorizedMovementTriggered = false;
  Serial.println("MovementManager initialized.");
}

double MovementManager::calculateDistanceMeters(double lat1, double lon1, double lat2, double lon2)
{
  if (lat1 == 0.0 || lon1 == 0.0 || lat2 == 0.0 || lon2 == 0.0)
  {
    return 0.0;
  }

  const double R = 6371000.0; // Earth radius in meters
  double lat1Rad = lat1 * DEG_TO_RAD;
  double lon1Rad = lon1 * DEG_TO_RAD;
  double lat2Rad = lat2 * DEG_TO_RAD;
  double lon2Rad = lon2 * DEG_TO_RAD;

  double dLat = lat2Rad - lat1Rad;
  double dLon = lon2Rad - lon1Rad;

  double a = sin(dLat / 2.0) * sin(dLat / 2.0) +
             cos(lat1Rad) * cos(lat2Rad) *
             sin(dLon / 2.0) * sin(dLon / 2.0);
  double c = 2.0 * atan2(sqrt(a), sqrt(1.0 - a));

  return R * c;
}

void MovementManager::update()
{
  uint32_t nowEpoch = timeManager.getEpoch();
  bool locationValid = gpsManager.isLocationValid();
  int sats = gpsManager.getSatellites();
  double curSpeed = gpsManager.getSpeedKmph();

  bool gpsReliable = (locationValid && (sats >= minimumSatellites));

  if (gpsReliable)
  {
    double curLat = gpsManager.getLatitude();
    double curLng = gpsManager.getLongitude();

    if (!hasInitialFix)
    {
      lastValidLat = curLat;
      lastValidLng = curLng;
      hasInitialFix = true;
    }
    else
    {
      double deltaDist = calculateDistanceMeters(lastValidLat, lastValidLng, curLat, curLng);

      // Determine movement by speed and displacement
      bool movingBySpeed = (curSpeed >= speedThresholdKmph);
      bool movingByDistance = (deltaDist >= distanceThresholdMeters);

      if (movingBySpeed || movingByDistance)
      {
        if (currentMotion != MOTION_MOVING)
        {
          previousMotion = currentMotion;
          currentMotion = MOTION_MOVING;
          movementStartEpoch = nowEpoch;
          movementEndEpoch = 0;
          currentMovementDurationSec = 0;
        }
        else
        {
          if (movementStartEpoch > 0 && nowEpoch >= movementStartEpoch)
          {
            currentMovementDurationSec = nowEpoch - movementStartEpoch;
          }
        }

        totalDistanceMeters += deltaDist;
        lastValidLat = curLat;
        lastValidLng = curLng;
      }
      else
      {
        if (currentMotion == MOTION_MOVING)
        {
          // Transition from moving to stopped/holding
          previousMotion = MOTION_MOVING;
          currentMotion = MOTION_STOPPED;
          movementEndEpoch = nowEpoch;
          if (movementStartEpoch > 0 && movementEndEpoch >= movementStartEpoch)
          {
            currentMovementDurationSec = movementEndEpoch - movementStartEpoch;
          }
        }
      }
    }
  }
  else
  {
    // If GPS is not reliable, use speed if reported above threshold
    if (curSpeed >= speedThresholdKmph)
    {
      if (currentMotion != MOTION_MOVING)
      {
        currentMotion = MOTION_MOVING;
        movementStartEpoch = nowEpoch;
      }
    }
    else if (currentMotion == MOTION_MOVING)
    {
      currentMotion = MOTION_STOPPED;
      movementEndEpoch = nowEpoch;
    }
  }
}

bool MovementManager::checkAndClearUnauthorizedMovementFlag()
{
  if (unauthorizedMovementTriggered)
  {
    unauthorizedMovementTriggered = false;
    return true;
  }
  return false;
}
