
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { firebaseConfig } from './config';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export const USE_EMULATORS_IN_DEVELOPMENT = true;

if (process.env.NODE_ENV === 'development') {
  if (typeof window !== 'undefined') {
    if (USE_EMULATORS_IN_DEVELOPMENT) {
      console.log('[Firebase Client] DEV MODE (CLIENT): USE_EMULATORS_IN_DEVELOPMENT is true. Attempting to connect to emulators...');
      
      // Auth Emulator
      // @ts-ignore
      if (!auth.emulatorConfig) {
        try {
          connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
          console.log('[Firebase Client] DEV MODE (CLIENT): Auth emulator connection configured for http://localhost:9099');
        } catch (e: any) {
          console.warn(`[Firebase Client] DEV MODE (CLIENT): Auth Emulator connection FAILED. Is it running at http://localhost:9099? Error: ${e.message}`);
        }
      } else {
        console.log('[Firebase Client] DEV MODE (CLIENT): Auth emulator was already configured.');
      }

      // Firestore Emulator - Connect to port 8080
      // @ts-ignore
      if (!db._host || (db._host && !db._host.includes('localhost:8080'))) {
        try {
          connectFirestoreEmulator(db, 'localhost', 8080);
          console.log('[Firebase Client] DEV MODE (CLIENT): Firestore emulator connection configured for localhost:8080');
        } catch (e: any) {
          console.warn(`[Firebase Client] DEV MODE (CLIENT): Firestore Emulator connection FAILED. Is it running at localhost:8080? Error: ${e.message}`);
        }
      } else {
        console.log('[Firebase Client] DEV MODE (CLIENT): Firestore emulator was already configured for localhost:8080.');
      }

      // Storage Emulator
      // @ts-ignore
      if (!storage.emulatorConfig) {
        try {
          connectStorageEmulator(storage, 'localhost', 9199);
          console.log('[Firebase Client] DEV MODE (CLIENT): Storage emulator connection configured for localhost:9199');
        } catch (e: any) {
          console.warn(`[Firebase Client] DEV MODE (CLIENT): Storage Emulator connection FAILED. Is it running at localhost:9199? Error: ${e.message}`);
        }
      } else {
        console.log('[Firebase Client] DEV MODE (CLIENT): Storage emulator was already configured.');
      }
      console.log('%c[Firebase Client] DEV MODE (CLIENT): CURRENTLY CONFIGURED TO USE LOCAL EMULATORS (Firestore on port 8080).', 'color: blue; font-weight: bold; font-size: 1.1em;');
    } else {
      console.log('%c[Firebase Client] DEV MODE (CLIENT): USE_EMULATORS_IN_DEVELOPMENT is false. Connecting to LIVE Firebase services.', 'color: green; font-weight: bold; font-size: 1.1em;');
    }
  } else { // Server-side execution in development
    console.log('[Firebase Client] DEV MODE (SERVER): Firebase client SDK initialized. Emulator connections are client-side only.');
    if (USE_EMULATORS_IN_DEVELOPMENT) {
        console.log('[Firebase Client] DEV MODE (SERVER): Client-side will be configured for EMULATORS (USE_EMULATORS_IN_DEVELOPMENT is true). Firestore port: 8080.');
    } else {
        console.log('[Firebase Client] DEV MODE (SERVER): Client-side will be configured for LIVE services (USE_EMULATORS_IN_DEVELOPMENT is false).');
    }
  }
} else { // Production mode (both client and server)
  console.log('%c[Firebase Client] PRODUCTION MODE: Connecting to LIVE Firebase services.', 'color: green; font-weight: bold; font-size: 1.1em;');
}

export { app, auth, db, storage };
