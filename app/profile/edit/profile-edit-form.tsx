"use client";

import { FirebaseError } from "firebase/app";
import { updateProfile } from "firebase/auth";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { firebaseAuth } from "../../firebase";
import { apiPatch } from "../../iq/backend";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { updateProfileData } from "../../store/profile-slice";
import { InvestorProfile, ProfileFields, emptyInvestorProfile, toProfilePatch } from "../profile-fields";
import { SETTINGS_ACCOUNT_HREF } from "./profile-edit-shell";

function getSaveErrorMessage(error: unknown) {
  if (error instanceof FirebaseError) return error.message;
  return "Unable to save profile. Please try again.";
}

export function ProfileEditForm() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector(state => state.auth);
  const { data: savedProfile, status: profileStatus } = useAppSelector(state => state.profile);

  const [profile, setProfile] = useState<InvestorProfile>(emptyInvestorProfile);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (savedProfile) {
      setProfile({
        ...emptyInvestorProfile,
        ...savedProfile,
        email: user?.email ?? savedProfile.email ?? "",
      });
    }
  }, [savedProfile, user]);

  function handleProfileChange(field: keyof InvestorProfile, value: string | string[]) {
    setProfile(current => ({ ...current, [field]: value }));
  }

  async function handleSave() {
    if (!user?.uid) {
      const msg = "Your session is not ready. Please sign in again.";
      setError(msg);
      window.alert(msg);
      return;
    }
    // Temporarily disabled while preferred asset classes input is commented out
    // if (profile.preferredAssetClasses.length === 0) {
    //   const msg = "Select at least one preferred asset class.";
    //   setError(msg);
    //   window.alert(msg);
    //   return;
    // }
    setError("");
    setIsSaving(true);
    try {
      if (firebaseAuth.currentUser) {
        await updateProfile(firebaseAuth.currentUser, { displayName: profile.name });
      }
      await apiPatch("/api/profile", toProfilePatch(profile));
      dispatch(updateProfileData({ ...profile, uid: user.uid, tier: savedProfile?.tier ?? "free" }));
      // Back to Settings, where the Pending chips are gone.
      router.push(SETTINGS_ACCOUNT_HREF);
    } catch (saveError) {
      const msg = getSaveErrorMessage(saveError);
      setError(msg);
      window.alert(msg);
    } finally {
      setIsSaving(false);
    }
  }

  if (profileStatus === "loading" || (profileStatus === "idle" && !savedProfile)) {
    return (
      <div className="st-d" style={{ padding: "0 14px" }}>
        Loading profile details…
      </div>
    );
  }

  return (
    <>
      {/* Profile header */}
      <div className="st-row" style={{ justifyContent: "flex-start", gap: 14 }}>
        <img
          alt={profile.name || "Profile"}
          src={profile.profile_image || "/profile-avatar.svg"}
          style={{
            width: 56, height: 56, borderRadius: "50%",
            objectFit: "cover", border: "2px solid var(--border-strong)", flexShrink: 0,
          }}
        />
        <div>
          <div className="st-t" style={{ fontSize: "1rem", fontFamily: "var(--f-display)" }}>
            {profile.name || "Investor profile"}
          </div>
          <div className="st-d">{profile.investmentExperience || "Investment profile"}</div>
        </div>
      </div>

      {/* Form */}
      <form className="st-block" onSubmit={e => e.preventDefault()} style={{ marginTop: 6, borderTop: "1px solid var(--border-soft)", paddingTop: 16 }}>
        <ProfileFields emailReadOnly onChange={handleProfileChange} profile={profile} />

        {error && (
          <div style={{
            marginTop: 14, padding: "9px 13px", borderRadius: "var(--r-sm)",
            background: "var(--down-dim)", border: "1px solid var(--down)",
            fontSize: "0.8125rem", color: "var(--down)",
          }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <button type="button" className="iq-btn-ghost" onClick={() => router.push(SETTINGS_ACCOUNT_HREF)}>
            Cancel
          </button>
          <button type="button" className="iq-btn-primary" disabled={isSaving} onClick={handleSave}>
            {isSaving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </>
  );
}
