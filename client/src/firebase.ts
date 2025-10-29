import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";

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
export const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
export const storage = getStorage(app);

export default app;
