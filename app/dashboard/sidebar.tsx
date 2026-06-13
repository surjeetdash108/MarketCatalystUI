"use client";

import Link from "next/link";
import { useAppSelector } from "../store/hooks";
import { menuItems } from "./menu-items";

function NavIcon({ label }: Readonly<{ label: string }>) {
  const paths: Record<string, React.ReactNode> = {
    Dashboard: (
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-9.5Z" />
    ),
    "What Matters Now": <path d="M13 2 4 14h7l-1 8 10-13h-7l1-7Z" />,
    "Earnings Hub": <path d="M4 5h16v14H4V5Zm4 4h8M8 13h5" />,
    "Market Movers": <path d="M4 17 9 12l4 4 7-9M15 7h5v5" />,
    "Analyst Actions": <path d="M5 19V5m0 14h14M8 15l3-4 3 2 4-6" />,
    "13F Intelligence": <path d="M6 4h9l3 3v13H6V4Zm8 0v4h4M9 12h6M9 16h6" />,
    "Portfolio Pulse": <path d="M4 7h16v11H4V7Zm4 11V7m8 11V7" />,
    "AI Copilot": (
      <path d="M12 3l2.2 5.2L20 10l-5.8 1.8L12 17l-2.2-5.2L4 10l5.8-1.8L12 3Z" />
    ),
    Alerts: (
      <path d="M6 17h12l-1.5-2v-4.5a4.5 4.5 0 0 0-9 0V15L6 17Zm4 3h4" />
    ),
    Watchlists: (
      <path d="m12 4 2.4 5 5.6.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.6-.8L12 4Z" />
    ),
    "Macro Calendar": <path d="M5 5h14v15H5V5Zm0 5h14M8 3v4m8-4v4" />,
    Reports: <path d="M6 4h12v16H6V4Zm3 5h6M9 13h6M9 17h4" />,
    "Dark Mode": <path d="M21 14.5A7.5 7.5 0 0 1 9.5 3 8.5 8.5 0 1 0 21 14.5Z" />,
    "Help & Support": (
      <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-6v.01M9.8 9a2.2 2.2 0 1 1 3.4 1.85c-.78.52-1.2.95-1.2 1.9" />
    ),
    Settings: (
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm0-12v2m0 13v2m8.5-8.5h-2m-13 0h-2m14.6-6.1-1.4 1.4M6.8 17.2l-1.4 1.4m0-12.7 1.4 1.4m10.4 10.4 1.4 1.4" />
    ),
  };

  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      {paths[label] ?? <path d="M5 12h14" />}
    </svg>
  );
}

interface SidebarProps {
  currentSlug?: string;
}

export function Sidebar({ currentSlug }: Readonly<SidebarProps>) {
  const { user } = useAppSelector((state) => state.auth);
  const { data: profile } = useAppSelector((state) => state.profile);

  const displayName = profile?.name ?? user?.displayName ?? user?.email ?? "User";
  const email = user?.email ?? "";
  const profileImage =
    profile?.profile_image || user?.photoURL || "/profile-avatar.svg";

  return (
    <aside className="sticky top-0 hidden h-screen w-72 shrink-0 overflow-hidden border-r border-[#dde5df] bg-white px-4 py-4 lg:flex lg:flex-col">
      <div className="mb-5 flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-md bg-[#1f5f50] text-base font-bold text-white shadow-sm shadow-emerald-100">
          26
        </div>
        <div>
          <p className="text-lg font-semibold leading-none">finapp26</p>
          <p className="mt-1 text-xs font-medium text-[#7b8090]">
            Investor Intelligence
          </p>
        </div>
      </div>

      <div className="relative mb-5 rounded-md border border-[#dde5df] bg-[#fbfcfb] p-4 text-center">
        <Link
          aria-label="Profile settings"
          className="absolute left-3 top-3 grid size-8 place-items-center rounded-md border border-[#d6dfd9] bg-white text-sm font-semibold text-[#166052] transition hover:bg-[#eef6f3]"
          href="/settings"
          title="Profile settings"
        >
          ⚙
        </Link>
        <Link
          aria-label="Edit profile"
          className="absolute right-3 top-3 grid size-8 place-items-center rounded-md border border-[#d6dfd9] bg-white text-sm font-semibold text-[#166052] transition hover:bg-[#eef6f3]"
          href="/profile/edit"
          title="Edit profile"
        >
          ✎
        </Link>
        <img
          alt={`${displayName} profile photo`}
          className="mx-auto size-[72px] rounded-full border-4 border-white object-cover shadow-sm shadow-emerald-100"
          src={profileImage}
        />
        <p className="mt-3 text-sm font-semibold">{displayName}</p>
        <p className="mt-1 text-xs font-semibold text-[#66756d]">{email}</p>
        <button className="mt-3 h-9 w-full rounded-md bg-[#e8f3ef] text-xs font-semibold text-[#166052]">
          Manage Plan
        </button>
      </div>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
        {menuItems.map(({ label, slug }) => {
          const isActive = currentSlug === slug;
          return (
            <a
              className={`flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium ${
                isActive
                  ? "bg-[#e8f3ef] text-[#1f5f50]"
                  : "text-[#22332b] hover:bg-[#eef3f0]"
              }`}
              href={slug === "dashboard" ? "/dashboard" : `/menu/${slug}`}
              key={slug}
            >
              <span
                className={`grid size-7 place-items-center rounded-md border ${
                  isActive
                    ? "border-[#1f5f50] bg-[#1f5f50] text-white"
                    : "border-[#cad6cf] text-[#66756d]"
                }`}
              >
                <NavIcon label={label} />
              </span>
              <span className="min-w-0 flex-1 truncate">{label}</span>
              {label === "AI Copilot" ? (
                <span className="rounded bg-[#166052] px-2 py-1 text-[10px] text-white">
                  NEW
                </span>
              ) : null}
            </a>
          );
        })}
      </nav>

      <div className="mt-4 shrink-0 space-y-1 border-t border-[#e5ebe7] pt-4">
        {["Dark Mode", "Help & Support", "Settings"].map((item) => (
          <a
            className="flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-[#33453c] hover:bg-[#eef3f0]"
            href={item === "Settings" ? "/settings" : "#"}
            key={item}
          >
            <span className="grid size-7 place-items-center rounded-md border border-[#cad6cf] text-[#66756d]">
              <NavIcon label={item} />
            </span>
            {item}
          </a>
        ))}
      </div>
    </aside>
  );
}
