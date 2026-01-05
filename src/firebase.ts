import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFunctions } from "firebase/functions";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

// Initialize Services
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();


googleProvider.addScope("https://www.googleapis.com/auth/drive.file");
googleProvider.setCustomParameters({
  prompt: "select_account consent",
});

export const functions = getFunctions(app);

import { Capacitor } from "@capacitor/core";
import { FirebaseAppCheck } from "@capacitor-firebase/app-check";

if (Capacitor.isNativePlatform()) {
  FirebaseAppCheck.initialize({
    debugToken: import.meta.env.VITE_ANDROID_APP_CHECK_DEBUG_TOKEN,
    isTokenAutoRefreshEnabled: true,
  });
} else {
  if (!import.meta.env.PROD) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = import.meta.env.VITE_WEB_APP_CHECK_DEBUG_TOKEN;
  }

  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(import.meta.env.VITE_RECAPTCHA_ID),
    isTokenAutoRefreshEnabled: true,
  });
}

if (!import.meta.env.PROD) {
  const { connectFunctionsEmulator } = await import("firebase/functions");

  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}
export default app;
