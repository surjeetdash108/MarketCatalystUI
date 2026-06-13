"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  updateProfile,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { firebaseAuth, firebaseDb, googleAuthProvider } from "../../firebase";
import {
  InvestorProfile,
  ProfileFields,
  emptyInvestorProfile,
} from "../../profile/profile-fields";
import {
  completeGoogleLogin,
  getAuthErrorMessage,
  shouldUseGoogleRedirect,
  showError,
} from "../auth-utils";

export function SignupForm() {
  const [password, setPassword] = useState("");
  const [profile, setProfile] = useState<InvestorProfile>(emptyInvestorProfile);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  function handleProfileChange(
    field: keyof InvestorProfile,
    value: string | string[],
  ) {
    setProfile((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      if (profile.preferredAssetClasses.length === 0) {
        const message = "Select at least one preferred asset class.";
        setError(message);
        showError(message);
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(
        firebaseAuth,
        profile.email,
        password,
      );

      await updateProfile(userCredential.user, {
        displayName: profile.name,
      });

      await setDoc(doc(firebaseDb, "users", userCredential.user.uid), {
        ...profile,
        uid: userCredential.user.uid,
        email: userCredential.user.email ?? profile.email,
        tier: "free",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      window.location.href = "/dashboard";
    } catch (authError) {
      const message = getAuthErrorMessage(authError);
      setError(message);
      showError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleLogin() {
    setError("");
    setIsSubmitting(true);
    try {
      if (shouldUseGoogleRedirect()) {
        await signInWithRedirect(firebaseAuth, googleAuthProvider);
        return;
      }
      const userCredential = await signInWithPopup(firebaseAuth, googleAuthProvider);
      await completeGoogleLogin(userCredential);
    } catch (authError) {
      const message = getAuthErrorMessage(authError);
      setError(message);
      showError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-md border border-[#dde5df] bg-white p-6 shadow-sm shadow-slate-200/50 sm:p-7">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#166052]">
        Create account
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        Start using finapp26
      </h1>
      <p className="mt-2 text-sm font-medium leading-6 text-[#52645b]">
        Create your analyst workspace in a few seconds.
      </p>

      <button
        className="mt-6 flex h-12 w-full items-center justify-center gap-3 rounded-md border border-[#d6dfd9] bg-white text-sm font-semibold transition hover:bg-[#f4f7f5] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting}
        onClick={handleGoogleLogin}
        type="button"
      >
        <span className="grid size-6 place-items-center rounded-full bg-[#e8f3ef] text-sm font-semibold text-[#1f5f50]">
          G
        </span>
        Continue with Google
      </button>

      <div className="my-5 flex items-center gap-3 text-xs font-bold uppercase text-[#8b9992]">
        <span className="h-px flex-1 bg-[#eceef5]" />
        or use email
        <span className="h-px flex-1 bg-[#eceef5]" />
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <ProfileFields onChange={handleProfileChange} profile={profile} />

        <div>
          <label
            className="mb-2 block text-sm font-bold text-[#26372f]"
            htmlFor="password"
          >
            Password
          </label>
          <input
            autoComplete="new-password"
            className="h-12 w-full rounded-md border border-[#d6dfd9] bg-white px-4 text-base outline-none transition focus:border-[#1f5f50] focus:ring-4 focus:ring-[#1f5f50]/10"
            id="password"
            minLength={6}
            name="password"
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Create a password"
            required
            type="password"
            value={password}
          />
        </div>

        {error ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
            {error}
          </p>
        ) : null}

        <button
          className="h-12 w-full rounded-md bg-[#1f5f50] px-5 text-base font-semibold text-white transition hover:bg-[#17483d] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Please wait..." : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm font-medium text-[#52645b]">
        Already have access?{" "}
        <Link className="font-semibold text-[#166052]" href="/auth/login">
          Sign in
        </Link>
      </p>
    </div>
  );
}
