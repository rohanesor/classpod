#ifndef CLASSPOD_BLE_MANAGER_H
#define CLASSPOD_BLE_MANAGER_H

#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

class BleManager {
public:
    static BleManager& getInstance();

    void begin();
    
    // Starts advertising ClassPod BLE service with custom JSON payload characteristic
    void startAdvertising(const String& gatewayId, const String& sessionId, const String& challengeToken);
    
    // Stops BLE advertising
    void stopAdvertising();

    bool isAdvertising() const { return m_isAdvertising; }

private:
    BleManager();
    ~BleManager();

    bool m_initialized;
    bool m_isAdvertising;
    
    BLEServer* m_pServer;
    BLEService* m_pService;
    BLECharacteristic* m_pCharacteristic;
    BLEAdvertising* m_pAdvertising;

    String m_currentSessionId;
    String m_currentChallengeToken;
};

#endif // CLASSPOD_BLE_MANAGER_H
