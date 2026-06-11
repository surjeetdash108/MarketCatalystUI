"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { FirebaseError } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { firebaseAuth, googleAuthProvider } from "../firebase";

type AuthMode = "login" | "signup" | "forgot";

const authCopy = {
  login: {
    eyebrow: "Welcome back",
    title: "Sign in to finapp26",
    description: "Access your financial intelligence dashboard.",
    button: "Sign in",
  },
  signup: {
    eyebrow: "Create account",
    title: "Start using finapp26",
    description: "Create your analyst workspace in a few seconds.",
    button: "Create account",
  },
  forgot: {
    eyebrow: "Recover access",
    title: "Reset your password",
    description: "We will send a password reset link to your email.",
    button: "Send reset link",
  },
} satisfies Record<AuthMode, Record<string, string>>;

function getAuthErrorMessage(error: unknown) {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case "auth/invalid-email":
        return "Enter a valid email address.";
      case "auth/user-not-found":
      case "auth/wrong-password":
      case "auth/invalid-credential":
        return "Email or password is incorrect.";
      case "auth/email-already-in-use":
        return "An account already exists with this email.";
      case "auth/configuration-not-found":
        return "Firebase Authentication is not configured for this project. Enable Authentication and the Google provider in Firebase Console.";
      case "auth/weak-password":
        return "Password should be at least 6 characters.";
      case "auth/popup-closed-by-user":
        return "Google sign-in was closed before it finished.";
      case "auth/too-many-requests":
        return "Too many attempts. Please wait a moment and try again.";
      default:
        return error.message;
    }
  }

  return "Something went wrong. Please try again.";
}

export function AuthPanel({ mode }: Readonly<{ mode: AuthMode }>) {
  const router = useRouter();
  const copy = authCopy[mode];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const alternateAction = useMemo(() => {
    if (mode === "login") {
      return {
        label: "New to finapp26?",
        href: "/auth/signup",
        text: "Create an account",
      };
    }

    if (mode === "signup") {
      return {
        label: "Already have access?",
        href: "/auth/login",
        text: "Sign in",
      };
    }

    return {
      label: "Remembered it?",
      href: "/auth/login",
      text: "Back to sign in",
    };
  }, [mode]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(firebaseAuth, email, password);
        router.push("/dashboard");
        return;
      }

      if (mode === "signup") {
        await createUserWithEmailAndPassword(firebaseAuth, email, password);
        router.push("/dashboard");
        return;
      }

      await sendPasswordResetEmail(firebaseAuth, email);
      setSuccess("Password reset email sent. Check your inbox.");
    } catch (authError) {
      setError(getAuthErrorMessage(authError));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleLogin() {
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      await signInWithPopup(firebaseAuth, googleAuthProvider);
      router.push("/dashboard");
    } catch (authError) {
      setError(getAuthErrorMessage(authError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f7fb] text-[#171925]">
      <div className="grid min-h-screen lg:grid-cols-[0.95fr_1.05fr]">
        <section className="flex items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-md">
            <Link className="mb-9 flex w-fit items-center gap-3" href="/">
              <span className="grid size-11 place-items-center rounded-lg bg-[#4b46e8] text-lg font-black text-white shadow-lg shadow-indigo-200">
                26
              </span>
              <span>
                <span className="block text-xl font-black leading-none">
                  finapp26
                </span>
                <span className="mt-1 block text-xs font-semibold text-[#737989]">
                  Investor Intelligence
                </span>
              </span>
            </Link>

            <div className="rounded-lg border border-[#e5e7f0] bg-white p-6 shadow-[0_24px_80px_rgba(35,38,75,0.08)] sm:p-7">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#5146d8]">
                {copy.eyebrow}
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-tight">
                {copy.title}
              </h1>
              <p className="mt-2 text-sm font-medium leading-6 text-[#666d7d]">
                {copy.description}
              </p>

              {mode !== "forgot" ? (
                <button
                  className="mt-6 flex h-12 w-full items-center justify-center gap-3 rounded-md border border-[#dfe2ec] bg-white text-sm font-bold transition hover:bg-[#f7f8fb] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isSubmitting}
                  onClick={handleGoogleLogin}
                  type="button"
                >
                  <span className="grid size-6 place-items-center rounded-full bg-[#f1f4ff] text-sm font-black text-[#4b46e8]">
                    G
                  </span>
                  Continue with Google
                </button>
              ) : null}

              {mode !== "forgot" ? (
                <div className="my-5 flex items-center gap-3 text-xs font-bold uppercase text-[#9aa0af]">
                  <span className="h-px flex-1 bg-[#eceef5]" />
                  or use email
                  <span className="h-px flex-1 bg-[#eceef5]" />
                </div>
              ) : null}

              <form className="space-y-4" onSubmit={handleSubmit}>
                <div>
                  <label
                    className="mb-2 block text-sm font-bold text-[#333747]"
                    htmlFor="email"
                  >
                    Work email
                  </label>
                  <input
                    autoComplete="email"
                    className="h-12 w-full rounded-md border border-[#dfe2ec] bg-white px-4 text-base outline-none transition focus:border-[#4b46e8] focus:ring-4 focus:ring-[#4b46e8]/10"
                    id="email"
                    name="email"
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="analyst@company.com"
                    required
                    type="email"
                    value={email}
                  />
                </div>

                {mode !== "forgot" ? (
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-4">
                      <label
                        className="block text-sm font-bold text-[#333747]"
                        htmlFor="password"
                      >
                        Password
                      </label>
                      {mode === "login" ? (
                        <Link
                          className="text-sm font-bold text-[#5146d8]"
                          href="/auth/forgot-password"
                        >
                          Forgot password?
                        </Link>
                      ) : null}
                    </div>
                    <input
                      autoComplete={
                        mode === "login" ? "current-password" : "new-password"
                      }
                      className="h-12 w-full rounded-md border border-[#dfe2ec] bg-white px-4 text-base outline-none transition focus:border-[#4b46e8] focus:ring-4 focus:ring-[#4b46e8]/10"
                      id="password"
                      minLength={6}
                      name="password"
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Enter password"
                      required
                      type="password"
                      value={password}
                    />
                  </div>
                ) : null}

                {error ? (
                  <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                    {error}
                  </p>
                ) : null}

                {success ? (
                  <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                    {success}
                  </p>
                ) : null}

                <button
                  className="h-12 w-full rounded-md bg-[#4b46e8] px-5 text-base font-black text-white transition hover:bg-[#3832c7] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isSubmitting}
                  type="submit"
                >
                  {isSubmitting ? "Please wait..." : copy.button}
                </button>
              </form>

              <p className="mt-6 text-center text-sm font-medium text-[#666d7d]">
                {alternateAction.label}{" "}
                <Link
                  className="font-black text-[#5146d8]"
                  href={alternateAction.href}
                >
                  {alternateAction.text}
                </Link>
              </p>
            </div>
          </div>
        </section>

        <aside className="hidden bg-[#171925] px-12 py-12 text-white lg:flex lg:items-center">
          <div className="w-full">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#a6a8ff]">
              Market command center
            </p>
            <h2 className="mt-4 max-w-xl text-5xl font-black leading-tight">
              Authenticated intelligence for faster portfolio decisions.
            </h2>
            <div className="mt-10 grid gap-4 xl:grid-cols-3">
              {[
                ["Live Signals", "128", "+14 today"],
                ["Portfolio Risk", "Low", "2 alerts"],
                ["AI Recaps", "9:15", "AM ET"],
              ].map(([label, value, detail]) => (
                <div
                  className="rounded-lg border border-white/10 bg-white/[0.06] p-5"
                  key={label}
                >
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[#aeb3c8]">
                    {label}
                  </p>
                  <p className="mt-4 text-3xl font-black">{value}</p>
                  <p className="mt-2 text-sm font-semibold text-emerald-300">
                    {detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
