#ifndef CLASSPOD_LED_STATUS_H
#define CLASSPOD_LED_STATUS_H

#include <Arduino.h>
#include "config.h"

enum class LedMode {
    OFF,
    BOOTING,           // Fast blink (200ms)
    CONNECTING_WIFI,   // Medium blink (500ms)
    ONLINE,            // Solid ON (Pin 33 LOW)
    ERROR_MODE,        // Double blink
    FLASH_BURST        // Flash LED pulse
};

class LedStatus {
public:
    LedStatus();
    void begin();
    void setMode(LedMode mode);
    void triggerFlash(unsigned long durationMs = 100);
    void loop();

private:
    LedMode m_mode;
    unsigned long m_lastBlinkTime;
    bool m_ledState;
    
    // Flash LED control
    unsigned long m_flashEndTime;
    bool m_flashing;
};

#endif // CLASSPOD_LED_STATUS_H
