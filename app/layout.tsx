import type { Metadata } from "next";
import {
  Geist, Space_Grotesk, JetBrains_Mono, Inter, DM_Sans, Plus_Jakarta_Sans,
  IBM_Plex_Sans, Outfit, Manrope, Source_Sans_3,
  // Second batch of body-font choices offered in Settings → Font.
  Figtree, Public_Sans, Sora, Lexend, Urbanist, Work_Sans, Archivo, Rubik, Nunito_Sans,
} from "next/font/google";
import { FirebaseAnalytics } from "./firebase-analytics";
import { SentryInit } from "./sentry-init";
import { ReduxProvider } from "./store/redux-provider";
import "./globals.css";
import "./iq.css";
import "./landing.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Body half of the Inter + Source Sans pairing (see the "inter-source" entry
// in settings). Loaded here so next/font self-hosts it — no runtime request to
// fonts.googleapis.com, unlike the site this pairing was taken from.
const sourceSans3 = Source_Sans_3({
  variable: "--font-source-sans-3",
  subsets: ["latin"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
});

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-ibm-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

// ---- Additional body fonts (Settings → Font) ----
// All nine are variable Google faces, so no explicit `weight` list is needed —
// next/font self-hosts one variable file each and the CSS variable below is
// what `.iq-root[data-font="…"]` in iq.css switches --f-body to.
const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin"],
});

const urbanist = Urbanist({
  variable: "--font-urbanist",
  subsets: ["latin"],
});

const workSans = Work_Sans({
  variable: "--font-work-sans",
  subsets: ["latin"],
});

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
});

const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["latin"],
});

const nunitoSans = Nunito_Sans({
  variable: "--font-nunito-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://marketcatalyst.ai"),
  title: "MarketCatalyst — Market Intelligence Terminal",
  description: "From ticker to thesis in under 60 seconds. Earnings, movers, analyst actions, insider flows and your portfolio — all in one terminal.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "https://marketcatalyst.ai",
    siteName: "MarketCatalyst",
    title: "MarketCatalyst — Market Intelligence Terminal",
    description: "From ticker to thesis in under 60 seconds. Earnings, movers, analyst actions, insider flows and your portfolio — all in one terminal.",
  },
  twitter: {
    card: "summary_large_image",
    title: "MarketCatalyst — Market Intelligence Terminal",
    description: "From ticker to thesis in under 60 seconds. Earnings, movers, analyst actions, insider flows and your portfolio — all in one terminal.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={[
        geistSans.variable, spaceGrotesk.variable, jetbrainsMono.variable,
        inter.variable, dmSans.variable, plusJakartaSans.variable,
        ibmPlexSans.variable, outfit.variable, manrope.variable, sourceSans3.variable,
        figtree.variable, publicSans.variable, sora.variable, lexend.variable,
        urbanist.variable, workSans.variable, archivo.variable, rubik.variable,
        nunitoSans.variable,
        "h-full antialiased",
      ].join(" ")}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <FirebaseAnalytics />
        <SentryInit />
        <ReduxProvider>{children}</ReduxProvider>
      </body>
    </html>
  );
}
