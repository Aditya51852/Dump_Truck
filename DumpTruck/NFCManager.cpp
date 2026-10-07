#include "NFCManager.h"

NFCManager nfcManager;

NFCManager::NFCManager()
  : nfc(PN532_IRQ, PN532_RESET, &Wire),
    pn532OK(false)
{
}

bool NFCManager::begin(uint8_t irqPin, uint8_t resetPin)
{
  Serial.println();
  Serial.println("Initializing PN532...");

  nfc.begin();

  uint32_t versiondata = nfc.getFirmwareVersion();
  if (!versiondata)
  {
    Serial.println("ERROR: PN532 not detected!");
    pn532OK = false;
    return false;
  }

  pn532OK = true;
  Serial.print("PN532 Firmware: ");
  Serial.print((versiondata >> 24) & 0xFF);
  Serial.print(".");
  Serial.println((versiondata >> 16) & 0xFF);

  nfc.SAMConfig();
  Serial.println("PN532 ready.");
  return true;
}

String NFCManager::uidToString(uint8_t *uid, uint8_t uidLength)
{
  String result = "";
  for (uint8_t i = 0; i < uidLength; i++)
  {
    if (uid[i] < 0x10)
    {
      result += "0";
    }
    result += String(uid[i], HEX);
  }
  result.toUpperCase();
  return result;
}

bool NFCManager::readCardUID(String &uidString)
{
  if (!pn532OK) return false;

  uint8_t uid[7];
  uint8_t uidLength;

  bool success = nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLength, 100);
  if (!success)
  {
    return false;
  }

  uidString = uidToString(uid, uidLength);
  return true;
}
