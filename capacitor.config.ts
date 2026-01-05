import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.solodev.harp',
  appName: 'Harp',
  webDir: 'dist',
  plugins: {
    GoogleAuth: {
      scopes: ["profile", "email", "https://www.googleapis.com/auth/drive.file"],
      serverClientId: "169295320802-n5k041v3dcl8b2196o2ch1esd5lla1ij.apps.googleusercontent.com",
      forceCodeForRefreshToken: true,
    },
  },
};

export default config;
