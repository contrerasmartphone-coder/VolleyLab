import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  Firestore,
} from 'firebase/firestore';
import firebaseConfigJson from '../../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: firebaseConfigJson.apiKey,
  authDomain: firebaseConfigJson.authDomain,
  projectId: firebaseConfigJson.projectId,
  storageBucket: firebaseConfigJson.storageBucket,
  messagingSenderId: firebaseConfigJson.messagingSenderId,
  appId: firebaseConfigJson.appId,
};

// Initialize Firebase
export const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

function createFirestoreInstance(): Firestore {
  const databaseId = firebaseConfigJson.firestoreDatabaseId;
  try {
    const cacheSettings = {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    };
    return databaseId
      ? initializeFirestore(app, cacheSettings, databaseId)
      : initializeFirestore(app, cacheSettings);
  } catch (err) {
    // Fallback if Firestore was already initialized (e.g. HMR) or IndexedDB is restricted
    console.warn('Persistent Firestore cache fallback to default instance:', err);
    return databaseId ? getFirestore(app, databaseId) : getFirestore(app);
  }
}

// Initialize Firestore with persistent multi-tab local cache when supported
export const db: Firestore = createFirestoreInstance();

export const config = firebaseConfigJson;
