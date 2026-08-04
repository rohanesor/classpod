$adb = "C:\Users\kille\AppData\Local\Android\Sdk\platform-tools\adb.exe"

Write-Host "=== ClassPod Mobile Testing Launch Pad ===" -ForegroundColor Yellow
Write-Host ""

Write-Host "[1/4] Checking connected USB devices..." -ForegroundColor Cyan
$devices = & $adb devices
Write-Host $devices

if ($devices -match "unauthorized") {
    Write-Warning "Device is connected but unauthorized. Please unlock your phone and tap 'Allow USB debugging'."
} elseif ($devices.Length -le 30) {
    Write-Warning "No devices detected. Please connect your Android phone via USB and enable USB debugging."
}

Write-Host "[2/4] Initializing ADB Reverse Bridges..." -ForegroundColor Cyan
& $adb reverse tcp:3000 tcp:3000
& $adb reverse tcp:4000 tcp:4000
Write-Host "Reverse bridge active: localhost:3000 -> PC Next.js, localhost:4000 -> PC NestJS" -ForegroundColor Green

Write-Host "[3/4] Synchronizing Capacitor assets..." -ForegroundColor Cyan
cd d:\ai\projects\classpod\apps\web
npx cap sync android

Write-Host "[4/4] Starting Native Android App Wrapper..." -ForegroundColor Cyan
npx cap run android --target=MJPVXCSG9HYL65YL
