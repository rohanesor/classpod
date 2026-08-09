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
        config.frame_size = FRAMESIZE_VGA;  // 640x480 for sharp human feature detection
        config.jpeg_quality = 10;           // High quality JPEG (0-63, lower is better)
        config.fb_count = 2;
        config.grab_mode = CAMERA_GRAB_LATEST;
    } else {
        config.frame_size = FRAMESIZE_QVGA; // 320x240 fallback
        config.jpeg_quality = 12;
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

        // Low-light and indoor classroom image optimization
        s->set_brightness(s, 1);                  // Brightness (+1) for indoor ambient light
        s->set_contrast(s, 1);                    // Contrast (+1) for sharp subject edge definition
        s->set_saturation(s, 0);                  // Natural color saturation
        s->set_gainceiling(s, GAINCEILING_8X);    // 8x sensor gain ceiling for dark/backlit rooms
        s->set_colorbar(s, 0);                    // Disable test color bar
        s->set_whitebal(s, 1);                    // Enable Auto White Balance (AWB)
        s->set_gain_ctrl(s, 1);                   // Enable Auto Gain Control (AGC)
        s->set_exposure_ctrl(s, 1);               // Enable Auto Exposure Control (AEC)
        s->set_aec2(s, 1);                        // Enable Night DSP Auto Exposure algorithm
        s->set_ae_level(s, 1);                    // Auto-exposure target level (+1)
        s->set_bpc(s, 1);                         // Black Pixel Correction
        s->set_wpc(s, 1);                         // White Pixel Correction
        s->set_lenc(s, 1);                        // Lens Correction (corrects corner vignetting)
        s->set_raw_gma(s, 1);                     // Raw Gamma correction
    }

    Serial.println("[CameraManager] OV2640 Camera initialized with VGA & Low-Light DSP Tuning!");
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
