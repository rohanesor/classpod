#ifndef CLASSPOD_WIFI_MANAGER_H
#define CLASSPOD_WIFI_MANAGER_H

#include <WiFi.h>
#include "config.h"

class WifiManager {
public:
    WifiManager();
    void begin(const char* ssid = WIFI_SSID, const char* password = WIFI_PASSWORD);
    void loop();
    bool isConnected() const;
    String getIpAddress() const;

private:
    const char* m_ssid;
    const char* m_password;
    unsigned long m_lastReconnectAttempt;
    bool m_wasConnected;
};

#endif // CLASSPOD_WIFI_MANAGER_H
