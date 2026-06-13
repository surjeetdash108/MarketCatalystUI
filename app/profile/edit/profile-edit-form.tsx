"use client";

import Image from "next/image";
import Link from "next/link";
import { FirebaseError } from "firebase/app";
import { onAuthStateChanged, updateProfile } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { firebaseAuth, firebaseDb } from "../../firebase";
import {
  InvestorProfile,
  ProfileFields,
  emptyInvestorProfile,
} from "../profile-fields";

function getSaveErrorMessage(error: unknown) {
  if (error instanceof FirebaseError) {
    return error.message;
  }

  return "Unable to save profile. Please try again.";
}

function showError(message: string) {
  window.alert(message);
}

export function ProfileEditForm() {
  const [profile, setProfile] = useState<InvestorProfile>(emptyInvestorProfile);
  const [userId, setUserId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (!user) {
        return;
      }

      try {
        setUserId(user.uid);

        const profileSnapshot = await getDoc(doc(firebaseDb, "users", user.uid));
        const savedProfile = profileSnapshot.exists()
          ? (profileSnapshot.data() as Partial<InvestorProfile>)
          : {};

        setProfile({
          ...emptyInvestorProfile,
          ...savedProfile,
          name: savedProfile.name ?? user.displayName ?? "",
          email: user.email ?? savedProfile.email ?? "",
          preferredAssetClasses: savedProfile.preferredAssetClasses ?? [],
        });
      } catch (loadError) {
        const message = getSaveErrorMessage(loadError);
        setError(message);
        showError(message);
      } finally {
        setIsLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  function handleProfileChange(
    field: keyof InvestorProfile,
    value: string | string[],
  ) {
    setProfile((currentProfile) => ({
      ...currentProfile,
      [field]: value,
    }));
  }

  async function handleSave() {
    if (!userId) {
      const message = "Your session is not ready. Please sign in again.";
      setError(message);
      showError(message);
      return;
    }

    if (profile.preferredAssetClasses.length === 0) {
      const message = "Select at least one preferred asset class.";
      setError(message);
      showError(message);
      return;
    }

    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      if (firebaseAuth.currentUser) {
        await updateProfile(firebaseAuth.currentUser, {
          displayName: profile.name,
        });
      }

      await setDoc(
        doc(firebaseDb, "users", userId),
        {
          ...profile,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      setSuccess("Profile updated successfully.");
    } catch (saveError) {
      const message = getSaveErrorMessage(saveError);
      setError(message);
      showError(message);
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <section className="rounded-md border border-[#dde5df] bg-white p-6 shadow-sm shadow-slate-200/50">
        <p className="text-sm font-semibold text-[#52645b]">
          Loading profile details...
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-md border border-[#dde5df] bg-white p-6 shadow-sm shadow-slate-200/50">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <img
          alt={`${profile.name || "Investor"} profile photo`}
          className="rounded-full border-4 border-white shadow-sm shadow-emerald-100"
          height={96}
          src={profile.profile_image || "/profile-avatar.svg"}
          width={96}
        />
        <div>
          <h2 className="text-xl font-semibold">
            {profile.name || "Investor profile"}
          </h2>
          <p className="mt-1 text-sm font-semibold text-[#66756d]">
            {profile.investmentExperience || "Investment profile"}
          </p>
        </div>
      </div>

      <form className="mt-8 space-y-6" onSubmit={(event) => event.preventDefault()}>
        <ProfileFields
          emailReadOnly
          onChange={handleProfileChange}
          profile={profile}
        />

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

        <div className="flex justify-end gap-3">
          <Link
            className="rounded-md border border-[#d6dfd9] px-5 py-3 text-sm font-semibold text-[#4c5261] transition hover:bg-[#f4f7f5]"
            href="/dashboard"
          >
            Cancel
          </Link>
          <button
            className="rounded-md bg-[#1f5f50] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#17483d] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSaving}
            onClick={handleSave}
            type="button"
          >
            {isSaving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    </section>
  );
}
