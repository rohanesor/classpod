#include "gateway_client.h"
#include <mbedtls/base64.h>

GatewayClient::GatewayClient() {}

void GatewayClient::begin(const char* host, uint16_t port, const char* secret) {
    m_baseUrl = "http://" + String(host) + ":" + String(port) + "/api/gateway";
    m_secret = secret;
    Serial.printf("[BOOT] GatewayClient initialized. Target API: %s\n", m_baseUrl.c_str());
}

bool GatewayClient::postJson(const String& url, const JsonDocument& doc, String* responseString) {
    m_http.begin(url);
    m_http.addHeader("Content-Type", "application/json");
    m_http.addHeader("x-gateway-secret", m_secret);

    String requestBody;
    serializeJson(doc, requestBody);

    int httpCode = m_http.POST(requestBody);

    bool success = false;
    if (httpCode > 0) {
        if (httpCode == HTTP_CODE_OK || httpCode == HTTP_CODE_CREATED) {
            Serial.printf("[HTTP] POST %s -> %d OK\n", url.c_str(), httpCode);
            if (responseString != nullptr) {
                *responseString = m_http.getString();
            }
            success = true;
        } else {
            Serial.printf("[HTTP] POST %s -> Error %d: %s\n", url.c_str(), httpCode, m_http.getString().c_str());
        }
    } else {
        Serial.printf("[HTTP] POST %s -> Failed, error: %s\n", url.c_str(), m_http.errorToString(httpCode).c_str());
    }

    m_http.end();
    return success;
}

bool GatewayClient::sendHeartbeat(
    bool& captureRequestedOut,
    String& activeSessionIdOut,
    String& challengeTokenOut,
    const char* gatewayId,
    const char* firmwareVersion
) {
    captureRequestedOut = false;
    activeSessionIdOut = "";
    challengeTokenOut = "";

    JsonDocument doc;
    doc["gatewayId"] = gatewayId;
    if (firmwareVersion != nullptr && strlen(firmwareVersion) > 0) {
        doc["firmwareVersion"] = firmwareVersion;
    }

    String url = m_baseUrl + "/heartbeat";
    String responseString;

    bool success = postJson(url, doc, &responseString);
    if (success && responseString.length() > 0) {
        JsonDocument resDoc;
        DeserializationError err = deserializeJson(resDoc, responseString);
        if (!err) {
            const char* pendingCmd = resDoc["data"]["pendingCommand"] | "";
            if (String(pendingCmd) == "CAPTURE") {
                captureRequestedOut = true;
                Serial.println("[HEARTBEAT] Pending command received: CAPTURE");
            }

            const char* activeSessionId = resDoc["data"]["activeSessionId"] | "";
            const char* challengeToken = resDoc["data"]["challengeToken"] | "";
            activeSessionIdOut = String(activeSessionId);
            challengeTokenOut = String(challengeToken);
        }
    }

    return success;
}

bool GatewayClient::sendObservation(const char* type, JsonObjectConst payload, const char* sessionId, const char* gatewayId) {
    JsonDocument doc;
    doc["gatewayId"] = gatewayId;
    doc["type"] = type;
    doc["payload"] = payload;

    if (sessionId != nullptr && strlen(sessionId) > 0) {
        doc["sessionId"] = sessionId;
    }

    String url = m_baseUrl + "/observations";
    return postJson(url, doc);
}

bool GatewayClient::sendImageObservation(const char* type, camera_fb_t* fb, const char* sessionId, const char* gatewayId) {
    if (!fb || !fb->buf || fb->len == 0) {
        Serial.println("[CAMERA] Error: Frame buffer is empty");
        return false;
    }

    Serial.printf("[UPLOAD] Encoding JPEG frame (%u bytes) to Base64...\n", fb->len);

    size_t out_len = 0;
    mbedtls_base64_encode(NULL, 0, &out_len, fb->buf, fb->len);

    char* encoded = (char*)malloc(out_len + 1);
    if (!encoded) {
        Serial.println("[UPLOAD] Error: Out of memory for Base64 buffer");
        return false;
    }

    mbedtls_base64_encode((unsigned char*)encoded, out_len, &out_len, fb->buf, fb->len);
    encoded[out_len] = '\0';

    Serial.println("[UPLOAD] Base64 encoded successfully. Formatting JSON body...");

    // Construct raw JSON body directly without ArduinoJson string overhead
    String body;
    body.reserve(out_len + 200);
    body = "{\"gatewayId\":\"";
    body += gatewayId;
    body += "\",\"type\":\"";
    body += type;
    body += "\",\"payload\":{\"image\":\"data:image/jpeg;base64,";
    body += encoded;
    body += "\",\"frame_bytes\":";
    body += String(fb->len);
    body += ",\"width\":";
    body += String(fb->width);
    body += ",\"height\":";
    body += String(fb->height);
    body += ",\"format\":\"JPEG\"}}";

    free(encoded);

    String url = m_baseUrl + "/observations";
    Serial.printf("[UPLOAD] Sending real camera photo JSON (%u bytes) to backend...\n", body.length());

    m_http.begin(url);
    m_http.addHeader("Content-Type", "application/json");
    m_http.addHeader("x-gateway-secret", m_secret);

    int httpCode = m_http.POST(body);

    bool success = false;
    if (httpCode > 0 && (httpCode == 200 || httpCode == 201)) {
        Serial.printf("[UPLOAD] Real camera photo uploaded successfully! HTTP %d\n", httpCode);
        success = true;
    } else {
        Serial.printf("[UPLOAD] Camera photo upload failed, HTTP %d: %s\n", httpCode, m_http.getString().c_str());
    }

    m_http.end();
    return success;
}
