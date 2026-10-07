#ifndef BLE_MANAGER_H
#define BLE_MANAGER_H

#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEScan.h>

class BLEManager
{
public:
    void begin();
    void update();

    String getUUID();
    String getBeaconZone();

private:
    BLEScan* scanner;
    String detectedUUID;
    String beaconZone;
};

#endif