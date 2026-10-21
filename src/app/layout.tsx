import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "react-diff-view/style/index.css";
import "./globals.css";
import { APP_URL, REPO_URL, SITE_URL, buildSchema } from "@/lib/schema";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  preload: true,
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-jet",
  display: "swap",
  preload: true,
});

const TITLE = "RN Safe Upgrade — React Native upgrade assistant";
const DESCRIPTION =
  "Generate the upgrade brief for any React Native version pair, check the compatibility of every dependency and let a local agent apply the upgrade inside your project.";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: TITLE,
    template: "%s · RN Safe Upgrade",
  },
  description: DESCRIPTION,
  applicationName: "RN Safe Upgrade",
  keywords: [
    "React Native",
    "upgrade",
    "upgrade helper",
    "react native upgrade helper",
    "dependency compatibility",
    "react native breaking changes",
    "codemod",
    "react native diff",
    "agent bridge",
    "react native changelog",
  ],
  authors: [{ name: "Vidura Fernando", url: "https://github.com/heymeowcat" }],
  creator: "Vidura Fernando",
  publisher: "Vidura Fernando",
  category: "technology",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: APP_URL,
    siteName: "RN Safe Upgrade",
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_US",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "RN Safe Upgrade - the React Native upgrade assistant",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/rn-safe-upgrade/icon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/rn-safe-upgrade/apple-icon.png", sizes: "180x180" }],
  },
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  other: {
    "content-security-policy": "upgrade-insecure-requests",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbfc" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0c10" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
};

const themeScript = `
(function () {
  try {
    var stored = localStorage.getItem("rnsa:theme");
    var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var dark = stored === "dark" || ((!stored || stored === "system") && prefersDark);
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  } catch (e) {}

  // The shortcut hints follow the platform, decided before the first paint.
  try {
    var platform =
      (navigator.userAgentData && navigator.userAgentData.platform) ||
      navigator.platform ||
      "";
    var isMac = /mac|iphone|ipad|ipod/i.test(platform);
    document.documentElement.dataset.platform = isMac ? "mac" : "other";
  } catch (e) {
    document.documentElement.dataset.platform = "other";
  }
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {/* The release data is fetched from these hosts on the first visit. */}
        <link rel="preconnect" href="https://registry.npmjs.org" crossOrigin="" />
        <link rel="preconnect" href="https://api.github.com" crossOrigin="" />
        <link
          rel="dns-prefetch"
          href="https://raw.githubusercontent.com"
          crossOrigin=""
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildSchema()) }}
        />
      </head>
      <body>
        {children}
        <a
          href={REPO_URL}
          className="sr-only"
          rel="noopener noreferrer"
          target="_blank"
        >
          Source on GitHub
        </a>
        <a href={SITE_URL} className="sr-only">
          Vidura Fernando
        </a>
      </body>
    </html>
  );
}
