import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFunctions } from "firebase/functions";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

// Initialize App Check only in production
if (import.meta.env.PROD) {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(import.meta.env.VITE_RECAPTCHA_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  });
}

// Initialize Services
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();


googleProvider.addScope("https://www.googleapis.com/auth/drive.file");
googleProvider.setCustomParameters({
  prompt: "select_account consent",
});

export const functions = getFunctions(app);

if (!import.meta.env.PROD) {
  const { connectFunctionsEmulator } = await import("firebase/functions");

  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}
export default app;
