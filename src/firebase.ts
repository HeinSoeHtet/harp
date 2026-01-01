import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFunctions } from "firebase/functions";
import { getFirestore } from "firebase/firestore";

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
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();


googleProvider.addScope("https://www.googleapis.com/auth/drive.file");
googleProvider.setCustomParameters({
  prompt: "select_account consent",
});

export const functions = getFunctions(app);

const isLocalhost = Boolean(
  window.location.hostname === "localhost" ||
  window.location.hostname === "[::1]" ||
  window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
);

if (isLocalhost) {
  const { connectFirestoreEmulator } = await import("firebase/firestore");
  const { connectFunctionsEmulator } = await import("firebase/functions");

  connectFirestoreEmulator(db, "127.0.0.1", 8085);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}
export default app;
