"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Command,
  Github,
  Moon,
  RefreshCw,
  Sun,
} from "lucide-react";
import { useUpgradeSession } from "@/lib/hooks/useUpgradeSession";
import { useTheme } from "@/lib/hooks/useTheme";
import { Button, Kbd } from "./ui";
import { cn, formatRelativeTime } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-[7px] bg-accent text-accent-fg shadow-[var(--shadow-sm)]",
        className
      )}
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 20V5" />
        <path d="m6 11 6-6 6 6" />
      </svg>
    </span>
  );
}

export default function AppHeader({
  onOpenCommandPalette,
}: {
  onOpenCommandPalette: () => void;
}) {
  const { catalog, catalogLoading, refreshCatalog, fromVersion, toVersion } =
    useUpgradeSession();
  const { isDark, toggle } = useTheme();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const updatedAt = catalog?.updatedAt ?? 0;
  const age = updatedAt ? now - updatedAt : null;
  const isFresh = age !== null && age < 6 * 60 * 60 * 1000;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/85 backdrop-blur-md">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
        <Link href="/" prefetch={false} className="flex items-center gap-2.5">
          <Logo />
          <h1 className="text-[13.5px] font-semibold leading-4 text-fg">
            RN Safe Upgrade
          </h1>
          <p className="hidden text-[11px] leading-4 text-fg-subtle sm:block">
            React Native upgrade assistant
          </p>
        </Link>

        {fromVersion && toVersion ? (
          <div className="ml-2 hidden items-center gap-1.5 rounded-[7px] border border-border bg-surface-2 px-2 py-1 md:flex">
            <span className="font-mono text-[12px] text-fg-muted">
              {fromVersion}
            </span>
            <span className="text-fg-subtle">→</span>
            <span className="font-mono text-[12px] font-semibold text-fg">
              {toVersion}
            </span>
          </div>
        ) : null}

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => void refreshCatalog()}
            title={
              updatedAt
                ? `Release data updated ${formatRelativeTime(updatedAt)}`
                : "Release data"
            }
            className="hidden items-center gap-1.5 rounded-[7px] border border-border bg-surface px-2 py-1.5 text-[11.5px] text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg sm:inline-flex"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", catalogLoading && "animate-spin")}
              aria-hidden
            />
            <span className={cn(isFresh && "text-success")}>
              {catalogLoading
                ? "Syncing"
                : updatedAt
                  ? formatRelativeTime(updatedAt)
                  : "Offline data"}
            </span>
          </button>

          <Button
            size="sm"
            variant="ghost"
            onClick={onOpenCommandPalette}
            className="hidden sm:inline-flex"
            icon={<Command className="h-3.5 w-3.5" aria-hidden />}
          >
            <Kbd>⌘K</Kbd>
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={toggle}
            aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
            icon={
              isDark ? (
                <Sun className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <Moon className="h-3.5 w-3.5" aria-hidden />
              )
            }
          />

          <a
            href="https://github.com/heymeowcat/rn-safe-upgrade"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open the repository"
            className="flex h-7 w-7 items-center justify-center rounded-[6px] text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <Github className="h-4 w-4" aria-hidden />
          </a>
        </div>
      </div>
    </header>
  );
}
