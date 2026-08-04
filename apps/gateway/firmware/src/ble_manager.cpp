#include "ble_manager.h"
#include "config.h"

#define SERVICE_UUID        "434c4153-5350-4f44-0000-000000000000"
#define CHARACTERISTIC_UUID "434c4153-5350-4f44-0000-000000000001"

BleManager::BleManager() :
    m_initialized(false),
    m_isAdvertising(false),
    m_pServer(nullptr),
    m_pService(nullptr),
    m_pCharacteristic(nullptr),
    m_pAdvertising(nullptr)
{}

BleManager::~BleManager() {}

BleManager& BleManager::getInstance() {
    static BleManager instance;
    return instance;
}

void BleManager::begin() {
    if (m_initialized) return;
    
    Serial.println("[BLE] Initializing BLE Device...");
    BLEDevice::init("ClassPod Gateway");

    m_pServer = BLEDevice::createServer();
    m_pService = m_pServer->createService(SERVICE_UUID);

    m_pCharacteristic = m_pService->createCharacteristic(
        CHARACTERISTIC_UUID,
        BLECharacteristic::PROPERTY_READ
    );

    // Initial dummy data
    m_pCharacteristic->setValue("{\"status\":\"idle\"}");
    
    m_pService->start();

    m_pAdvertising = BLEDevice::getAdvertising();
    m_pAdvertising->addServiceUUID(SERVICE_UUID);
    m_pAdvertising->setScanResponse(true);
    m_pAdvertising->setMinPreferred(0x06);  // helper for iOS connections
    m_pAdvertising->setMinPreferred(0x12);

    m_initialized = true;
    Serial.println("[BLE] BLE Device initialized successfully.");
}

void BleManager::startAdvertising(const String& gatewayId, const String& sessionId, const String& challengeToken) {
    if (!m_initialized) begin();

    // If already advertising with same details, do nothing
    if (m_isAdvertising && m_currentSessionId == sessionId && m_currentChallengeToken == challengeToken) {
        return;
    }

    m_currentSessionId = sessionId;
    m_currentChallengeToken = challengeToken;

    // Stop if already advertising to update values
    if (m_isAdvertising) {
        stopAdvertising();
    }

    // Build verification payload JSON
    // e.g. {"g":"esp32-cam-node-1","s":"cmsd...","c":"A1B2C3D4","v":"1.0.0"}
    String json;
    json.reserve(128);
    json = "{\"g\":\"";
    json += gatewayId;
    json += "\",\"s\":\"";
    json += sessionId;
    json += "\",\"c\":\"";
    json += challengeToken;
    json += "\",\"v\":\"";
    json += FIRMWARE_VERSION;
    json += "\"}";

    m_pCharacteristic->setValue(json.c_str());

    Serial.printf("[BLE] Starting advertising. Payload: %s\n", json.c_str());
    m_pAdvertising->start();
    m_isAdvertising = true;
}

void BleManager::stopAdvertising() {
    if (!m_initialized || !m_isAdvertising) return;

    Serial.println("[BLE] Stopping BLE advertising.");
    m_pAdvertising->stop();
    m_isAdvertising = false;
    m_currentSessionId = "";
    m_currentChallengeToken = "";
}
