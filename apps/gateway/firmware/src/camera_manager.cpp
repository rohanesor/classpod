#include "camera_manager.h"

CameraManager::CameraManager() : m_initialized(false) {}

bool CameraManager::begin() {
    camera_config_t config;
    config.ledc_channel = LEDC_CHANNEL_0;
    config.ledc_timer = LEDC_TIMER_0;
    config.pin_d0 = Y2_GPIO_NUM;
    config.pin_d1 = Y3_GPIO_NUM;
    config.pin_d2 = Y4_GPIO_NUM;
    config.pin_d3 = Y5_GPIO_NUM;
    config.pin_d4 = Y6_GPIO_NUM;
    config.pin_d5 = Y7_GPIO_NUM;
    config.pin_d6 = Y8_GPIO_NUM;
    config.pin_d7 = Y9_GPIO_NUM;
    config.pin_xclk = XCLK_GPIO_NUM;
    config.pin_pclk = PCLK_GPIO_NUM;
    config.pin_vsync = VSYNC_GPIO_NUM;
    config.pin_href = HREF_GPIO_NUM;
    config.pin_sccb_sda = SIOD_GPIO_NUM;
    config.pin_sccb_scl = SIOC_GPIO_NUM;
    config.pin_pwdn = PWDN_GPIO_NUM;
    config.pin_reset = RESET_GPIO_NUM;
    config.xclk_freq_hz = 20000000;
    config.pixel_format = PIXFORMAT_JPEG;

    // Use PSRAM if available
    if (psramFound()) {
        config.frame_size = FRAMESIZE_QVGA; // 320x240
        config.jpeg_quality = 12;
        config.fb_count = 2;
        config.grab_mode = CAMERA_GRAB_LATEST;
    } else {
        config.frame_size = FRAMESIZE_QQVGA; // 160x120
        config.jpeg_quality = 15;
        config.fb_count = 1;
        config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
    }

    esp_err_t err = esp_camera_init(&config);
    if (err != ESP_OK) {
        Serial.printf("[CameraManager] Camera init failed with error 0x%x\n", err);
        m_initialized = false;
        return false;
    }

    sensor_t* s = esp_camera_sensor_get();
    if (s != nullptr) {
        // AI Thinker camera sensor orientation defaults
        s->set_vflip(s, 1);
        s->set_hmirror(s, 0);
    }

    Serial.println("[CameraManager] Camera initialized successfully!");
    m_initialized = true;
    return true;
}

camera_fb_t* CameraManager::capture() {
    if (!m_initialized) {
        Serial.println("[CameraManager] Cannot capture: Camera not initialized.");
        return nullptr;
    }
    return esp_camera_fb_get();
}

void CameraManager::release(camera_fb_t* fb) {
    if (fb != nullptr) {
        esp_camera_fb_return(fb);
    }
}

bool CameraManager::isInitialized() const {
    return m_initialized;
}
