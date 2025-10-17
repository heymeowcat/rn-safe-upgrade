import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "RN Safe Upgrade - React Native Dependency Upgrader",
  description:
    "Safely upgrade your React Native dependencies with compatibility checking. Analyze your package.json and get recommended versions that work together.",
  keywords: "React Native, upgrade, dependencies, compatibility, package.json",
  authors: [{ name: "Your Name" }],
  openGraph: {
    title: "RN Safe Upgrade",
    description: "Safely upgrade React Native dependencies",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
