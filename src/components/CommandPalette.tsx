"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Copy,
  FileText,
  Files,
  LayoutList,
  Link2,
  Package,
  RefreshCw,
  Search,
  Sun,
  Moon,
} from "lucide-react";
import { useUpgradeSession } from "@/lib/hooks/useUpgradeSession";
import { useTheme } from "@/lib/hooks/useTheme";
import { planToMarkdown } from "@/lib/upgrade/plan";
import { filesToPatch } from "@/lib/diff/patch";
import { Kbd } from "./ui";
import { cn } from "@/lib/utils";

interface Command {
  id: string;
  label: string;
  hint?: string;
  group: string;
  icon?: React.ReactNode;
  run: () => void;
}

export default function CommandPalette({
  open,
  onOpen,
  onClose,
}: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const session = useUpgradeSession();
  const { isDark, toggle } = useTheme();

  const copy = useCallback((text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (open) onClose();
        else onOpen();
        return;
      }
      if (event.key === "Escape" && open) onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpen, onClose]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    const timer = setTimeout(() => inputRef.current?.focus(), 20);
    return () => clearTimeout(timer);
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const {
      setActiveTab,
      plan,
      brief,
      analysis,
      diffFiles,
      refreshCatalog,
      latestStable,
      setToVersion,
      fromVersion,
      toVersion,
      appName,
      appPackage,
    } = session;

    const list: Command[] = [
      {
        id: "tab-brief",
        label: "Go to the upgrade brief",
        group: "Navigate",
        icon: <FileText className="h-3.5 w-3.5" aria-hidden />,
        run: () => setActiveTab("brief"),
      },
      {
        id: "tab-deps",
        label: "Go to dependency compatibility",
        group: "Navigate",
        icon: <Package className="h-3.5 w-3.5" aria-hidden />,
        run: () => setActiveTab("dependencies"),
      },
      {
        id: "tab-changes",
        label: "Go to file changes",
        group: "Navigate",
        icon: <Files className="h-3.5 w-3.5" aria-hidden />,
        run: () => setActiveTab("changes"),
      },
      {
        id: "tab-agent",
        label: "Go to the agent bridge",
        group: "Navigate",
        icon: <Bot className="h-3.5 w-3.5" aria-hidden />,
        run: () => setActiveTab("agent"),
      },
    ];

    if (plan) {
      list.push({
        id: "copy-plan",
        label: "Copy the upgrade plan as Markdown",
        group: "Copy",
        icon: <Copy className="h-3.5 w-3.5" aria-hidden />,
        run: () => copy(planToMarkdown(plan, brief)),
      });
    }

    const updates = analysis.filter((item) => item.needsUpdate);
    if (updates.length) {
      list.push({
        id: "copy-install",
        label: `Copy the install command for ${updates.length} packages`,
        group: "Copy",
        icon: <Copy className="h-3.5 w-3.5" aria-hidden />,
        run: () =>
          copy(
            `npm install ${updates
              .map((item) => `${item.package}@${item.recommendedVersion}`)
              .join(" ")}`
          ),
      });
    }

    if (diffFiles.length) {
      list.push({
        id: "copy-patch",
        label: "Copy the full template patch",
        group: "Copy",
        icon: <Copy className="h-3.5 w-3.5" aria-hidden />,
        run: () => copy(filesToPatch(diffFiles)),
      });
    }

    if (latestStable) {
      list.push({
        id: "latest",
        label: `Target the latest release (${latestStable})`,
        group: "Versions",
        run: () => setToVersion(latestStable),
      });
    }

    // A link to the current view, so an answer can be shared with a team.
    list.push({
      id: "share",
      label: "Copy a link to this upgrade",
      group: "Share",
      icon: <Link2 className="h-3.5 w-3.5" aria-hidden />,
      run: () => {
        if (typeof window === "undefined") return;
        const url = new URL(window.location.href);
        url.search = "";
        url.hash = "";
        if (fromVersion) url.searchParams.set("from", fromVersion);
        if (toVersion) url.searchParams.set("to", toVersion);
        if (appName) url.searchParams.set("name", appName);
        if (appPackage) url.searchParams.set("package", appPackage);
        copy(url.toString());
      },
    });

    list.push({
      id: "refresh",
      label: "Refresh the release data",
      group: "Data",
      icon: <RefreshCw className="h-3.5 w-3.5" aria-hidden />,
      run: () => {
        void refreshCatalog();
      },
    });

    list.push({
      id: "theme",
      label: isDark ? "Switch to the light theme" : "Switch to the dark theme",
      group: "Preferences",
      icon: isDark ? (
        <Sun className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <Moon className="h-3.5 w-3.5" aria-hidden />
      ),
      run: toggle,
    });

    return list;
  }, [session, copy, isDark, toggle]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return commands;
    return commands.filter(
      (command) =>
        command.label.toLowerCase().includes(term) ||
        command.group.toLowerCase().includes(term)
    );
  }, [commands, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  if (!open) return null;

  const grouped = filtered.reduce<Record<string, Command[]>>((accumulator, command) => {
    accumulator[command.group] = accumulator[command.group] ?? [];
    accumulator[command.group].push(command);
    return accumulator;
  }, {});

  let index = -1;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <button
        type="button"
        aria-label="Close command palette"
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg overflow-hidden rounded-[12px] border border-border bg-surface shadow-[var(--shadow-lg)]">
        <div className="flex items-center gap-2.5 border-b border-border px-4 transition-colors duration-150 focus-within:border-accent-border">
          <Search className="h-4 w-4 shrink-0 text-fg-subtle" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((current) =>
                  Math.min(current + 1, filtered.length - 1)
                );
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((current) => Math.max(current - 1, 0));
              } else if (event.key === "Enter") {
                event.preventDefault();
                const command = filtered[activeIndex];
                if (command) {
                  command.run();
                  onClose();
                }
              } else if (event.key === "Escape") {
                onClose();
              }
            }}
            placeholder="Search commands…"
            className="h-12 w-full bg-transparent text-[13.5px] text-fg outline-none placeholder:text-fg-subtle"
            aria-label="Search commands"
          />
          <Kbd>Esc</Kbd>
        </div>

        <ul ref={listRef} className="max-h-[52vh] overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <li className="px-3 py-8 text-center text-[12.5px] text-fg-subtle">
              Nothing matches “{query}”.
            </li>
          ) : (
            Object.entries(grouped).map(([group, groupCommands]) => (
              <li key={group}>
                <p className="px-2.5 pb-1 pt-2.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-fg-subtle">
                  {group}
                </p>
                <ul>
                  {groupCommands.map((command) => {
                    index += 1;
                    const currentIndex = index;
                    const active = currentIndex === activeIndex;
                    return (
                      <li key={command.id}>
                        <button
                          type="button"
                          data-index={currentIndex}
                          onMouseEnter={() => setActiveIndex(currentIndex)}
                          onClick={() => {
                            command.run();
                            onClose();
                          }}
                          className={cn(
                            "flex w-full items-center gap-2.5 rounded-[7px] px-2.5 py-2 text-left text-[13px] transition-colors duration-100",
                            active ? "bg-surface-3 text-fg" : "text-fg-muted"
                          )}
                        >
                          <span className="text-fg-subtle">{command.icon}</span>
                          <span className="min-w-0 flex-1 truncate">
                            {command.label}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))
          )}
        </ul>

        <div className="flex items-center gap-3 border-t border-border px-4 py-2 text-[11px] text-fg-subtle">
          <span className="flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> navigate
          </span>
          <span className="flex items-center gap-1">
            <Kbd className="mac-only">↵</Kbd>
            <Kbd className="other-only">Enter</Kbd> select
          </span>
          <span className="ml-auto flex items-center gap-1">
            <LayoutList className="h-3 w-3" aria-hidden />
            {commands.length} commands
          </span>
        </div>
      </div>
    </div>
  );
}
