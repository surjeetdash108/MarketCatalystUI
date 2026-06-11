import Image from "next/image";
import Link from "next/link";
import { AuthGuard } from "../../dashboard/auth-guard";

export default function EditProfilePage() {
  return (
    <AuthGuard>
      <main className="min-h-screen bg-[#f7f7fb] px-5 py-8 text-[#171925] sm:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#5146d8]">
                Profile
              </p>
              <h1 className="mt-2 text-3xl font-black">Edit profile</h1>
            </div>
            <Link
              className="rounded-md border border-[#dfe2ec] bg-white px-4 py-2 text-sm font-black text-[#5146d8] transition hover:bg-[#f2f1ff]"
              href="/dashboard"
            >
              Back to dashboard
            </Link>
          </div>

          <section className="rounded-lg border border-[#e5e7f0] bg-white p-6 shadow-[0_24px_80px_rgba(35,38,75,0.08)]">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <Image
                alt="Arjun Investor profile photo"
                className="rounded-full border-4 border-white shadow-md shadow-indigo-100"
                height={96}
                src="/profile-avatar.svg"
                width={96}
              />
              <div>
                <h2 className="text-xl font-black">Arjun Investor</h2>
                <p className="mt-1 text-sm font-semibold text-[#777d8d]">
                  Premium Plan
                </p>
              </div>
            </div>

            <form className="mt-8 grid gap-5 sm:grid-cols-2">
              <div>
                <label
                  className="mb-2 block text-sm font-bold text-[#333747]"
                  htmlFor="name"
                >
                  Name
                </label>
                <input
                  className="h-12 w-full rounded-md border border-[#dfe2ec] bg-white px-4 text-base outline-none transition focus:border-[#4b46e8] focus:ring-4 focus:ring-[#4b46e8]/10"
                  defaultValue="Arjun Investor"
                  id="name"
                  type="text"
                />
              </div>
              <div>
                <label
                  className="mb-2 block text-sm font-bold text-[#333747]"
                  htmlFor="plan"
                >
                  Plan name
                </label>
                <input
                  className="h-12 w-full rounded-md border border-[#dfe2ec] bg-white px-4 text-base outline-none transition focus:border-[#4b46e8] focus:ring-4 focus:ring-[#4b46e8]/10"
                  defaultValue="Premium Plan"
                  id="plan"
                  type="text"
                />
              </div>
              <div className="sm:col-span-2">
                <label
                  className="mb-2 block text-sm font-bold text-[#333747]"
                  htmlFor="role"
                >
                  Role
                </label>
                <input
                  className="h-12 w-full rounded-md border border-[#dfe2ec] bg-white px-4 text-base outline-none transition focus:border-[#4b46e8] focus:ring-4 focus:ring-[#4b46e8]/10"
                  defaultValue="Portfolio Analyst"
                  id="role"
                  type="text"
                />
              </div>
              <div className="flex justify-end gap-3 sm:col-span-2">
                <Link
                  className="rounded-md border border-[#dfe2ec] px-5 py-3 text-sm font-black text-[#4c5261] transition hover:bg-[#f7f8fb]"
                  href="/dashboard"
                >
                  Cancel
                </Link>
                <button
                  className="rounded-md bg-[#4b46e8] px-5 py-3 text-sm font-black text-white transition hover:bg-[#3832c7]"
                  type="button"
                >
                  Save changes
                </button>
              </div>
            </form>
          </section>
        </div>
      </main>
    </AuthGuard>
  );
}
