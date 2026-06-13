"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function BackButton() {
  const pathname = usePathname();

  // Show back button only on menu detail pages, not on dashboard or main pages
  const showBackButton =
    pathname.startsWith("/menu/") && pathname !== "/menu";

  if (!showBackButton) {
    return null;
  }

  return (
    <Link
      className="mb-6 inline-flex h-10 items-center gap-2 rounded-md border border-[#d6dfd9] bg-white px-4 text-sm font-semibold text-[#166052] transition hover:bg-[#eef6f3]"
      href="/dashboard"
    >
      <span aria-hidden="true">&lt;</span>
      Back
    </Link>
  );
}
