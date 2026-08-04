# ClassPod Project

ClassPod is an intelligent classroom platform for teachers, students, and classroom gateway hardware.

Core product model:

- Teachers create Pods for subjects or classes.
- Students join Pods.
- Teachers start attendance sessions.
- Students confirm attendance in the mobile or web client.
- Classroom hardware nodes report classroom presence observations.
- The backend owns every business decision.

The gateway must never decide attendance. It only reports observations and diagnostics.

This repository is a production monorepo scaffold. It intentionally contains architecture, boundaries, infrastructure, and developer-experience setup before business features are implemented.
