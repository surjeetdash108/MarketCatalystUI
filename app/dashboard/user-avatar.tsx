"use client";

import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { firebaseAuth, firebaseDb } from "../firebase";

interface UserAvatarProps {
  className?: string;
}

export function UserAvatar({ className = "size-11 rounded-full object-cover" }: Readonly<UserAvatarProps>) {
  const [src, setSrc] = useState("/profile-avatar.svg");
  const [name, setName] = useState("User");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (!user) return;
      setName(user.displayName ?? user.email ?? "User");
      try {
        const snap = await getDoc(doc(firebaseDb, "users", user.uid));
        const img = snap.exists()
          ? (snap.data() as { profile_image?: string }).profile_image ?? ""
          : "";
        setSrc(img || user.photoURL || "/profile-avatar.svg");
      } catch {
        setSrc(user.photoURL || "/profile-avatar.svg");
      }
    });
    return unsubscribe;
  }, []);

  return (
    <img
      alt={`${name} profile photo`}
      className={className}
      src={src}
    />
  );
}
