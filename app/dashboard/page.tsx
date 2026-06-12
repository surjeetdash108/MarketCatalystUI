import Image from "next/image";
import Link from "next/link";
import { AuthGuard } from "./auth-guard";

const navItems = [
  ["Dashboard", "D"],
  ["What Matters Now", "W"],
  ["Earnings Hub", "E"],
  ["Market Movers", "M"],
  ["Analyst Actions", "A"],
  ["13F Intelligence", "13"],
  ["Portfolio Pulse", "P"],
  ["AI Copilot", "AI"],
  ["Alerts", "!"],
  ["Watchlists", "*"],
  ["Macro Calendar", "C"],
  ["Reports", "R"],
];

const indices = [
  { name: "S&P 500", value: "5,312.08", change: "+0.73%", good: true },
  { name: "NASDAQ", value: "16,973.17", change: "+1.02%", good: true },
  { name: "VIX", value: "14.18", change: "-2.51%", good: false },
];

const earnings = [
  ["NVDA", "NVIDIA", "After Market", "bg-lime-500"],
  ["AAPL", "Apple", "After Market", "bg-zinc-900"],
  ["CRM", "Salesforce", "After Market", "bg-sky-500"],
  ["DELL", "Dell Tech", "Before Market", "bg-cyan-600"],
  ["HD", "Home Depot", "Before Market", "bg-red-500"],
];

const movers = [
  ["1", "NVDA", "NVIDIA", "+8.23%", "bg-lime-500"],
  ["2", "PLTR", "Palantir", "+6.18%", "bg-zinc-800"],
  ["3", "AMD", "AMD", "+4.21%", "bg-emerald-600"],
  ["4", "TSLA", "Tesla", "+3.45%", "bg-red-500"],
  ["5", "AVGO", "Broadcom", "+2.97%", "bg-sky-500"],
];

const analystActions = [
  ["NVDA", "NVIDIA", "Morgan Stanley", "Upgrade", "text-emerald-600"],
  ["TSLA", "Tesla", "Goldman Sachs", "Upgrade", "text-emerald-600"],
  ["AMZN", "Amazon", "JP Morgan", "Downgrade", "text-rose-500"],
  ["META", "Meta Platforms", "Wells Fargo", "Upgrade", "text-emerald-600"],
  ["CRM", "Salesforce", "Citigroup", "Upgrade", "text-emerald-600"],
];

const storyStocks = [
  ["NVDA", "Earnings Beat", "AI demand strong", "text-emerald-600"],
  ["RDDT", "User growth surge", "+ analyst upgrades", "text-rose-500"],
  ["ZIM", "Shipping rates jump", "Red Sea impact", "text-indigo-600"],
];

const events = [
  ["May 16", "US Retail Sales (Apr)", "8:30 AM"],
  ["May 17", "FOMC Minutes", "2:00 PM"],
  ["May 20", "NVIDIA GTC Conference", "All Day"],
];

const watchlist = [
  ["NVDA", "1,181.75", "+8.23%", true],
  ["AAPL", "189.98", "+1.02%", true],
  ["MSFT", "415.32", "+0.86%", true],
  ["AMZN", "180.24", "+1.38%", true],
  ["TSLA", "171.40", "-0.45%", false],
];

const macro = [
  ["10Y Yield", "4.32%", "-0.04%", false],
  ["WTI Oil", "78.64", "-1.21%", false],
  ["Gold", "2344.10", "+0.31%", true],
  ["USD Index", "104.21", "+0.12%", true],
];

const pulseBars = [
  "h-9",
  "h-12",
  "h-10",
  "h-14",
  "h-16",
  "h-13",
  "h-15",
  "h-20",
  "h-14",
  "h-12",
  "h-18",
  "h-21",
  "h-13",
  "h-15",
  "h-24",
];

function Card({
  children,
  className = "",
}: Readonly<{ children: React.ReactNode; className?: string }>) {
  return (
    <section
      className={`rounded-md border border-[#dde5df] bg-white shadow-sm shadow-slate-200/40 ${className}`}
    >
      {children}
    </section>
  );
}

function CardHeader({
  title,
  action,
}: Readonly<{ title: string; action?: string }>) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[#e5ebe7] px-4 py-3">
      <h2 className="text-sm font-semibold uppercase tracking-[0.04em] text-[#17231d]">
        {title}
      </h2>
      {action ? (
        <a className="text-xs font-semibold text-[#166052]" href="#">
          {action} &gt;
        </a>
      ) : null}
    </div>
  );
}

function MiniSparkline({ positive = true }: Readonly<{ positive?: boolean }>) {
  return (
    <div className="flex h-8 w-24 items-end gap-1">
      {[12, 18, 14, 22, 19, 25, 31, 28, 36].map((height, index) => (
        <span
          className={`w-1.5 rounded-full ${
            positive ? "bg-emerald-400" : "bg-rose-400"
          }`}
          key={`${height}-${index}`}
          style={{ height }}
        />
      ))}
    </div>
  );
}

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
    "AI Copilot": <path d="M12 3l2.2 5.2L20 10l-5.8 1.8L12 17l-2.2-5.2L4 10l5.8-1.8L12 3Z" />,
    Alerts: <path d="M6 17h12l-1.5-2v-4.5a4.5 4.5 0 0 0-9 0V15L6 17Zm4 3h4" />,
    Watchlists: <path d="m12 4 2.4 5 5.6.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.6-.8L12 4Z" />,
    "Macro Calendar": <path d="M5 5h14v15H5V5Zm0 5h14M8 3v4m8-4v4" />,
    Reports: <path d="M6 4h12v16H6V4Zm3 5h6M9 13h6M9 17h4" />,
    "Dark Mode": <path d="M21 14.5A7.5 7.5 0 0 1 9.5 3 8.5 8.5 0 1 0 21 14.5Z" />,
    "Help & Support": <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-6v.01M9.8 9a2.2 2.2 0 1 1 3.4 1.85c-.78.52-1.2.95-1.2 1.9" />,
    Settings: <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm0-12v2m0 13v2m8.5-8.5h-2m-13 0h-2m14.6-6.1-1.4 1.4M6.8 17.2l-1.4 1.4m0-12.7 1.4 1.4m10.4 10.4 1.4 1.4" />,
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

export default function Home() {
  return (
    <AuthGuard>
      <main className="relative min-h-screen bg-[#f4f6f8] text-[#17231d]">
      <div className="mx-auto flex max-w-[1520px]">
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
            <Image
              alt="Arjun Investor profile photo"
              className="mx-auto rounded-full border-4 border-white shadow-sm shadow-emerald-100"
              height={72}
              src="/profile-avatar.svg"
              width={72}
            />
            <p className="mt-3 text-sm font-semibold">Arjun Investor</p>
            <p className="mt-1 text-xs font-semibold text-[#66756d]">
              Premium Plan
            </p>
            <button className="mt-3 h-9 w-full rounded-md bg-[#e8f3ef] text-xs font-semibold text-[#166052]">
              Manage Plan
            </button>
          </div>

          <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
            {navItems.map(([label], index) => (
              <a
                className={`flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium ${
                  index === 0
                    ? "bg-[#e8f3ef] text-[#1f5f50]"
                    : "text-[#22332b] hover:bg-[#eef3f0]"
                }`}
                href="#"
                key={label}
              >
                <span
                  className={`grid size-7 place-items-center rounded-md border ${
                    index === 0
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
            ))}
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

        <div className="min-w-0 flex-1 px-4 py-4 sm:px-6 lg:px-7">
          <header className="mb-5 flex flex-col gap-4 rounded-md border border-[#dde5df] bg-white px-4 py-3 shadow-sm shadow-slate-200/40 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-3 lg:hidden">
              <div className="grid size-10 place-items-center rounded-lg bg-[#1f5f50] font-black text-white">
                26
              </div>
              <div>
                <p className="font-bold">finapp26</p>
                <p className="text-xs text-[#66756d]">Investor Intelligence</p>
              </div>
            </div>
            <label className="flex h-11 w-full max-w-xl items-center gap-3 rounded-md border border-[#d6dfd9] bg-[#fbfcfb] px-4 text-sm text-[#7a8981]">
              <span className="text-lg leading-none">⌕</span>
              <input
                className="min-w-0 flex-1 bg-transparent outline-none"
                placeholder="Search stocks, ETFs, funds, topics..."
                type="search"
              />
            </label>
            <div className="flex flex-wrap items-center gap-5">
              {indices.map((index) => (
                <div key={index.name}>
                  <p className="text-xs font-bold uppercase text-[#66756d]">
                    {index.name}
                  </p>
                  <p className="mt-1 text-sm font-bold">
                    {index.value}{" "}
                    <span
                      className={
                        index.good ? "text-emerald-600" : "text-rose-500"
                      }
                    >
                      {index.change}
                    </span>
                  </p>
                </div>
              ))}
              <button className="grid size-10 place-items-center rounded-full border border-[#d6dfd9] text-xl">
                !
              </button>
              <div className="grid size-11 place-items-center rounded-full bg-[#e8f3ef] text-sm font-bold text-[#17463d]">
                AI
              </div>
            </div>
          </header>

          <Card className="mb-5 overflow-hidden">
            <CardHeader title="What Matters Now" action="View all stories" />
            <div className="grid gap-6 p-5 xl:grid-cols-[1.4fr_1.2fr_0.8fr]">
              <div className="flex items-center gap-6">
                <div className="grid size-24 shrink-0 place-items-center rounded-lg bg-[#82ca31] text-4xl font-black text-white">
                  N
                </div>
                <div>
                  <p className="text-2xl font-black">
                    NVIDIA <span className="text-sm">(NVDA)</span>
                  </p>
                  <p className="mt-2 text-6xl font-black text-emerald-600">
                    +8.23%
                  </p>
                  <p className="mt-1 text-xl font-semibold">
                    After Earnings Beat
                  </p>
                </div>
              </div>
              <div className="border-y border-[#e5ebe7] py-4 xl:border-x xl:border-y-0 xl:px-6 xl:py-0">
                <p className="text-xs font-black uppercase text-emerald-700">
                  Why it matters
                </p>
                <p className="mt-3 max-w-md text-sm font-medium leading-6 text-[#3c4251]">
                  Stronger AI demand drove data center revenue higher. Guidance
                  raised; management sees sustained momentum into 2025.
                </p>
                <button className="mt-5 rounded-md bg-[#e8f3ef] px-4 py-2 text-sm font-bold text-[#166052]">
                  Read 30-sec AI Summary &gt;
                </button>
              </div>
              <div>
                <p className="text-xs font-black uppercase text-emerald-700">
                  Peer Impact
                </p>
                <div className="mt-3 space-y-3 text-sm font-bold">
                  {["AMD +3.21%", "AVGO +2.42%", "MSFT +1.35%", "MU +1.98%"].map(
                    (peer) => (
                      <div className="flex justify-between" key={peer}>
                        <span>{peer.split(" ")[0]}</span>
                        <span className="text-emerald-600">
                          {peer.split(" ")[1]}
                        </span>
                      </div>
                    ),
                  )}
                </div>
                <a className="mt-6 block text-sm font-bold text-[#166052]" href="#">
                  See full impact &gt;
                </a>
              </div>
            </div>
            <div className="grid gap-3 border-t border-[#e5ebe7] p-4 md:grid-cols-3">
              {[
                "EPS beat by 18% ($0.81 vs $0.69 est.)",
                "Revenue beat by 15% ($26.08 vs $22.68 est.)",
                "Raised FY25 guidance for Data Center growth",
              ].map((item) => (
                <div
                  className="rounded-md border border-[#e5ebe7] bg-[#fcfcfe] p-3 text-sm font-semibold"
                  key={item}
                >
                  <span className="mr-2 inline-grid size-5 place-items-center rounded-full bg-emerald-600 text-xs text-white">
                    ✓
                  </span>
                  {item}
                </div>
              ))}
            </div>
          </Card>

          <div className="grid gap-5 xl:grid-cols-[1.15fr_1fr_0.95fr]">
            <Card>
              <CardHeader title="Earnings Calendar" action="View all" />
              <div className="px-4 py-3">
                <div className="mb-3 flex gap-6 text-xs font-bold">
                  <span className="border-b-2 border-[#166052] pb-2 text-[#166052]">
                    Today (Thu, May 16)
                  </span>
                  <span>Tomorrow</span>
                  <span>This Week</span>
                </div>
                <div className="space-y-3">
                  {earnings.map(([symbol, name, time, color]) => (
                    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 text-sm" key={symbol}>
                      <span className={`grid size-6 place-items-center rounded ${color} text-[10px] font-bold text-white`}>
                        {symbol.charAt(0)}
                      </span>
                      <div>
                        <span className="font-black">{symbol}</span>
                        <span className="ml-3 text-xs text-[#52645b]">{name}</span>
                      </div>
                      <span className="text-xs font-semibold text-[#555d6e]">
                        {time}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader title="Top Market Movers" action="View all" />
              <div className="px-4 py-3">
                <div className="mb-3 flex gap-2 text-xs font-bold">
                  {["Gainers", "Losers", "High Volume"].map((tab, index) => (
                    <span
                      className={`rounded-md px-3 py-2 ${
                        index === 0
                          ? "bg-[#e8f3ef] text-[#166052]"
                          : "bg-[#f4f6f8] text-[#4c5261]"
                      }`}
                      key={tab}
                    >
                      {tab}
                    </span>
                  ))}
                </div>
                <div className="space-y-3">
                  {movers.map(([rank, symbol, name, change, color]) => (
                    <div className="grid grid-cols-[1.5rem_auto_1fr_auto] items-center gap-3 text-sm" key={symbol}>
                      <span className="text-[#8a909f]">{rank}</span>
                      <span className={`grid size-6 place-items-center rounded ${color} text-[10px] font-bold text-white`}>
                        {symbol.charAt(0)}
                      </span>
                      <div>
                        <span className="font-black">{symbol}</span>
                        <span className="ml-3 text-xs text-[#52645b]">{name}</span>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-600">
                        {change}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader title="Analyst Actions" action="View all" />
              <div className="space-y-4 px-4 py-5">
                {analystActions.map(([symbol, name, firm, action, tone]) => (
                  <div className="grid grid-cols-[3rem_1fr_1fr_auto] gap-2 text-xs" key={`${symbol}-${firm}`}>
                    <span className="font-black">{symbol}</span>
                    <span>{name}</span>
                    <span>{firm}</span>
                    <span className={`font-bold ${tone}`}>{action}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="xl:col-span-1">
              <CardHeader title="Portfolio Pulse" action="View Portfolio" />
              <div className="p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-[#66756d]">Total Value</p>
                    <p className="mt-1 text-2xl font-black">$128,430</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#66756d]">Day Change</p>
                    <p className="mt-1 text-xl font-black text-emerald-600">
                      +1.42% <span className="text-sm">($1,798)</span>
                    </p>
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-4 gap-3 text-xs">
                  {["Holdings 12", "Earnings 3", "Alerts 5", "Risk 2"].map(
                    (stat) => (
                      <div key={stat}>
                        <p className="text-[#66756d]">{stat.split(" ")[0]}</p>
                        <p className="mt-1 font-black">{stat.split(" ")[1]}</p>
                      </div>
                    ),
                  )}
                </div>
                <div className="mt-5 flex h-28 items-end gap-1">
                  {pulseBars.map((height, index) => (
                    <span
                      className={`${height} flex-1 rounded-t bg-[#5b55df]`}
                      key={`${height}-${index}`}
                    />
                  ))}
                </div>
                <div className="mt-4 flex gap-4 text-xs font-bold text-[#555d6e]">
                  <span className="rounded bg-[#1f5f50] px-3 py-1.5 text-white">
                    1D
                  </span>
                  <span>1W</span>
                  <span>1M</span>
                  <span>3M</span>
                  <span>YTD</span>
                  <span>1Y</span>
                  <span>ALL</span>
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader title="Daily Market Recap" action="Read full recap" />
              <div className="space-y-3 p-4 text-sm font-medium leading-6">
                {[
                  "Markets rallied on cooler inflation data and strong earnings.",
                  "NVDA surged after blowout quarter; tech led the gains.",
                  "10Y yield eased to 4.32%.",
                  "Oil fell on rising inventory.",
                  "VIX declined to 14.18.",
                ].map((item) => (
                  <p className="flex gap-3" key={item}>
                    <span className="mt-1 grid size-5 shrink-0 place-items-center rounded-full bg-[#e8f3ef] text-[10px] font-black text-[#166052]">
                      i
                    </span>
                    {item}
                  </p>
                ))}
                <p className="pt-2 text-xs font-semibold text-[#66756d]">
                  AI-generated summary • 9:15 AM ET
                </p>
              </div>
            </Card>

            <Card>
              <CardHeader title="Fear & Greed Index" action="View history" />
              <div className="grid place-items-center px-6 pb-7 pt-5 text-center">
                <div className="relative h-24 w-56 overflow-hidden">
                  <div className="absolute inset-0 rounded-t-full bg-[conic-gradient(from_270deg_at_50%_100%,#ef4444_0deg,#f59e0b_60deg,#facc15_95deg,#22c55e_150deg,#22c55e_180deg,transparent_180deg)]" />
                  <div className="absolute bottom-0 left-1/2 h-20 w-48 -translate-x-1/2 rounded-t-full bg-white" />
                  <div className="absolute bottom-2 left-1/2 h-16 w-1 origin-bottom rotate-[28deg] rounded-full bg-[#17231d]" />
                  <div className="absolute bottom-0 left-1/2 size-5 -translate-x-1/2 rounded-full bg-[#17231d]" />
                </div>
                <p className="mt-1 text-5xl font-semibold leading-none">62</p>
                <p className="mt-2 text-lg font-semibold leading-6 text-emerald-600">Greed</p>
                <p className="mt-2 text-xs text-[#66756d]">Previous Close: 58</p>
              </div>
            </Card>

            <Card className="xl:col-span-1">
              <CardHeader title="Story Stocks" action="View all" />
              <div className="grid gap-3 p-4 sm:grid-cols-3">
                {storyStocks.map(([symbol, headline, detail, tone]) => (
                  <div className="rounded-md border border-[#e5ebe7] bg-[#fbfcfb] p-3" key={symbol}>
                    <p className={`text-lg font-black ${tone}`}>{symbol}</p>
                    <p className="mt-2 text-xs font-semibold">{headline}</p>
                    <p className="mt-2 text-xs text-[#606778]">{detail}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <CardHeader title="Upcoming Events" action="View calendar" />
              <div className="space-y-4 p-4">
                {events.map(([date, event, time]) => (
                  <div className="grid grid-cols-[4.5rem_1fr_auto] gap-3 text-sm" key={event}>
                    <span className="font-bold">{date}</span>
                    <span className="font-semibold">{event}</span>
                    <span className="text-[#6f7685]">{time}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <CardHeader title="Watchlist" action="Manage" />
              <div className="space-y-3 p-4">
                {watchlist.map(([symbol, value, change, positive]) => (
                  <div
                    className="grid grid-cols-[3.5rem_1fr_auto_auto] items-center gap-3 text-sm"
                    key={String(symbol)}
                  >
                    <span className="font-black">{symbol}</span>
                    <MiniSparkline positive={Boolean(positive)} />
                    <span className="font-semibold">{value}</span>
                    <span
                      className={`font-bold ${
                        positive ? "text-emerald-600" : "text-rose-500"
                      }`}
                    >
                      {change}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="xl:col-span-2">
              <CardHeader title="AI Copilot" />
              <div className="p-4">
                <p className="text-sm text-[#626979]">
                  Ask anything about markets, your portfolio, earnings, 13F
                  filings...
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  {[
                    "What's driving NVDA today?",
                    "Summarize today's earnings",
                    "Analyze my portfolio risk",
                  ].map((prompt) => (
                    <button
                      className="rounded-md bg-[#eef6f3] px-4 py-2 text-sm font-semibold text-[#166052]"
                      key={prompt}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
                <label className="mt-5 flex h-12 items-center gap-3 rounded-lg border border-[#d6dfd9] bg-white px-4">
                  <input
                    className="min-w-0 flex-1 text-sm outline-none"
                    placeholder="Ask your question..."
                    type="text"
                  />
                  <button className="grid size-9 place-items-center rounded-full bg-[#1f5f50] text-sm font-black text-white">
                    &gt;
                  </button>
                </label>
              </div>
            </Card>

            <Card>
              <CardHeader title="Macro Snapshot" />
              <div className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-4">
                {macro.map(([label, value, change, positive]) => (
                  <div
                    className="min-w-0 rounded-md border border-[#e5ebe7] bg-[#fbfcfb] p-3"
                    key={String(label)}
                  >
                    <p className="truncate text-[11px] font-semibold text-[#505767]">{label}</p>
                    <p className="mt-3 truncate text-base font-semibold leading-none">{value}</p>
                    <p
                      className={`mt-2 text-sm font-bold ${
                        positive ? "text-emerald-600" : "text-rose-500"
                      }`}
                    >
                      {change}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
      </main>
    </AuthGuard>
  );
}
