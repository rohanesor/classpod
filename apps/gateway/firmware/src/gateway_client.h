#ifndef CLASSPOD_GATEWAY_CLIENT_H
#define CLASSPOD_GATEWAY_CLIENT_H

#include <Arduino.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "esp_camera.h"
#include "config.h"

class GatewayClient {
public:
    GatewayClient();
    void begin(const char* host = API_HOST, uint16_t port = API_PORT, const char* secret = GATEWAY_SECRET);
    
    // Heartbeat POST /gateway/heartbeat. Returns true if API call succeeds. Out parameter captureRequested is set to true if backend requested image capture.
    bool sendHeartbeat(
        bool& captureRequestedOut,
        String& activeSessionIdOut,
        String& challengeTokenOut,
        const char* gatewayId = GATEWAY_ID,
        const char* firmwareVersion = FIRMWARE_VERSION
    );

    // Observation POST /gateway/observations
    bool sendObservation(const char* type, JsonObjectConst payload, const char* sessionId = nullptr, const char* gatewayId = GATEWAY_ID);

    // Image Observation POST /gateway/observations with camera frame buffer
    bool sendImageObservation(const char* type, camera_fb_t* fb, const char* sessionId = nullptr, const char* gatewayId = GATEWAY_ID);

private:
    String m_baseUrl;
    String m_secret;
    HTTPClient m_http;

    bool postJson(const String& url, const JsonDocument& doc, String* responseString = nullptr);
};

#endif // CLASSPOD_GATEWAY_CLIENT_H
