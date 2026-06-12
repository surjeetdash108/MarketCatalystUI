import Link from "next/link";
import { AuthGuard } from "../../dashboard/auth-guard";
import { ProfileEditForm } from "./profile-edit-form";

export default function EditProfilePage() {
  return (
    <AuthGuard>
      <main className="min-h-screen bg-[#f4f6f8] px-5 py-8 text-[#17231d] sm:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#166052]">
                Profile
              </p>
              <h1 className="mt-2 text-3xl font-semibold">Edit profile</h1>
            </div>
            <Link
              className="rounded-md border border-[#d6dfd9] bg-white px-4 py-2 text-sm font-semibold text-[#166052] transition hover:bg-[#eef6f3]"
              href="/dashboard"
            >
              Back to dashboard
            </Link>
          </div>

          <ProfileEditForm />
        </div>
      </main>
    </AuthGuard>
  );
}
