#pragma once

#include <Arduino.h>
#include <Wire.h>
#include "Config.h"

class IMUManager
{
public:
  IMUManager();

  bool begin(uint8_t i2cAddress = MPU6500_ADDR);
  void update();

  bool isOk() const { return mpuOK; }

  float getAx() const { return ax; }
  float getAy() const { return ay; }
  float getAz() const { return az; }

  float getGx() const { return gx; }
  float getGy() const { return gy; }
  float getGz() const { return gz; }

private:
  uint8_t devAddr;
  bool mpuOK;

  float ax, ay, az;
  float gx, gy, gz;

  void writeRegister(uint8_t reg, uint8_t value);
  uint8_t readRegister(uint8_t reg);
  void readRegisters(uint8_t reg, uint8_t *buffer, uint8_t length);
  int16_t combineBytes(uint8_t highByte, uint8_t lowByte);
};

extern IMUManager imuManager;
