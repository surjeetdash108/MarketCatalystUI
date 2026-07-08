"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { firebaseDb } from "../../firebase";

export function useCollection<T>(collectionName: string) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(firebaseDb, collectionName),
      (snap) => {
        setData(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T));
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error(`Firestore read failed for "${collectionName}":`, err);
        setError(err.message);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [collectionName]);

  return { data, loading, error };
}
