"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftRight,
  Check,
  ChevronDown,
  Search,
  Sparkles,
} from "lucide-react";
import { useUpgradeSession } from "@/lib/hooks/useUpgradeSession";
import { semverCompare, type RnVersionInfo } from "@/lib/data/rnCatalog";
import { cn, formatDate, formatRelativeTime } from "@/lib/utils";
import { Badge, Button, Kbd } from "./ui";

interface VersionComboboxProps {
  value: string;
  options: RnVersionInfo[];
  onChange: (version: string) => void;
  label: string;
  align?: "left" | "right";
  exclude?: string;
}

function VersionCombobox({
  value,
  options,
  onChange,
  label,
  align = "left",
  exclude,
}: VersionComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const base = term
      ? options.filter(
          (option) =>
            option.version.includes(term) ||
            option.blogHeadline?.toLowerCase().includes(term)
        )
      : options;

    // Group by minor line so "0.88.x" stays together.
    const groups = new Map<string, RnVersionInfo[]>();
    for (const option of base) {
      const key = option.version.split(".").slice(0, 2).join(".");
      const list = groups.get(key) ?? [];
      list.push(option);
      groups.set(key, list);
    }
    return Array.from(groups.values()).flat();
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const element = listRef.current?.querySelector<HTMLElement>(
      `[data-index="${activeIndex}"]`
    );
    element?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  // The filter is focused when the list opens, so the keyboard works right
  // away without stealing the focus on the page.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const selected = options.find((option) => option.version === value);

  const commit = (version: string) => {
    if (version === exclude) return;
    onChange(version);
    setOpen(false);
    setQuery("");
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!open) {
      if (event.key === "Enter" || event.key === "ArrowDown" || event.key === " ") {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, filtered.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (activeIndex >= 0 && filtered[activeIndex]) {
        commit(filtered[activeIndex].version);
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      setQuery("");
    }
  };

  return (
    <div className="relative min-w-0" ref={containerRef}>
      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.05em] text-fg-subtle">
        {label}
      </span>

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-[8px] border border-border bg-surface px-3 text-left transition-colors duration-150",
          "hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent",
          open && "border-accent-border ring-2 ring-accent/20"
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate font-mono text-[13.5px] font-medium text-fg">
            {value || "Select version"}
          </span>
          {selected?.releasedAt ? (
            <span className="hidden truncate text-[11.5px] text-fg-subtle sm:inline">
              {formatRelativeTime(selected.releasedAt)}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-fg-subtle transition-transform duration-150",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          className={cn(
            "absolute z-50 mt-1.5 w-[min(24rem,calc(100vw-3rem))] overflow-hidden rounded-[10px] border border-border bg-surface shadow-[var(--shadow-lg)]",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="h-3.5 w-3.5 shrink-0 text-fg-subtle" aria-hidden />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Filter versions…"
              className="h-9 w-full bg-transparent text-[13px] text-fg outline-none placeholder:text-fg-subtle"
              aria-label="Filter versions"
            />
          </div>

          <ul
            ref={listRef}
            role="listbox"
            aria-label={label}
            className="max-h-72 overflow-y-auto p-1"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-6 text-center text-[12.5px] text-fg-subtle">
                No version matches “{query}”.
              </li>
            ) : (
              filtered.map((option, index) => {
                const isActive = index === activeIndex;
                const isSelected = option.version === value;
                const previous =
                  index > 0 ? filtered[index - 1].version : undefined;
                const newLine =
                  !previous ||
                  previous.split(".").slice(0, 2).join(".") !==
                    option.version.split(".").slice(0, 2).join(".");

                return (
                  <li key={option.version}>
                    {newLine ? (
                      <div className="px-2.5 pb-1 pt-2.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-fg-subtle">
                        {option.version.split(".").slice(0, 2).join(".")}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      data-index={index}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => commit(option.version)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-[6px] px-2.5 py-1.5 text-left transition-colors duration-100",
                        isActive ? "bg-surface-3" : "bg-transparent"
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className={cn(
                            "font-mono text-[13px]",
                            isSelected
                              ? "font-semibold text-accent"
                              : "text-fg"
                          )}
                        >
                          {option.version}
                        </span>
                        {option.channels?.length ? (
                          <Badge tone="accent">
                            <Sparkles className="h-3 w-3" aria-hidden />
                            {option.channels[0]}
                          </Badge>
                        ) : null}
                        {option.prerelease ? (
                          <Badge tone="warning">pre</Badge>
                        ) : null}
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {option.releasedAt ? (
                          <span className="text-[11px] text-fg-subtle">
                            {formatDate(option.releasedAt)}
                          </span>
                        ) : null}
                        {isSelected ? (
                          <Check className="h-3.5 w-3.5 text-accent" aria-hidden />
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export default function VersionSelector() {
  const {
    catalog,
    catalogLoading,
    fromVersion,
    toVersion,
    setFromVersion,
    setToVersion,
    swapVersions,
    includePrerelease,
    setIncludePrerelease,
    latestStable,
    reactPeer,
    toVersionInfo,
  } = useUpgradeSession();

  const versions = useMemo(
    () => (catalog?.versions ?? []).filter((v) => includePrerelease || !v.prerelease),
    [catalog, includePrerelease]
  );

  // The target has to be newer than the source, and the other way around.
  const toOptions = useMemo(
    () =>
      versions.filter(
        (version) =>
          version.version !== fromVersion &&
          semverCompare(version.version, fromVersion) > 0
      ),
    [versions, fromVersion]
  );
  const fromOptions = useMemo(
    () =>
      versions.filter(
        (version) =>
          version.version !== toVersion &&
          semverCompare(version.version, toVersion) < 0
      ),
    [versions, toVersion]
  );

  const targetIsLatest = latestStable && toVersion === latestStable;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2 sm:gap-3">
        <VersionCombobox
          label="From"
          value={fromVersion}
          options={fromOptions}
          onChange={setFromVersion}
          exclude={toVersion}
        />

        <button
          type="button"
          onClick={swapVersions}
          title="Swap versions"
          aria-label="Swap versions"
          className="mb-1 hidden h-8 w-8 items-center justify-center rounded-[7px] border border-border bg-surface text-fg-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg sm:flex"
        >
          <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden />
        </button>

        <VersionCombobox
          label="To"
          value={toVersion}
          options={toOptions}
          onChange={setToVersion}
          align="right"
          exclude={fromVersion}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[12px] text-fg-muted">
        <label className="inline-flex cursor-pointer items-center gap-1.5">
          <input
            type="checkbox"
            checked={includePrerelease}
            onChange={(event) => setIncludePrerelease(event.target.checked)}
            className="h-3.5 w-3.5 rounded-[4px] border-border accent-[var(--accent)]"
          />
          Include prereleases
        </label>

        {catalogLoading ? (
          <span className="text-fg-subtle">Loading versions…</span>
        ) : null}

        {!targetIsLatest && latestStable ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setToVersion(latestStable)}
            icon={<Sparkles className="h-3.5 w-3.5" aria-hidden />}
          >
            Jump to {latestStable}
          </Button>
        ) : null}

        {reactPeer ? (
          <span className="ml-auto flex items-center gap-1.5">
            <span className="text-fg-subtle">Requires react</span>
            <code className="rounded-[4px] bg-surface-2 px-1.5 py-0.5 font-mono text-[11.5px] text-fg">
              {reactPeer}
            </code>
          </span>
        ) : null}

        {toVersionInfo?.releasedAt ? (
          <span className="hidden items-center gap-1 text-fg-subtle md:inline-flex">
            released {formatDate(toVersionInfo.releasedAt)}
          </span>
        ) : null}
      </div>

      <p className="sr-only" aria-live="polite">
        Upgrading from {fromVersion || "no version"} to {toVersion || "no version"}
        {toVersionInfo?.reactPeer ? `, requires react ${toVersionInfo.reactPeer}` : ""}
      </p>

      <p className="hidden text-[11.5px] text-fg-subtle lg:block">
        Tip: press <Kbd>⌘</Kbd> <Kbd>K</Kbd> to jump anywhere.
      </p>
    </div>
  );
}
