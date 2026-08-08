import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const metaEnv = (import.meta as any).env || {};

const firebaseConfig = {
  apiKey: metaEnv.VITE_FIREBASE_API_KEY || "AIzaSyCrGKfypcRBm4eZC_IQSd47ZpX9tqQz8UA",
  authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || "eminent-xylopolist-6gtt6.firebaseapp.com",
  projectId: metaEnv.VITE_FIREBASE_PROJECT_ID || "eminent-xylopolist-6gtt6",
  storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET || "eminent-xylopolist-6gtt6.firebasestorage.app",
  messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || "718469005201",
  appId: metaEnv.VITE_FIREBASE_APP_ID || "1:718469005201:web:e008c7145624accae3e430"
};

const app = initializeApp(firebaseConfig);

const databaseId = metaEnv.VITE_FIREBASE_FIRESTORE_DATABASE_ID || "ai-studio-65bf1e76-0213-4258-96d1-c93333c07130";

export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
  experimentalForceLongPolling: true,
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
}, databaseId || undefined);

export const storage = getStorage(app);
storage.maxUploadRetryTime = 6000;      // 6 seconds max upload retry
storage.maxOperationRetryTime = 6000;   // 6 seconds max operation retry


