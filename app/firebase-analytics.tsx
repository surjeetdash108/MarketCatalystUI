"use client";

import { useEffect } from "react";
import { getFirebaseAnalytics } from "./firebase";

export function FirebaseAnalytics() {
  useEffect(() => {
    void getFirebaseAnalytics();
  }, []);

  return null;
}
