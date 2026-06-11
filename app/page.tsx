const signals = [
  { label: "Revenue risk", value: "12.8%", tone: "text-emerald-600" },
  { label: "Market drift", value: "-3.4%", tone: "text-rose-500" },
  { label: "Cash outlook", value: "91", tone: "text-sky-600" },
];

const bars = ["h-12", "h-20", "h-16", "h-28", "h-24", "h-32", "h-20"];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f6f7f2] text-[#18211c]">
      <section className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <div className="flex items-center justify-center px-6 py-12 sm:px-10 lg:px-16">
          <div className="w-full max-w-md">
            <div className="mb-10 flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-lg bg-[#1f4f3b] text-lg font-semibold text-white">
                  26
              </div>
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-[#5b6b62]">
                  finapp26
                </p>
                <h1 className="text-2xl font-semibold text-[#15251c]">
                  Financial intelligence login
                </h1>
              </div>
            </div>

            <form className="space-y-5 rounded-lg border border-[#d8ddd4] bg-white p-6 shadow-[0_24px_80px_rgba(31,44,37,0.09)]">
              <div>
                <label
                  className="mb-2 block text-sm font-medium text-[#2e3b33]"
                  htmlFor="email"
                >
                  Work email
                </label>
                <input
                  className="h-12 w-full rounded-md border border-[#cfd7d1] bg-white px-4 text-base outline-none transition focus:border-[#1f4f3b] focus:ring-4 focus:ring-[#1f4f3b]/10"
                  id="email"
                  name="email"
                  placeholder="analyst@company.com"
                  type="email"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-4">
                  <label
                    className="block text-sm font-medium text-[#2e3b33]"
                    htmlFor="password"
                  >
                    Password
                  </label>
                  <a className="text-sm font-medium text-[#2b6a80]" href="#">
                    Reset password
                  </a>
                </div>
                <input
                  className="h-12 w-full rounded-md border border-[#cfd7d1] bg-white px-4 text-base outline-none transition focus:border-[#1f4f3b] focus:ring-4 focus:ring-[#1f4f3b]/10"
                  id="password"
                  name="password"
                  placeholder="Enter password"
                  type="password"
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <label className="flex items-center gap-3 text-sm text-[#46534c]">
                  <input
                    className="size-4 rounded border-[#b8c2ba] accent-[#1f4f3b]"
                    type="checkbox"
                  />
                  Keep me signed in
                </label>
                <span className="rounded-full bg-[#edf6f3] px-3 py-1 text-xs font-medium text-[#1f4f3b]">
                  SSO ready
                </span>
              </div>

              <button
                className="h-12 w-full rounded-md bg-[#1f4f3b] px-5 text-base font-semibold text-white transition hover:bg-[#173d2d] focus:outline-none focus:ring-4 focus:ring-[#1f4f3b]/20"
                type="submit"
              >
                Sign in
              </button>

              <p className="text-center text-sm text-[#657269]">
                New analyst?{" "}
                <a className="font-semibold text-[#2b6a80]" href="#">
                  Request access
                </a>
              </p>
            </form>
          </div>
        </div>

        <aside className="hidden overflow-hidden bg-[#17201b] p-10 text-white lg:flex lg:items-center">
          <div className="w-full">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-[#a9c5b7]">
                  Intelligence brief
                </p>
                <h2 className="mt-2 text-3xl font-semibold">
                  Live financial signal desk
                </h2>
              </div>
              <div className="rounded-full border border-white/15 px-4 py-2 text-sm text-[#dce9e2]">
                08:45 UTC
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/[0.06] p-6 shadow-2xl">
              <div className="mb-6 grid grid-cols-3 gap-3">
                {signals.map((signal) => (
                  <div
                    className="rounded-md bg-white p-4 text-[#18211c]"
                    key={signal.label}
                  >
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#6a766f]">
                      {signal.label}
                    </p>
                    <p className={`mt-3 text-2xl font-semibold ${signal.tone}`}>
                      {signal.value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="rounded-md bg-[#eef2ea] p-5 text-[#18211c]">
                <div className="mb-5 flex items-center justify-between">
                  <p className="font-semibold">Liquidity pulse</p>
                  <p className="text-sm text-[#5f6e65]">Q2 forecast</p>
                </div>
                <div className="flex h-40 items-end gap-3">
                  {bars.map((height, index) => (
                    <div
                      className={`${height} flex-1 rounded-t-md ${
                        index === 5 ? "bg-[#1f4f3b]" : "bg-[#8fb2a0]"
                      }`}
                      key={`${height}-${index}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
