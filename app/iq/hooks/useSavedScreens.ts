"use client";

import { useCallback, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { firebaseAuth } from "../../firebase";

/** Most screens one user can keep (for now; a per-plan limit can replace it). */
export const SAVED_SCREEN_LIMIT = 20;
const NAME_MAX = 60;

/** The screener's filter state as stored: presets by name, so reordering the preset list can't change a saved screen. */
export interface ScreenFilters {
  presets: string[];
  sector: string;
  toggles: Record<string, boolean>;
}

export interface SavedScreen {
  id: string;
  name: string;
  filters: ScreenFilters;
  createdAt: string;
}

export type SaveScreenResult = { ok: true; screen: SavedScreen } | { ok: false; message: string };

/** users/{uid}/saved_screens — owner-only (firestore.rules), read and written from the browser. */
async function screensCollection(uid: string) {
  const [{ getFirestore, collection }, { firebaseApp }] = await Promise.all([
    import("firebase/firestore/lite"),
    import("../../firebase"),
  ]);
  const db = getFirestore(firebaseApp, process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID || "mc-regional");
  return collection(db, "users", uid, "saved_screens");
}

export function useSavedScreens() {
  const [uid, setUid] = useState<string | null>(firebaseAuth.currentUser?.uid ?? null);
  const [screens, setScreens] = useState<SavedScreen[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => onAuthStateChanged(firebaseAuth, u => setUid(u?.uid ?? null)), []);

  useEffect(() => {
    if (!uid) { setScreens([]); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const { getDocs } = await import("firebase/firestore/lite");
        const snap = await getDocs(await screensCollection(uid));
        if (cancelled) return;
        const list = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<SavedScreen, "id">) }));
        list.sort((a, b) => a.name.localeCompare(b.name));
        setScreens(list);
      } catch (e) {
        console.warn("Loading saved screens failed:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [uid]);

  const save = useCallback(async (rawName: string, filters: ScreenFilters): Promise<SaveScreenResult> => {
    if (!uid) return { ok: false, message: "Sign in to save screens." };
    const name = rawName.trim().slice(0, NAME_MAX);
    if (!name) return { ok: false, message: "Give the screen a name." };
    const existing = screens.find(s => s.name.toLowerCase() === name.toLowerCase());
    if (!existing && screens.length >= SAVED_SCREEN_LIMIT)
      return { ok: false, message: `You can keep up to ${SAVED_SCREEN_LIMIT} saved screens. Delete one to save another.` };
    try {
      const { addDoc, doc, setDoc } = await import("firebase/firestore/lite");
      const col = await screensCollection(uid);
      const data = { name, filters, createdAt: existing?.createdAt ?? new Date().toISOString() };
      let id = existing?.id;
      if (id) await setDoc(doc(col, id), data);
      else id = (await addDoc(col, data)).id;
      const screen: SavedScreen = { id, ...data };
      setScreens(prev => [...prev.filter(s => s.id !== id), screen].sort((a, b) => a.name.localeCompare(b.name)));
      return { ok: true, screen };
    } catch (e) {
      console.warn("Saving screen failed:", e);
      return { ok: false, message: "Couldn't save the screen. Try again." };
    }
  }, [uid, screens]);

  const remove = useCallback(async (id: string) => {
    if (!uid) return;
    try {
      const { deleteDoc, doc } = await import("firebase/firestore/lite");
      await deleteDoc(doc(await screensCollection(uid), id));
      setScreens(prev => prev.filter(s => s.id !== id));
    } catch (e) {
      console.warn("Deleting screen failed:", e);
    }
  }, [uid]);

  return { signedIn: !!uid, screens, loading, save, remove };
}
