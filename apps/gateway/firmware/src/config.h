#ifndef CLASSPOD_CONFIG_H
#define CLASSPOD_CONFIG_H

#include <Arduino.h>

// ==========================================
// WiFi Settings (Provide via build flags in platformio.ini or NVS)
// ==========================================
#ifndef WIFI_SSID
#define WIFI_SSID "ClassPod_AP"
#endif

#ifndef WIFI_PASSWORD
#define WIFI_PASSWORD ""
#endif

// ==========================================
// Backend API Configuration
// ==========================================
#ifndef API_HOST
#define API_HOST "api.classpod.io"
#endif

#ifndef API_PORT
#define API_PORT 443
#endif

// Secret matching GATEWAY_SHARED_SECRET in backend .env
#ifndef GATEWAY_SECRET
#define GATEWAY_SECRET ""
#endif

// Unique identifier for this gateway node in the database
#ifndef GATEWAY_ID
#define GATEWAY_ID "esp32-cam-node-1"
#endif

// Firmware metadata
#define FIRMWARE_VERSION "1.0.0"

// ==========================================
// Timing Parameters (millis-based)
// ==========================================
#define HEARTBEAT_INTERVAL_MS       10000UL   // 10 seconds fast poll
#define WIFI_RECONNECT_INTERVAL_MS  15000UL   // 15 seconds retry (allows WPA2/DHCP to complete)
#define OBSERVATION_INTERVAL_MS     60000UL   // 60 seconds observation emission

// ==========================================
// ESP32-CAM Pin Definitions (AI Thinker Model)
// ==========================================
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27

#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

// Onboard Red LED (Pin 33, Active LOW)
#define LED_BUILTIN_PIN   33

// Onboard Flash LED (Pin 4, Active HIGH)
#define FLASH_LED_PIN     4

#endif // CLASSPOD_CONFIG_H
