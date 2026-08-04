# ClassPod Gateway

ESP32 classroom node firmware lives in `firmware/`.

The gateway is an observation source only. It may identify itself, report classroom presence signals, and emit diagnostics. It must never decide whether a student is present, absent, late, or valid. Those decisions belong to the backend.
