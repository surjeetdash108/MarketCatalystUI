import Link from "next/link";
import { ReactNode } from "react";

interface AuthLayoutProps {
  children: ReactNode;
  wide?: boolean;
}

export function AuthLayout({ children, wide = false }: Readonly<AuthLayoutProps>) {
  return (
    <div className="min-h-screen bg-[#f4f6f8] text-[#17231d]">
      <div className="grid min-h-screen lg:grid-cols-[0.95fr_1.05fr]">
        <section className="flex items-center justify-center px-5 py-10 sm:px-8">
          <div className={`w-full ${wide ? "max-w-4xl" : "max-w-md"}`}>
            <Link className="mb-9 flex w-fit items-center gap-3" href="/">
              <span className="grid size-10 place-items-center rounded-md bg-[#1f5f50] text-base font-bold text-white shadow-sm shadow-emerald-100">
                26
              </span>
              <span>
                <span className="block text-xl font-semibold leading-none">
                  finapp26
                </span>
                <span className="mt-1 block text-xs font-semibold text-[#737989]">
                  Investor Intelligence
                </span>
              </span>
            </Link>
            {children}
          </div>
        </section>

        <aside className="hidden bg-[#17231d] px-12 py-12 text-white lg:flex lg:items-center">
          <div className="w-full">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#a7d8c6]">
              Market command center
            </p>
            <h2 className="mt-4 max-w-xl text-5xl font-semibold leading-tight">
              Authenticated intelligence for faster portfolio decisions.
            </h2>
            <div className="mt-10 grid gap-4 xl:grid-cols-3">
              {[
                ["Live Signals", "128", "+14 today"],
                ["Portfolio Risk", "Low", "2 alerts"],
                ["AI Recaps", "9:15", "AM ET"],
              ].map(([label, value, detail]) => (
                <div
                  className="rounded-md border border-white/10 bg-white/[0.06] p-5"
                  key={label}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#b8c7bf]">
                    {label}
                  </p>
                  <p className="mt-4 text-3xl font-semibold">{value}</p>
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
