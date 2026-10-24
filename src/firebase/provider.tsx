'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { firebaseConfig } from './config';

interface FirebaseContextType {
  app: FirebaseApp | null;
  auth: Auth | null;
  firestore: Firestore | null;
  storage: FirebaseStorage | null;
  user: User | null;
  isUserLoading: boolean;
}

const FirebaseContext = createContext<FirebaseContextType>({
  app: null,
  auth: null,
  firestore: null,
  storage: null,
  user: null,
  isUserLoading: true,
});

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;
let cachedFirestore: Firestore | null = null;
let cachedStorage: FirebaseStorage | null = null;

function getFirebaseInstances() {
  if (typeof window === 'undefined') {
    return { app: null, auth: null, firestore: null, storage: null };
  }
  try {
    if (!cachedApp) {
      cachedApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
      cachedAuth = getAuth(cachedApp);
      cachedFirestore = getFirestore(cachedApp);
      cachedStorage = getStorage(cachedApp);
    }
  } catch (error) {
    console.error('Firebase initialization error:', error);
  }
  return {
    app: cachedApp,
    auth: cachedAuth,
    firestore: cachedFirestore,
    storage: cachedStorage,
  };
}

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);
  const [instances, setInstances] = useState(() => getFirebaseInstances());

  useEffect(() => {
    const inst = getFirebaseInstances();
    setInstances(inst);
    if (!inst.auth) {
      setIsUserLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(inst.auth, (currentUser) => {
      setUser(currentUser);
      setIsUserLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <FirebaseContext.Provider
      value={{
        app: instances.app,
        auth: instances.auth,
        firestore: instances.firestore,
        storage: instances.storage,
        user,
        isUserLoading,
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
}

export const useFirebase = () => useContext(FirebaseContext);
export const useAuth = () => {
  const { auth } = useContext(FirebaseContext);
  return auth;
};
export const useFirestore = () => {
  const { firestore } = useContext(FirebaseContext);
  return firestore;
};
export const useStorage = () => {
  const { storage } = useContext(FirebaseContext);
  return storage;
};

export const useUser = () => {
  const { user, isUserLoading } = useContext(FirebaseContext);
  return { user, isUserLoading };
};

export function useMemoFirebase<T>(factory: () => T, deps: React.DependencyList): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(factory, deps);
}
