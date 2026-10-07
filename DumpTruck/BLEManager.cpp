#include "BLEManager.h"

// Application Bluetooth Service UUID
#define APP_SERVICE_UUID "12345678-1234-5678-1234-56789abcdef0"

void BLEManager::begin()
{
    BLEDevice::init("");

    scanner = BLEDevice::getScan();
    scanner->setActiveScan(true);
    scanner->setInterval(100);
    scanner->setWindow(80);

    detectedUUID = "";
    beaconZone = "";

    Serial.println("BLE Scanner Initialized");
}

void BLEManager::update()
{
    detectedUUID = "";
    beaconZone = "";

    BLEScanResults* results = scanner->start(1, false);

    for (int i = 0; i < results->getCount(); i++)
    {
        BLEAdvertisedDevice device = results->getDevice(i);

        bool isTargetDevice = false;

        // 1. Check whether advertisement contains our Service UUID
        if (device.haveServiceUUID())
        {
            String uuid = device.getServiceUUID().toString().c_str();
            uuid.toLowerCase();
            if (uuid == APP_SERVICE_UUID)
            {
                detectedUUID = uuid;
                isTargetDevice = true;
            }
        }

        // 2. Also check manufacturer data for Company ID 0xFFFF or protocol signatures
        String rawMf = "";
        if (device.haveManufacturerData())
        {
            rawMf = device.getManufacturerData();
            if (rawMf.length() >= 2)
            {
                uint8_t b0 = (uint8_t)rawMf[0];
                uint8_t b1 = (uint8_t)rawMf[1];
                if ((b0 == 0xFF && b1 == 0xFF) || (b0 == 0x74 && b1 == 0x23))
                {
                    isTargetDevice = true;
                    if (detectedUUID == "")
                    {
                        detectedUUID = APP_SERVICE_UUID;
                    }
                }
            }
        }

        if (isTargetDevice)
        {
            String extracted = "";

            // Strategy A: Protocol specification with 2-byte Company ID
            // [0..1]=Company ID (0xFFFF)
            // [2]=ver(1), [3]=type(1), [4..5]=broadcaster(2), [6..7]=seq(2), [8]=payloadLen(1), [9..9+N-1]=string
            if (rawMf.length() >= 9)
            {
                uint8_t pLen = (uint8_t)rawMf[8];
                if (pLen > 0 && pLen <= 16 && rawMf.length() >= (unsigned int)(9 + pLen))
                {
                    for (uint8_t p = 0; p < pLen; p++)
                    {
                        char c = rawMf[9 + p];
                        if (c >= 0x20 && c <= 0x7E) extracted += c;
                    }
                    extracted.trim();
                }
            }

            // Strategy B: Protocol specification without 2-byte Company ID
            // [0]=ver, [1]=type, [2..3]=broadcaster, [4..5]=seq, [6]=payloadLen, [7..7+N-1]=string
            if (extracted.length() == 0 && rawMf.length() >= 7)
            {
                uint8_t pLen = (uint8_t)rawMf[6];
                if (pLen > 0 && pLen <= 16 && rawMf.length() >= (unsigned int)(7 + pLen))
                {
                    for (uint8_t p = 0; p < pLen; p++)
                    {
                        char c = rawMf[7 + p];
                        if (c >= 0x20 && c <= 0x7E) extracted += c;
                    }
                    extracted.trim();
                }
            }

            // Strategy C: Direct substring search for known beacon prefixes (EXC, DUMP, PARK)
            if (extracted.length() == 0 && rawMf.length() >= 3)
            {
                const char* zonePrefixes[] = {"EXC", "DUMP", "PARK"};
                for (int z = 0; z < 3; z++)
                {
                    int pos = rawMf.indexOf(zonePrefixes[z]);
                    if (pos >= 0)
                    {
                        for (int p = pos; p < (int)rawMf.length(); p++)
                        {
                            char c = rawMf[p];
                            if ((c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '_')
                            {
                                extracted += c;
                            }
                            else
                            {
                                break;
                            }
                        }
                        if (extracted.length() > 0) break;
                    }
                }
            }

            // Strategy D: Check advertised device name
            if (extracted.length() == 0 && device.haveName())
            {
                String devName = device.getName();
                devName.trim();
                if (devName.startsWith("EXC") || devName.startsWith("DUMP") || devName.startsWith("PARK"))
                {
                    extracted = devName;
                }
            }

            // Strategy E: Any printable ASCII alphanumeric sequence of length >= 4
            if (extracted.length() == 0 && rawMf.length() >= 4)
            {
                String candidate = "";
                for (unsigned int j = 0; j < rawMf.length(); j++)
                {
                    char c = rawMf[j];
                    if ((c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9'))
                    {
                        candidate += c;
                    }
                    else if (candidate.length() >= 4)
                    {
                        extracted = candidate;
                        break;
                    }
                    else
                    {
                        candidate = "";
                    }
                }
                if (extracted.length() == 0 && candidate.length() >= 4)
                {
                    extracted = candidate;
                }
            }

            if (extracted.length() > 0)
            {
                beaconZone = extracted;
                Serial.print("BLE Beacon Zone Extracted: ");
                Serial.println(beaconZone);
                Serial.print("Application BLE UUID Detected: ");
                Serial.println(detectedUUID);
                break;
            }
        }
    }

    scanner->clearResults();
}

String BLEManager::getUUID()
{
    return detectedUUID;
}

String BLEManager::getBeaconZone()
{
    return beaconZone;
}
