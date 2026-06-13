"use client";

import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useEffect } from "react";
import { firebaseAuth, firebaseDb } from "../firebase";
import { setAuthReady, setUser } from "./auth-slice";
import { useAppDispatch } from "./hooks";
import { setProfile, setProfileLoading, StoredProfile } from "./profile-slice";

export function FirebaseListener() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    // Wait for Firebase to restore the persisted session from IndexedDB before
    // subscribing, so the first onAuthStateChanged call reflects the real state.
    void firebaseAuth.authStateReady().then(() => {
      if (cancelled) return;

      unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
        if (cancelled) return;

        if (user) {
          dispatch(
            setUser({
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL,
            }),
          );

          dispatch(setProfileLoading());
          try {
            const snap = await getDoc(doc(firebaseDb, "users", user.uid));
            if (!cancelled) {
              const raw = snap.exists() ? snap.data() : null;
              if (raw) {
                // Strip Firestore Timestamps — they are not Redux-serializable
                const { createdAt: _ca, updatedAt: _ua, ...rest } = raw;
                dispatch(setProfile(rest as StoredProfile));
              } else {
                dispatch(setProfile(null));
              }
            }
          } catch {
            if (!cancelled) dispatch(setProfile(null));
          }
        } else {
          dispatch(setUser(null));
          dispatch(setProfile(null));
        }

        if (!cancelled) dispatch(setAuthReady());
      });
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [dispatch]);

  return null;
}
