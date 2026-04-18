"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Download,
  Package,
  Search,
  XCircle,
} from "lucide-react";
import { useUpgradeSession } from "@/lib/hooks/useUpgradeSession";
import type { DependencyAnalysis } from "@/lib/types";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CopyButton,
  EmptyState,
  Skeleton,
  type BadgeTone,
} from "./ui";
import { cn, pluralize } from "@/lib/utils";

type Filter = "all" | "updates" | "breaking" | "incompatible" | "current";

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "updates", label: "Needs update" },
  { id: "breaking", label: "Major bump" },
  { id: "incompatible", label: "Incompatible" },
  { id: "current", label: "Up to date" },
];

const STATUS: Record<
  DependencyAnalysis["compatibilityStatus"],
  { tone: BadgeTone; label: string }
> = {
  compatible: { tone: "success", label: "Compatible" },
  warning: { tone: "warning", label: "Review" },
  incompatible: { tone: "danger", label: "Incompatible" },
  unknown: { tone: "neutral", label: "Unknown" },
};

export default function DependenciesTab() {
  const {
    packageJson,
    analysis,
    analyzing,
    analysisProgress,
    toVersion,
    mergedPackageJson,
  } = useUpgradeSession();

  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const merged = mergedPackageJson
    ? JSON.stringify(mergedPackageJson, null, 2)
    : null;

  const counts = useMemo(
    () => ({
      all: analysis.length,
      updates: analysis.filter((item) => item.needsUpdate).length,
      breaking: analysis.filter((item) => item.hasBreakingChanges).length,
      incompatible: analysis.filter(
        (item) => item.compatibilityStatus === "incompatible"
      ).length,
      current: analysis.filter((item) => !item.needsUpdate).length,
    }),
    [analysis]
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return analysis.filter((item) => {
      if (term && !item.package.toLowerCase().includes(term)) return false;
      if (filter === "updates") return item.needsUpdate;
      if (filter === "breaking") return item.hasBreakingChanges;
      if (filter === "incompatible")
        return item.compatibilityStatus === "incompatible";
      if (filter === "current") return !item.needsUpdate;
      return true;
    });
  }, [analysis, filter, query]);

  const installCommand = useMemo(() => {
    const updates = analysis.filter((item) => item.needsUpdate);
    if (!updates.length) return "";
    return `npm install ${updates
      .map((item) => `${item.package}@${item.recommendedVersion}`)
      .join(" ")}`;
  }, [analysis]);

  const downloadMerged = () => {
    if (!merged) return;
    const blob = new Blob([merged], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "package.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!packageJson) {
    return (
      <EmptyState
        icon={<Package className="h-5 w-5" />}
        title="No project loaded"
        description="Add your package.json in the sidebar to see which dependencies are compatible with the target React Native version."
      />
    );
  }

  if (analyzing && analysis.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-[8px] border border-border bg-surface px-4 py-3">
          <div className="h-1.5 w-40 overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300"
              style={{
                width: `${
                  analysisProgress.total
                    ? (analysisProgress.current / analysisProgress.total) * 100
                    : 0
                }%`,
              }}
            />
          </div>
          <span className="text-[12.5px] text-fg-muted">
            Checking {analysisProgress.current} of {analysisProgress.total}{" "}
            packages against the npm registry…
          </span>
        </div>
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <Skeleton key={index} className="h-11 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader
          title="Dependency compatibility"
          description={
            analysis.length
              ? `Checked against react-native ${toVersion} using the peer dependencies published on npm.`
              : "Checking the npm registry…"
          }
          icon={<Package className="h-4 w-4" />}
          actions={
            <div className="flex flex-wrap items-center gap-1.5">
              {installCommand ? (
                <CopyButton
                  value={installCommand}
                  label="Copy install command"
                  variant="secondary"
                />
              ) : null}
              {merged ? (
                <>
                  <CopyButton value={merged} label="Copy package.json" />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={downloadMerged}
                    icon={<Download className="h-3.5 w-3.5" aria-hidden />}
                  >
                    Download
                  </Button>
                </>
              ) : null}
            </div>
          }
        />

        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
          <div className="relative min-w-[200px] flex-1">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-subtle"
              aria-hidden
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search packages"
              className="h-8 w-full rounded-[7px] border border-border bg-surface pl-8 pr-2.5 text-[12.5px] text-fg outline-none transition-colors placeholder:text-fg-subtle focus:border-accent-border"
              aria-label="Search packages"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {FILTERS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setFilter(entry.id)}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-[6px] px-2 text-[12px] font-medium transition-colors duration-150",
                  filter === entry.id
                    ? "bg-surface-3 text-fg"
                    : "text-fg-muted hover:bg-surface-2 hover:text-fg"
                )}
              >
                {entry.label}
                <span className="tabular text-[11px] text-fg-subtle">
                  {counts[entry.id]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-[12.5px] text-fg-subtle">
            No packages match this filter.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-[0.05em] text-fg-subtle">
                  <th className="px-4 py-2 font-medium">Package</th>
                  <th className="px-3 py-2 font-medium">Current</th>
                  <th className="px-3 py-2 font-medium">Recommended</th>
                  <th className="px-3 py-2 font-medium">Latest</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((item) => {
                  const status = STATUS[item.compatibilityStatus];
                  const isOpen = expanded === item.package;
                  return (
                    <>
                      <tr
                        key={item.package}
                        onClick={() =>
                          setExpanded(isOpen ? null : item.package)
                        }
                        className="cursor-pointer align-middle transition-colors duration-100 hover:bg-surface-2"
                      >
                        <td className="px-4 py-2.5">
                          <span className="font-mono text-[12.5px] text-fg">
                            {item.package}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[12.5px] text-fg-muted">
                          {item.currentVersion}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={cn(
                              "font-mono text-[12.5px]",
                              item.needsUpdate
                                ? "font-semibold text-accent"
                                : "text-fg-muted"
                            )}
                          >
                            {item.recommendedVersion}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[12.5px] text-fg-subtle">
                          {item.latestVersion}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <Badge tone={status.tone}>{status.label}</Badge>
                            {item.hasBreakingChanges ? (
                              <Badge tone="danger">major</Badge>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                      {isOpen ? (
                        <tr key={`${item.package}-detail`}>
                          <td
                            colSpan={5}
                            className="bg-surface-2 px-4 py-3 text-[12.5px] text-fg-muted"
                          >
                            <p className="text-fg">{item.reason}</p>
                            <div className="mt-2 flex items-center gap-3">
                              {item.changelogUrl ? (
                                <a
                                  href={item.changelogUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[12px] text-accent hover:underline"
                                >
                                  View on npm
                                </a>
                              ) : null}
                              <CopyButton
                                value={`npm install ${item.package}@${item.recommendedVersion}`}
                                label="Copy install command"
                              />
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {counts.incompatible > 0 ? (
        <div className="flex items-start gap-2.5 rounded-[8px] border border-danger-border bg-danger-subtle px-3.5 py-3 text-[12.5px] leading-5 text-fg">
          <XCircle className="mt-px h-4 w-4 shrink-0 text-danger" aria-hidden />
          <div>
            <p className="font-semibold text-fg">
              {pluralize(counts.incompatible, "package")} cannot be used with
              react-native {toVersion} as they stand.
            </p>
            <p className="mt-0.5 text-fg-muted">
              Their peer dependency range excludes the target version. Look for a
              newer release, a fork, or a replacement package.
            </p>
          </div>
        </div>
      ) : null}

      {counts.updates > 0 && !analyzing ? (
        <div className="flex items-start gap-2.5 rounded-[8px] border border-border bg-surface px-3.5 py-3 text-[12.5px] leading-5 text-fg-muted">
          <CheckCircle2 className="mt-px h-4 w-4 shrink-0 text-success" aria-hidden />
          <p>
            {pluralize(counts.updates, "package")} can move forward
            automatically. Use the agent bridge to apply them inside your project.
          </p>
        </div>
      ) : null}
    </div>
  );
}
