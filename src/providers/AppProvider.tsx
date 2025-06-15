
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { type User, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { auth, db, storage, USE_EMULATORS_IN_DEVELOPMENT } from '@/lib/firebase/client';
import type { Firestore } from 'firebase/firestore';
import type { FirebaseStorage } from 'firebase/storage';
import type { Auth } from 'firebase/auth';
import { FIRESTORE_APP_ID_PATH_SEGMENT } from '@/lib/constants';
import GlobalLoadingSpinner from '@/components/core/GlobalLoadingSpinner';

interface AppContextType {
  user: User | null;
  userId: string | null;
  loadingAuth: boolean;
  appIdPathSegment: string;
  firebaseAuth: Auth;
  firestoreDb: Firestore;
  firebaseStorage: FirebaseStorage;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    console.log(`[AppProvider] useEffect triggered. USE_EMULATORS_IN_DEVELOPMENT is: ${USE_EMULATORS_IN_DEVELOPMENT}. Waiting for auth state...`);
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        console.log("[AppProvider] User is authenticated:", currentUser.uid);
        setUser(currentUser);
        setLoadingAuth(false);
      } else {
        console.log("[AppProvider] No current user. Attempting anonymous sign-in...");
        try {
          const userCredential = await signInAnonymously(auth);
          console.log("[AppProvider] Anonymous sign-in successful:", userCredential.user.uid);
          setUser(userCredential.user);
        } catch (error: any) {
          console.error("🔴🔴🔴 READ THIS FIRST: The 'auth/network-request-failed' error is EXTERNAL to the app's code. It means a CONNECTION to Firebase failed. See detailed troubleshooting steps below. 🔴🔴🔴");
          console.error("----------------------------------------------------------------------");
          console.error("🛑 Firebase Anonymous Sign-In FAILED. The error was 'auth/network-request-failed'.");
          console.error("   This means the app could NOT connect to Firebase Authentication services.");
          console.error("   The Next.js error overlay might highlight one of THESE console.error lines - this is part of the error MESSAGE, not the root cause.");
          console.error("   >>> CRITICAL STEP: Review earlier console logs from 'src/lib/firebase/client.ts'. They state if you're using EMULATORS or LIVE services and the addresses tried. <<<");
          console.error("Firebase SDK Error Code:", error.code);
          console.error("Firebase SDK Error Message:", error.message);

          if (USE_EMULATORS_IN_DEVELOPMENT) {
            console.error("----------------------------------------------------------------------");
            console.error("IMPORTANT: Your app is configured to USE **LOCAL EMULATORS** (USE_EMULATORS_IN_DEVELOPMENT is true in 'src/lib/firebase/client.ts').");
            console.error("TROUBLESHOOTING STEPS FOR EMULATORS (if 'auth/network-request-failed'):");
            console.error("1. ARE EMULATORS RUNNING? In a SEPARATE terminal, in your project root, run: firebase emulators:start");
            console.error("   (Note: Firebase Emulators may require Java to be installed and on your system PATH. If `firebase emulators:start` fails with a Java error, you'll need to install/configure Java JDK first.)");
            console.error("2. CHECK EMULATOR PORTS: Auth emulator should be on port 9099. (Firestore on 8080, Storage on 9199). The 'src/lib/firebase/client.ts' log shows the exact ports the app tries to connect to.");
            console.error("3. BROWSER: Try a hard refresh (Ctrl+Shift+R or Cmd+Shift+R) AND clear browser cache/site data for localhost.");
            console.error("4. FIREWALL: Ensure no local firewall is blocking connections to localhost on these ports.");
            console.error("5. MULTIPLE PROJECT INSTANCES: Ensure you don't have another project's emulators running on the same ports.");
            console.error("----------------------------------------------------------------------");
          } else {
            console.error("----------------------------------------------------------------------");
            console.error("IMPORTANT: Your app is configured to USE **LIVE FIREBASE SERVICES** (USE_EMULATORS_IN_DEVELOPMENT is false in 'src/lib/firebase/client.ts').");
            console.error("TROUBLESHOOTING STEPS FOR LIVE SERVICES (if 'auth/network-request-failed'):");
            console.error("1. CHECK .env FILE: At the root of your project, verify ALL NEXT_PUBLIC_FIREBASE_... variables in your .env file EXACTLY match your Firebase project's web app configuration (Firebase Console > Project settings > Your apps). Ensure it's saved and you've RESTARTED your Next.js dev server (`npm run dev`).");
            console.error("2. FIREBASE CONSOLE: Ensure 'Anonymous' sign-in method is ENABLED in Firebase Console (Authentication > Sign-in method).");
            console.error("3. NETWORK CONNECTION: Check your internet. Can you access google.com or firebase.google.com?");
            console.error("4. VPN/PROXY/FIREWALL: Temporarily disable any VPN, proxy, or strict firewall that might block connections to Google's servers.");
            console.error("5. API KEY RESTRICTIONS (Google Cloud Console): If you have API key restrictions, ensure they allow requests from your domain (localhost during dev, and your deployed domain) and for the 'Identity Toolkit API' (Firebase Auth) and 'Token Service API'.");
            console.error("6. BROWSER EXTENSIONS: Some ad-blockers or privacy extensions can interfere. Try an incognito window or disable extensions.");
            console.error("----------------------------------------------------------------------");
          }
          console.error("----------------------------------------------------------------------");
          setUser(null);
        } finally {
          setLoadingAuth(false);
        }
      }
    });

    return () => {
      console.log("[AppProvider] Unsubscribing from onAuthStateChanged.");
      unsubscribe();
    };
  }, []);

  const value = {
    user,
    userId: user?.uid || null,
    loadingAuth,
    appIdPathSegment: FIRESTORE_APP_ID_PATH_SEGMENT,
    firebaseAuth: auth,
    firestoreDb: db,
    firebaseStorage: storage,
  };

  return (
    <AppContext.Provider value={value}>
      {loadingAuth ? <GlobalLoadingSpinner /> : children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
