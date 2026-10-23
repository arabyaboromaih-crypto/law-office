import { initializeApp } from "firebase/app";
import { 
  initializeFirestore, 
  getFirestore,
  persistentLocalCache, 
  persistentMultipleTabManager,
  memoryLocalCache,
  setLogLevel,
  enableNetwork,
  disableNetwork
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import firebaseAppletConfig from "../../firebase-applet-config.json";

// Silence internal Firestore retry notices and transient connection logs
try {
  setLogLevel('silent');
} catch {
  // Ignored if environment restricts setLogLevel
}

const metaEnv = (import.meta as any).env || {};

const firebaseConfig = {
  apiKey: metaEnv.VITE_FIREBASE_API_KEY || firebaseAppletConfig.apiKey || "AIzaSyCrGKfypcRBm4eZC_IQSd47ZpX9tqQz8UA",
  authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || firebaseAppletConfig.authDomain || "eminent-xylopolist-6gtt6.firebaseapp.com",
  projectId: metaEnv.VITE_FIREBASE_PROJECT_ID || firebaseAppletConfig.projectId || "eminent-xylopolist-6gtt6",
  storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET || firebaseAppletConfig.storageBucket || "eminent-xylopolist-6gtt6.firebasestorage.app",
  messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseAppletConfig.messagingSenderId || "718469005201",
  appId: metaEnv.VITE_FIREBASE_APP_ID || firebaseAppletConfig.appId || "1:718469005201:web:e008c7145624accae3e430"
};

const app = initializeApp(firebaseConfig);

const databaseId = metaEnv.VITE_FIREBASE_FIRESTORE_DATABASE_ID || firebaseAppletConfig.firestoreDatabaseId || "ai-studio-65bf1e76-0213-4258-96d1-c93333c07130";

let firestoreInstance;

// By enforcing experimentalForceLongPolling: true and useFetchStreams: false,
// Firestore connects directly via robust HTTP long-polling requests without failing or logging
// connection drops in iframe and Cloud Run environments.
const baseFirestoreSettings = {
  ignoreUndefinedProperties: true,
  experimentalForceLongPolling: true,
  useFetchStreams: false
};

try {
  firestoreInstance = initializeFirestore(app, {
    ...baseFirestoreSettings,
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  }, databaseId || undefined);
} catch {
  try {
    firestoreInstance = initializeFirestore(app, {
      ...baseFirestoreSettings,
      localCache: memoryLocalCache()
    }, databaseId || undefined);
  } catch {
    try {
      firestoreInstance = initializeFirestore(app, baseFirestoreSettings, databaseId || undefined);
    } catch {
      firestoreInstance = getFirestore(app, databaseId || undefined);
    }
  }
}

export const db = firestoreInstance;
export const storage = getStorage(app);
storage.maxUploadRetryTime = 6000;      // 6 seconds max upload retry
storage.maxOperationRetryTime = 6000;   // 6 seconds max operation retry

/**
 * Reconnect helper when browser restores connectivity or wakes from sleep
 */
export const reconnectFirestore = async () => {
  try {
    if (db) {
      await enableNetwork(db);
    }
  } catch {
    // Graceful fallback if already active
  }
};

export const pauseFirestore = async () => {
  try {
    if (db) {
      await disableNetwork(db);
    }
  } catch {
    // Graceful fallback
  }
};
