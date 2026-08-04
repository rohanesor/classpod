#ifndef CLASSPOD_CAMERA_MANAGER_H
#define CLASSPOD_CAMERA_MANAGER_H

#include <Arduino.h>
#include "esp_camera.h"
#include "config.h"

class CameraManager {
public:
    CameraManager();
    bool begin();
    camera_fb_t* capture();
    void release(camera_fb_t* fb);
    bool isInitialized() const;

private:
    bool m_initialized;
};

#endif // CLASSPOD_CAMERA_MANAGER_H
