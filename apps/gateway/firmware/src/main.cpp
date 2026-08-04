#include <Arduino.h>
#include "config.h"
#include "wifi_manager.h"
#include "gateway_client.h"
#include "camera_manager.h"
#include "led_status.h"
#include "ble_manager.h"

// Global Manager Instances
WifiManager    g_wifiManager;
GatewayClient  g_gatewayClient;
CameraManager  g_cameraManager;
LedStatus      g_ledStatus;

// Millis Timing Trackers
unsigned long g_lastHeartbeatTime = 0;
unsigned long g_lastObservationTime = 0;

void executeCaptureAndUpload() {
    Serial.println("[CAPTURE] Executing image capture request...");
    g_ledStatus.triggerFlash(100);

    if (!g_cameraManager.isInitialized()) {
        Serial.println("[CAMERA] Error: Camera not initialized!");
        return;
    }

    camera_fb_t* fb = g_cameraManager.capture();
    if (fb != nullptr) {
        Serial.printf("[CAMERA] Frame captured successfully! Size: %u bytes (%dx%d)\n", fb->len, fb->width, fb->height);
        
        bool uploadSuccess = g_gatewayClient.sendImageObservation("PERSON_COUNT", fb, nullptr, GATEWAY_ID);
        if (uploadSuccess) {
            Serial.println("[UPLOAD] Image observation uploaded successfully!");
        } else {
            Serial.println("[UPLOAD] Failed to upload image observation!");
        }

        g_cameraManager.release(fb);
    } else {
        Serial.println("[CAMERA] Error: Camera capture returned null frame!");
    }
}

#include <esp_task_wdt.h>

void setup() {
    Serial.begin(115200);
    delay(500);
    Serial.println("\n==============================================");
    Serial.println("   ClassPod Gateway ESP32-CAM Firmware v" FIRMWARE_VERSION);
    Serial.println("==============================================");

    // Initialize 15-second Task Watchdog Timer (WDT)
    esp_task_wdt_init(15, true);
    esp_task_wdt_add(NULL);

    // 1. Initialize LED Status Feedback
    g_ledStatus.begin();
    g_ledStatus.setMode(LedMode::BOOTING);

    // 2. Initialize Camera
    Serial.println("[CAMERA] Initializing OV2640 Camera...");
    if (!g_cameraManager.begin()) {
        Serial.println("[CAMERA] WARNING: Camera initialization failed!");
    } else {
        Serial.println("[CAMERA] OV2640 Camera initialized successfully!");
    }

    // 3. Initialize Gateway API Client
    g_gatewayClient.begin(API_HOST, API_PORT, GATEWAY_SECRET);

    // 4. Initialize WiFi Connection
    g_ledStatus.setMode(LedMode::CONNECTING_WIFI);
    g_wifiManager.begin(WIFI_SSID, WIFI_PASSWORD);

    // 5. Initialize BLE Manager
    BleManager::getInstance().begin();
}

void loop() {
    // Feed Task Watchdog Timer
    esp_task_wdt_reset();

    // 1. Non-blocking WiFi & LED updates
    g_wifiManager.loop();
    g_ledStatus.loop();

    // 2. If disconnected, adjust LED and return early
    if (!g_wifiManager.isConnected()) {
        g_ledStatus.setMode(LedMode::CONNECTING_WIFI);
        return;
    }

    // Connected to WiFi
    g_ledStatus.setMode(LedMode::ONLINE);
    unsigned long now = millis();

    // 3. Periodic Heartbeat Loop (every 30 seconds)
    if (now - g_lastHeartbeatTime >= HEARTBEAT_INTERVAL_MS || g_lastHeartbeatTime == 0) {
        g_lastHeartbeatTime = now;
        Serial.println("[HEARTBEAT] Sending Heartbeat to ClassPod API...");
        
        bool captureRequested = false;
        String activeSessionId = "";
        String challengeToken = "";
        bool ok = g_gatewayClient.sendHeartbeat(captureRequested, activeSessionId, challengeToken, GATEWAY_ID, FIRMWARE_VERSION);

        if (ok) {
            if (activeSessionId.length() > 0) {
                Serial.printf("[HEARTBEAT] Active session: %s. BLE Challenge: %s\n", activeSessionId.c_str(), challengeToken.c_str());
                BleManager::getInstance().startAdvertising(GATEWAY_ID, activeSessionId, challengeToken);
            } else {
                Serial.println("[HEARTBEAT] No active attendance session. Stop BLE.");
                BleManager::getInstance().stopAdvertising();
            }

            if (captureRequested) {
                executeCaptureAndUpload();
            }
        }
    }

    // 4. Periodic Observation Loop (every 60 seconds)
    if (now - g_lastObservationTime >= OBSERVATION_INTERVAL_MS) {
        g_lastObservationTime = now;
        Serial.println("[OBSERVATION] Running scheduled observation check...");

        if (g_cameraManager.isInitialized()) {
            camera_fb_t* fb = g_cameraManager.capture();
            if (fb != nullptr) {
                Serial.printf("[OBSERVATION] Captured frame size: %u bytes\n", fb->len);
                g_gatewayClient.sendImageObservation("PERSON_COUNT", fb, nullptr, GATEWAY_ID);
                g_cameraManager.release(fb);
            }
        }
    }
}
