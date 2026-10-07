// src/firebase/config.ts
import { initializeApp, getApps } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAtpstAmJiPxkjQ1RSUslfm6Ws4Tq9QDR8",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "dump-truck-876a6.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://dump-truck-876a6-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "dump-truck-876a6",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "dump-truck-876a6.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "405710473018",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:405710473018:web:f59982d035d52271de7203",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-5VZG68QHFP",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const database = getDatabase(app);

export { app, database };
export default database;
