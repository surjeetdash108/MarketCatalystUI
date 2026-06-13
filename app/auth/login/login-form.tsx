"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import {
  getRedirectResult,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import { firebaseAuth, googleAuthProvider } from "../../firebase";
import {
  checkAndRedirectIfLoggedIn,
  completeGoogleLogin,
  getAuthErrorMessage,
  shouldUseGoogleRedirect,
  showError,
} from "../auth-utils";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      try {
        const userCredential = await getRedirectResult(firebaseAuth);
        if (!isMounted) return;

        if (userCredential) {
          setIsSubmitting(true);
          await completeGoogleLogin(userCredential);
          return;
        }

        await checkAndRedirectIfLoggedIn();
      } catch (err) {
        if (!isMounted) return;
        const message = getAuthErrorMessage(err);
        setError(message);
        showError(message);
      } finally {
        if (isMounted) setIsSubmitting(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      await signInWithEmailAndPassword(firebaseAuth, email, password);
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
        Welcome back
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        Sign in to finapp26
      </h1>
      <p className="mt-2 text-sm font-medium leading-6 text-[#52645b]">
        Access your financial intelligence dashboard.
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
        <div>
          <label
            className="mb-2 block text-sm font-bold text-[#26372f]"
            htmlFor="email"
          >
            Work email
          </label>
          <input
            autoComplete="email"
            className="h-12 w-full rounded-md border border-[#d6dfd9] bg-white px-4 text-base outline-none transition focus:border-[#1f5f50] focus:ring-4 focus:ring-[#1f5f50]/10"
            id="email"
            name="email"
            onChange={(e) => setEmail(e.target.value)}
            placeholder="analyst@company.com"
            required
            type="email"
            value={email}
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-4">
            <label
              className="block text-sm font-bold text-[#26372f]"
              htmlFor="password"
            >
              Password
            </label>
            <Link
              className="text-sm font-bold text-[#166052]"
              href="/auth/forgot-password"
            >
              Forgot password?
            </Link>
          </div>
          <input
            autoComplete="current-password"
            className="h-12 w-full rounded-md border border-[#d6dfd9] bg-white px-4 text-base outline-none transition focus:border-[#1f5f50] focus:ring-4 focus:ring-[#1f5f50]/10"
            id="password"
            minLength={6}
            name="password"
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
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
          {isSubmitting ? "Please wait..." : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm font-medium text-[#52645b]">
        New to finapp26?{" "}
        <Link className="font-semibold text-[#166052]" href="/auth/signup">
          Create an account
        </Link>
      </p>
    </div>
  );
}
