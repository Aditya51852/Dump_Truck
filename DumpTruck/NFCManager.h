#pragma once

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_PN532.h>
#include "Config.h"

class NFCManager
{
public:
  NFCManager();

  bool begin(uint8_t irqPin = PN532_IRQ, uint8_t resetPin = PN532_RESET);
  bool readCardUID(String &uidString);
  bool isOk() const { return pn532OK; }

  static String uidToString(uint8_t *uid, uint8_t uidLength);

private:
  Adafruit_PN532 nfc;
  bool pn532OK;
};

extern NFCManager nfcManager;
