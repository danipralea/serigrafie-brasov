import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { getStorage, connectStorageEmulator } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBo3Jaw3VDogwmuZq8A2vbgnQ702C5xaT8",
  authDomain: "serigrafie-brasov.firebaseapp.com",
  projectId: "serigrafie-brasov",
  storageBucket: "serigrafie-brasov.firebasestorage.app",
  messagingSenderId: "552500656443",
  appId: "1:552500656443:web:5fafe981199a2937451f1e",
  measurementId: "G-04G7RN8KE8"
};

const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
export const storage = getStorage(app);

// Connect to emulators only when explicitly enabled via environment variable
// This allows:
// - Dev mode to use production Firebase by default
// - E2E tests to use emulators (set VITE_USE_EMULATORS=true in test environment)
if (import.meta.env.VITE_USE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectFunctionsEmulator(functions, 'localhost', 5001);
  connectStorageEmulator(storage, 'localhost', 9199);
}

export const analytics = getAnalytics(app);

export default app;
