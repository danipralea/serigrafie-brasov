import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDH9qOITrOjyXQz4zfZ_2yZAlPH1SfC1xU",
  authDomain: "serigrafie-brasov-69fde.firebaseapp.com",
  projectId: "serigrafie-brasov-69fde",
  storageBucket: "serigrafie-brasov-69fde.firebasestorage.app",
  messagingSenderId: "287605276835",
  appId: "1:287605276835:web:77253f5e1f736ace5c7f16",
  measurementId: "G-G63F5TH2K2K9"
};

const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
export const storage = getStorage(app);

export default app;
