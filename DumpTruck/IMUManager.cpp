#include "IMUManager.h"

IMUManager imuManager;

IMUManager::IMUManager()
  : devAddr(MPU6500_ADDR),
    mpuOK(false),
    ax(0.0), ay(0.0), az(0.0),
    gx(0.0), gy(0.0), gz(0.0)
{
}

void IMUManager::writeRegister(uint8_t reg, uint8_t value)
{
  Wire.beginTransmission(devAddr);
  Wire.write(reg);
  Wire.write(value);
  Wire.endTransmission();
}

uint8_t IMUManager::readRegister(uint8_t reg)
{
  Wire.beginTransmission(devAddr);
  Wire.write(reg);
  Wire.endTransmission(false);
  Wire.requestFrom(devAddr, (uint8_t)1);

  if (Wire.available())
  {
    return Wire.read();
  }
  return 0xFF;
}

void IMUManager::readRegisters(uint8_t reg, uint8_t *buffer, uint8_t length)
{
  Wire.beginTransmission(devAddr);
  Wire.write(reg);
  Wire.endTransmission(false);
  Wire.requestFrom(devAddr, length);

  for (uint8_t i = 0; i < length; i++)
  {
    if (Wire.available())
    {
      buffer[i] = Wire.read();
    }
    else
    {
      buffer[i] = 0;
    }
  }
}

int16_t IMUManager::combineBytes(uint8_t highByte, uint8_t lowByte)
{
  return (int16_t)((highByte << 8) | lowByte);
}

bool IMUManager::begin(uint8_t i2cAddress)
{
  devAddr = i2cAddress;
  Serial.println();
  Serial.println("Initializing MPU6500...");

  uint8_t who = readRegister(MPU_WHO_AM_I);
  Serial.print("WHO_AM_I = 0x");
  Serial.println(who, HEX);

  if (who != 0x70)
  {
    Serial.println("ERROR: MPU6500 not detected!");
    mpuOK = false;
    return false;
  }

  Serial.println("MPU6500 detected.");

  // Wake up MPU
  writeRegister(MPU_PWR_MGMT_1, 0x00);
  delay(100);

  // Accelerometer ±2g
  writeRegister(MPU_ACCEL_CONFIG, 0x00);

  // Gyroscope ±250 deg/s
  writeRegister(MPU_GYRO_CONFIG, 0x00);
  delay(100);

  Serial.println("MPU6500 initialized.");
  mpuOK = true;
  return true;
}

void IMUManager::update()
{
  if (!mpuOK) return;

  uint8_t accelData[6];
  uint8_t gyroData[6];

  // Accelerometer registers
  readRegisters(MPU_ACCEL_XOUT_H, accelData, 6);
  int16_t rawAx = combineBytes(accelData[0], accelData[1]);
  int16_t rawAy = combineBytes(accelData[2], accelData[3]);
  int16_t rawAz = combineBytes(accelData[4], accelData[5]);

  // Gyroscope registers
  readRegisters(MPU_GYRO_XOUT_H, gyroData, 6);
  int16_t rawGx = combineBytes(gyroData[0], gyroData[1]);
  int16_t rawGy = combineBytes(gyroData[2], gyroData[3]);
  int16_t rawGz = combineBytes(gyroData[4], gyroData[5]);

  // Convert raw readings:
  // ±2g = 16384 LSB/g
  ax = rawAx / 16384.0f;
  ay = rawAy / 16384.0f;
  az = rawAz / 16384.0f;

  // ±250 dps = 131 LSB/dps
  gx = rawGx / 131.0f;
  gy = rawGy / 131.0f;
  gz = rawGz / 131.0f;
}
