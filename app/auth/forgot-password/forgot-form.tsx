"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { firebaseAuth } from "../../firebase";
import { getAuthErrorMessage, showError } from "../auth-utils";

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);
    try {
      await sendPasswordResetEmail(firebaseAuth, email);
      setSuccess("Password reset email sent. Check your inbox.");
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
        Recover access
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        Reset your password
      </h1>
      <p className="mt-2 text-sm font-medium leading-6 text-[#52645b]">
        We will send a password reset link to your email.
      </p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
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
          className="h-12 w-full rounded-md bg-[#1f5f50] px-5 text-base font-semibold text-white transition hover:bg-[#17483d] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Please wait..." : "Send reset link"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm font-medium text-[#52645b]">
        Remembered it?{" "}
        <Link className="font-semibold text-[#166052]" href="/auth/login">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
