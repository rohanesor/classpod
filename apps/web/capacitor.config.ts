import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.classpod.app',
  appName: 'ClassPod',
  webDir: 'out',
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#0f172a',
    preferredContentMode: 'mobile',
    scheme: 'ClassPod',
  },
  android: {
    backgroundColor: '#0f172a',
  },
  plugins: {
    BluetoothLe: {
      displayStrings: {
        scanning: 'Scanning for classroom...',
        cancel: 'Cancel',
        availableDevices: 'Nearby Classrooms',
        noDeviceFound: 'No classroom found',
      },
    },
  },
};

export default config;
