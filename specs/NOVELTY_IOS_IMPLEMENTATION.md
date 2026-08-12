# ClassPod — Novelty Showcase & iOS Support Architecture

**Version:** v2.1.0  
**Updated:** 2026-08-12  
**Platforms:** Android & iOS (Capacitor v8.5) + Next.js Web + NestJS API + ESP32-CAM IoT Gateway  

---

## 1. Executive Summary & Core Novelty

ClassPod is **NOT** a simple "AI face-recognition camera" or an easily-spoofed QR code scanner.

The core breakthrough of ClassPod is its **Multi-Signal Convergence Anti-Proxy Verification Engine**:
Attendance is granted only when **four independent verification layers converge simultaneously**:

```text
                                  CLASSROOM
                                      │
                   ┌──────────────────┴──────────────────┐
                   │                                     │
              ESP32 / BLE                            Camera / AI
          Proximity Verification                 Person & Headcount
                   │                                     │
                   └──────────────────┬──────────────────┘
                                      │
                               Identity Check
                           (Device-Bound Hardware)
                                      │
                              Session Integrity
                           (Dynamic Token Lock)
                                      │
                         Multi-Signal Decision Engine
                                      │
                      ┌───────────────┴───────────────┐
                      │                               │
                 ✓ VERIFIED                     ⚠ PROXY RISK
             (Attendance Marked)            (Flagged / Rejected)
```

---

## 2. The 4 Verification Layers

### Layer 01: Device-Bound Identity (Hardware/Installation UUID)
- Each student account is cryptographically bound to **1 physical registered mobile device**.
- When a student attempts check-in, the server checks `deviceId`. If the user logs into a friend's phone to check in for them, the backend rejects it with **`DEVICE_MISMATCH`**.

### Layer 02: Physical Classroom Proximity (ESP32 Bluetooth Low Energy)
- The ESP32 classroom beacon broadcasts rotating encrypted challenge packets (`434c4153-5350-4f44-...`).
- The student's mobile app (Android or iOS) scans and captures the BLE beacon payload. A student outside the classroom (e.g. at home or in the cafeteria) cannot receive this broadcast.

### Layer 03: Visual Verification (ESP32-CAM AI Vision)
- An overhead ESP32-CAM gateway node captures the classroom and feeds frames to the AI computer vision service (YOLO/SSD).
- The system continuously calculates **Physical Headcount vs. Registered BLE Check-Ins**. If 40 students are checked in via app but only 25 people are visible in the room, the system flags **`⚠ PROXY RISK DETECTED: Headcount Mismatch`**.

### Layer 04: Session Integrity & Anti-Tamper Locks
- Teachers initiate a session with an ephemeral challenge token.
- Active attendance sessions lock the student's device from switching identities, logging out, or relaying tokens.

---

## 3. iOS Support & Architecture

### Cross-Platform Foundation
ClassPod leverages a single, high-performance web + mobile codebase powered by **Capacitor v8.5**:

```text
                       ClassPod Core Application
                     (Next.js App Router + Tailwind)
                                   │
                 ┌─────────────────┴─────────────────┐
                 │                                   │
           Android Native                        iOS Native
       (Gradle / Java / NDK)               (Xcode / Swift / SPM)
                 │                                   │
      @capacitor-community/               @capacitor-community/
          bluetooth-le                        bluetooth-le
```

### iOS Native Project (`apps/web/ios/`)
1. **Target:** iOS 14.0+ (Universal iPhone & iPad).
2. **Bundle Identifier:** `com.classpod.app`
3. **Bluetooth Background Mode:** `bluetooth-central` enabled in `Info.plist`.
4. **Declared Permissions (`Info.plist`):**
   - `NSBluetoothAlwaysUsageDescription`: "ClassPod uses Bluetooth to verify that you are physically inside the classroom for attendance."
   - `NSBluetoothPeripheralUsageDescription`: "ClassPod uses Bluetooth to verify classroom proximity during attendance sessions."
   - `NSCameraUsageDescription`: "ClassPod uses the camera for visual attendance verification."
   - `NSLocationWhenInUseUsageDescription`: "ClassPod requires location access for Bluetooth classroom proximity detection."

### Native Mobile Assets
- **Custom App Icon:** Branded dark-indigo shield with glowing cyan verification checkmark generated at `1024x1024` for iOS and across `mdpi`, `hdpi`, `xhdpi`, `xxhdpi`, `xxxhdpi` for Android.
- **Custom Splash Screen:** Dark theme (`#0f172a`) with centered ClassPod shield emblem.

---

## 4. Live Hackathon Demonstration Scenarios

### Scenario A — Legitimate Student Check-In
```text
1. Teacher starts session in ClassPod app/web.
2. ESP32 Gateway connects to WiFi and starts BLE broadcast.
3. Student opens ClassPod on iPhone or Android inside the room.
4. Taps "Verify & Confirm Attendance".
5. App verifies:
   ✓ Device Bound UUID
   ✓ In-Range Classroom BLE Beacon
   ✓ AI Camera Headcount Match
   ✓ Session Token Active
6. Status transitions to: "4/4 Signals Verified • Present".
```

### Scenario B — Proxy Attempt (Student at Home / Friend's Account)
```text
1. Absent student gives credentials to friend in classroom.
2. Friend logs in or tries to spoof check-in.
3. System verifies device UUID:
   ✓ User Account: Rohit
   ✕ Device ID: Mismatch (Friend's device is registered to Rahul).
4. Attendance REJECTED with "DEVICE_ALREADY_BOUND".
5. Teacher dashboard displays: "⚠ PROXY RISK DETECTED: Device Collision".
```

### Scenario C — Outside Classroom Range
```text
1. Student is 100 meters away from classroom.
2. Taps "Confirm Attendance".
3. Phone scans for ESP32 BLE Beacon `434c4153-5350-4f44...`.
4. Signal not found.
5. Attendance rejected with: "Physical proximity verification failed. Move closer to the classroom."
```

---

## 5. Summary of Modified Files

- **`apps/web/package.json`**: Added `@capacitor/ios@^8.5.0`.
- **`apps/web/capacitor.config.ts`**: Added iOS & Android theme colors (`#0f172a`), safe-area insets, and BLE display strings.
- **`apps/web/ios/`**: Generated full Xcode project with Swift Package Manager (SPM) dependencies.
- **`apps/web/ios/App/App/Info.plist`**: Configured iOS permissions and background BLE mode.
- **`apps/web/android/app/src/main/res/values/colors.xml`**: Added native brand color palette.
- **`apps/web/android/app/src/main/res/values/styles.xml`**: Configured dark status/navigation bars.
- **`apps/web/src/app/(platform)/dashboard/page.tsx`**: Added real-time 4-Signal Convergence Tracker & "Why ClassPod Prevents Proxy Attendance" showcase card.
