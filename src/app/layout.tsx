import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "react-diff-view/style/index.css";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-jet",
  display: "swap",
});

const SITE_URL = "https://heymeowcat.is-a.dev/rn-safe-upgrade";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "RN Safe Upgrade — React Native upgrade assistant",
    template: "%s · RN Safe Upgrade",
  },
  description:
    "Upgrade React Native with an auto-generated brief, dependency compatibility checks, the full template diff, and a local agent bridge that applies the upgrade inside your project.",
  applicationName: "RN Safe Upgrade",
  keywords: [
    "React Native",
    "upgrade",
    "upgrade helper",
    "dependency compatibility",
    "codemod",
    "react-native diff",
    "agent bridge",
  ],
  authors: [{ name: "Vidura Fernando", url: "https://github.com/heymeowcat" }],
  creator: "Vidura Fernando",
  publisher: "Vidura Fernando",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "RN Safe Upgrade",
    title: "RN Safe Upgrade — React Native upgrade assistant",
    description:
      "An auto-updating brief, dependency checks, the template diff, and a local agent bridge that performs the upgrade for you.",
  },
  twitter: {
    card: "summary_large_image",
    title: "RN Safe Upgrade — React Native upgrade assistant",
    description:
      "An auto-updating brief, dependency checks, the template diff, and a local agent bridge that performs the upgrade for you.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  category: "technology",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbfc" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0c10" },
  ],
  width: "device-width",
  initialScale: 1,
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
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
