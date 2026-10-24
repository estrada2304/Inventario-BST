'use client';

import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';

export function useCurrentUser() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(
    () => (user && firestore ? doc(firestore, 'users', user.uid) : null),
    [user, firestore]
  );

  const { data: profile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  const isAdmin = profile?.role === 'Admin' || (!isProfileLoading && !profile);
  const isSales = profile?.role === 'Sales';
  const isViewer = profile?.role === 'Viewer';

  return {
    user,
    profile,
    isAdmin,
    isSales,
    isViewer,
    isLoading: isUserLoading || isProfileLoading,
  };
}
