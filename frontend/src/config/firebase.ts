import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';

const DEFAULT_PLACEHOLDER_KEY = 'AIzaSyPlaceholderKeyForDevTesting';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || DEFAULT_PLACEHOLDER_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'pingup-placeholder.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'pingup-placeholder',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'pingup-placeholder.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '000000000000',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:000000000000:web:000000000000',
};

export function isFirebaseConfigured(): boolean {
  const { apiKey, projectId, appId } = firebaseConfig;
  if (!apiKey || !projectId || !appId) return false;
  if (apiKey === DEFAULT_PLACEHOLDER_KEY || apiKey.includes('Placeholder') || projectId.includes('placeholder')) {
    return false;
  }
  return true;
}

let app: FirebaseApp;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

export const auth: Auth = getAuth(app);
export { firebaseConfig };
