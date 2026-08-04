#include "wifi_manager.h"

WifiManager::WifiManager()
    : m_ssid(nullptr), m_password(nullptr), m_lastReconnectAttempt(0), m_wasConnected(false) {}

void WifiManager::begin(const char* ssid, const char* password) {
    m_ssid = ssid;
    m_password = password;
    WiFi.persistent(false);
    WiFi.mode(WIFI_STA);
    WiFi.setAutoReconnect(true);
    WiFi.begin(m_ssid, m_password);
    Serial.printf("[WiFi] Connecting to %s...\n", m_ssid);
}

void WifiManager::loop() {
    bool connected = isConnected();

    if (connected && !m_wasConnected) {
        Serial.printf("[WiFi] Connected! IP Address: %s\n", getIpAddress().c_str());
        m_wasConnected = true;
    } else if (!connected && m_wasConnected) {
        Serial.println("[WiFi] Lost connection. Retrying...");
        m_wasConnected = false;
    }

    if (!connected) {
        unsigned long now = millis();
        if (now - m_lastReconnectAttempt >= WIFI_RECONNECT_INTERVAL_MS) {
            m_lastReconnectAttempt = now;
            Serial.println("[WiFi] Re-attempting WiFi connection...");
            WiFi.disconnect();
            WiFi.begin(m_ssid, m_password);
        }
    }
}

bool WifiManager::isConnected() const {
    return WiFi.status() == WL_CONNECTED;
}

String WifiManager::getIpAddress() const {
    return WiFi.localIP().toString();
}
