#include "led_status.h"

LedStatus::LedStatus() 
    : m_mode(LedMode::OFF), m_lastBlinkTime(0), m_ledState(false), m_flashEndTime(0), m_flashing(false) {}

void LedStatus::begin() {
    pinMode(LED_BUILTIN_PIN, OUTPUT);
    digitalWrite(LED_BUILTIN_PIN, HIGH); // Pin 33 is active LOW (HIGH = OFF)

    pinMode(FLASH_LED_PIN, OUTPUT);
    digitalWrite(FLASH_LED_PIN, LOW); // Flash LED is active HIGH (LOW = OFF)
}

void LedStatus::setMode(LedMode mode) {
    m_mode = mode;
    if (m_mode == LedMode::ONLINE) {
        digitalWrite(LED_BUILTIN_PIN, LOW); // Solid ON
    } else if (m_mode == LedMode::OFF) {
        digitalWrite(LED_BUILTIN_PIN, HIGH); // Solid OFF
    }
}

void LedStatus::triggerFlash(unsigned long durationMs) {
    m_flashing = true;
    m_flashEndTime = millis() + durationMs;
    digitalWrite(FLASH_LED_PIN, HIGH);
}

void LedStatus::loop() {
    unsigned long now = millis();

    // Handle Flash LED timeout
    if (m_flashing && now >= m_flashEndTime) {
        digitalWrite(FLASH_LED_PIN, LOW);
        m_flashing = false;
    }

    // Handle Built-in LED blink animation
    unsigned long interval = 0;
    switch (m_mode) {
        case LedMode::BOOTING:
            interval = 200;
            break;
        case LedMode::CONNECTING_WIFI:
            interval = 500;
            break;
        case LedMode::ERROR_MODE:
            interval = 1000;
            break;
        default:
            return; // Solid state handled in setMode
    }

    if (now - m_lastBlinkTime >= interval) {
        m_lastBlinkTime = now;
        m_ledState = !m_ledState;
        digitalWrite(LED_BUILTIN_PIN, m_ledState ? LOW : HIGH);
    }
}
