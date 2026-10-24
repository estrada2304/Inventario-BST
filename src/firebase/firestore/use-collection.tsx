'use client';

import { useState, useEffect } from 'react';
import { onSnapshot, Query, DocumentData, CollectionReference } from 'firebase/firestore';
import { errorEmitter } from '../error-emitter';
import { FirestorePermissionError } from '../errors';

export function useCollection<T = DocumentData>(
  query: Query<DocumentData> | CollectionReference<DocumentData> | null
) {
  const [data, setData] = useState<T[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!query) {
      setData(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const unsubscribe = onSnapshot(
      query,
      (snapshot) => {
        const items = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as T[];
        setData(items);
        setIsLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Firestore collection error:', err);
        setError(err);
        setIsLoading(false);
        if (err.code === 'permission-denied') {
          errorEmitter.emit(
            'permission-error',
            new FirestorePermissionError({
              path: (query as any)._query?.path?.toString() || 'collection',
              operation: 'read',
            })
          );
        }
      }
    );

    return () => unsubscribe();
  }, [query]);

  return { data, isLoading, error };
}
