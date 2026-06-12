import Link from "next/link";
import { AuthGuard } from "../dashboard/auth-guard";
import { SignOutButton } from "../dashboard/sign-out-button";

export default function SettingsPage() {
  return (
    <AuthGuard>
      <main className="min-h-screen bg-[#f4f6f8] px-5 py-8 text-[#17231d] sm:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#166052]">
                Settings
              </p>
              <h1 className="mt-2 text-3xl font-semibold">Account settings</h1>
            </div>
            <Link
              className="rounded-md border border-[#d6dfd9] bg-white px-4 py-2 text-sm font-semibold text-[#166052] transition hover:bg-[#eef6f3]"
              href="/dashboard"
            >
              Back to dashboard
            </Link>
          </div>

          <section className="rounded-md border border-[#dde5df] bg-white p-6 shadow-sm shadow-slate-200/50">
            <div className="flex flex-col gap-4 border-b border-[#e5ebe7] pb-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Session</h2>
                <p className="mt-2 text-sm font-medium leading-6 text-[#52645b]">
                  Sign out from this device and return to the login page.
                </p>
              </div>
              <SignOutButton />
            </div>

            <div className="grid gap-4 pt-6 sm:grid-cols-2">
              <div className="rounded-md border border-[#e5ebe7] bg-[#fbfcfb] p-4">
                <p className="text-sm font-semibold">Profile</p>
                <p className="mt-2 text-sm text-[#52645b]">
                  Update your name, role, and plan details.
                </p>
                <Link
                  className="mt-4 inline-block text-sm font-semibold text-[#166052]"
                  href="/profile/edit"
                >
                  Edit profile &gt;
                </Link>
              </div>
              <div className="rounded-md border border-[#e5ebe7] bg-[#fbfcfb] p-4">
                <p className="text-sm font-semibold">Preferences</p>
                <p className="mt-2 text-sm text-[#52645b]">
                  Manage alerts, market defaults, and display settings.
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>
    </AuthGuard>
  );
}
