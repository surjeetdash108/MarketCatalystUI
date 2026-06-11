import { getApp, getApps, initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyD9li2opUrfLBHjn7qQP_8ZH6EG4aDF6wI",
  authDomain: "fin-app26.firebaseapp.com",
  projectId: "fin-app26",
  storageBucket: "fin-app26.firebasestorage.app",
  messagingSenderId: "798207284512",
  appId: "1:798207284512:web:24acbe3319610b552ef345",
  measurementId: "G-3ZTVQB1S7Z",
};

export const firebaseApp = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

export const firebaseAuth = getAuth(firebaseApp);
export const googleAuthProvider = new GoogleAuthProvider();

export async function getFirebaseAnalytics() {
  if (typeof window === "undefined") {
    return null;
  }

  const supported = await isSupported();

  if (!supported) {
    return null;
  }

  return getAnalytics(firebaseApp);
}
