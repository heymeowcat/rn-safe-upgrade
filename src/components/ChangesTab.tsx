"use client";

import { useMemo, useState } from "react";
import { Diff, Hunk, type ViewType, type HunkData } from "react-diff-view";
import {
  Check,
  ChevronRight,
  Download,
  FileCode2,
  Files,
  Search,
  X,
} from "lucide-react";
import { useUpgradeSession } from "@/lib/hooks/useUpgradeSession";
import { categorizeFiles, getFilePathsToShow } from "@/lib/diffFetcher";
import { fileToPatch, filesToPatch } from "@/lib/diff/patch";
import type { DiffFile } from "@/lib/types";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CopyButton,
  EmptyState,
  Segmented,
  Skeleton,
} from "./ui";
import { cn, pluralize } from "@/lib/utils";

type Scope = "all" | "android" | "ios" | "javascript" | "config";

const SCOPES: Array<{ value: Scope; label: string }> = [
  { value: "all", label: "All" },
  { value: "android", label: "Android" },
  { value: "ios", label: "iOS" },
  { value: "javascript", label: "JS / TS" },
  { value: "config", label: "Config" },
];

function fileKey(file: DiffFile): string {
  return `${file.type}-${file.oldPath || "none"}-${file.newPath || "none"}`;
}

export default function ChangesTab() {
  const {
    diffFiles,
    diffLoading,
    diffError,
    fromVersion,
    toVersion,
    appName,
    appPackage,
    completedFiles,
    toggleFile,
    resetCompletedFiles,
  } = useUpgradeSession();

  const [scope, setScope] = useState<Scope>("all");
  const [query, setQuery] = useState("");
  const [viewType, setViewType] = useState<ViewType>("split");
  const [openFile, setOpenFile] = useState<string | null>(null);
  const [hideDone, setHideDone] = useState(false);

  const categorized = useMemo(() => categorizeFiles(diffFiles), [diffFiles]);

  const scopeCounts = useMemo(
    () => ({
      all: diffFiles.length,
      android: categorized.android.length,
      ios: categorized.ios.length,
      javascript: categorized.javascript.length,
      config: categorized.config.length,
    }),
    [diffFiles, categorized]
  );

  const visibleFiles = useMemo(() => {
    const base = scope === "all" ? diffFiles : categorized[scope];
    const term = query.trim().toLowerCase();

    return base.filter((file) => {
      if (hideDone && completedFiles.has(fileKey(file))) return false;
      if (!term) return true;
      const path = `${file.oldPath} ${file.newPath}`.toLowerCase();
      return path.includes(term);
    });
  }, [diffFiles, categorized, scope, query, hideDone, completedFiles]);

  const totals = useMemo(() => {
    let additions = 0;
    let deletions = 0;
    for (const file of diffFiles) {
      const hunks = (file.hunks ?? []) as Array<{
        changes?: Array<{ type?: string }>;
      }>;
      for (const hunk of hunks) {
        for (const change of hunk.changes ?? []) {
          if (change.type === "insert") additions++;
          else if (change.type === "delete") deletions++;
        }
      }
    }
    return { additions, deletions };
  }, [diffFiles]);

  const doneCount = diffFiles.filter((file) =>
    completedFiles.has(fileKey(file))
  ).length;

  const downloadPatch = () => {
    const patch = filesToPatch(diffFiles);
    const blob = new Blob([patch], { type: "text/x-patch" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `react-native-${fromVersion}-to-${toVersion}.patch`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (diffLoading && diffFiles.length === 0) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (diffError) {
    return (
      <EmptyState
        icon={<X className="h-5 w-5" />}
        title="Could not load this diff"
        description={diffError}
      />
    );
  }

  if (!fromVersion || !toVersion) {
    return (
      <EmptyState
        icon={<Files className="h-5 w-5" />}
        title="Select two versions"
        description="The template diff appears as soon as a source and a target version are chosen."
      />
    );
  }

  if (diffFiles.length === 0) {
    return (
      <EmptyState
        icon={<Files className="h-5 w-5" />}
        title="No template changes"
        description="There is no published template diff between these two versions."
      />
    );
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader
          title={`${fromVersion} → ${toVersion}`}
          description={`${pluralize(diffFiles.length, "file")} changed · +${totals.additions} / -${totals.deletions} lines`}
          icon={<Files className="h-4 w-4" />}
          actions={
            <div className="flex flex-wrap items-center gap-1.5">
              <Segmented
                value={viewType}
                onChange={setViewType}
                options={[
                  { value: "split" as ViewType, label: "Split" },
                  { value: "unified" as ViewType, label: "Unified" },
                ]}
              />
              <CopyButton
                value={() => filesToPatch(diffFiles)}
                label="Copy full patch"
                variant="secondary"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={downloadPatch}
                icon={<Download className="h-3.5 w-3.5" aria-hidden />}
              >
                .patch
              </Button>
            </div>
          }
        />

        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
          <div className="relative min-w-[190px] flex-1">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-subtle"
              aria-hidden
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter by path"
              className="h-8 w-full rounded-[7px] border border-border bg-surface pl-8 pr-2.5 text-[12.5px] text-fg outline-none transition-colors placeholder:text-fg-subtle focus:border-accent-border"
              aria-label="Filter files by path"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {SCOPES.map((entry) => (
              <button
                key={entry.value}
                type="button"
                onClick={() => setScope(entry.value)}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-[6px] px-2 text-[12px] font-medium transition-colors duration-150",
                  scope === entry.value
                    ? "bg-surface-3 text-fg"
                    : "text-fg-muted hover:bg-surface-2 hover:text-fg"
                )}
              >
                {entry.label}
                <span className="tabular text-[11px] text-fg-subtle">
                  {scopeCounts[entry.value]}
                </span>
              </button>
            ))}
          </div>

          <label className="ml-auto inline-flex cursor-pointer items-center gap-1.5 text-[12px] text-fg-muted">
            <input
              type="checkbox"
              checked={hideDone}
              onChange={(event) => setHideDone(event.target.checked)}
              className="h-3.5 w-3.5 rounded-[4px] border-border accent-[var(--accent)]"
            />
            Hide completed
          </label>
        </div>

        <div className="flex items-center gap-3 border-b border-border px-4 py-2.5">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full bg-success transition-[width] duration-300"
              style={{
                width: `${
                  diffFiles.length ? (doneCount / diffFiles.length) * 100 : 0
                }%`,
              }}
            />
          </div>
          <span className="tabular text-[12px] text-fg-muted">
            {doneCount} / {diffFiles.length} reviewed
          </span>
          {doneCount > 0 ? (
            <Button size="sm" variant="ghost" onClick={resetCompletedFiles}>
              Reset
            </Button>
          ) : null}
        </div>

        <ul className="max-h-[640px] divide-y divide-border overflow-y-auto">
          {visibleFiles.length === 0 ? (
            <li className="px-4 py-8 text-center text-[12.5px] text-fg-subtle">
              No files match this filter.
            </li>
          ) : (
            visibleFiles.map((file) => {
              const key = fileKey(file);
              const isOpen = openFile === key;
              const isDone = completedFiles.has(key);
              const { newPath, oldPath } = getFilePathsToShow({
                oldPath: file.oldPath,
                newPath: file.newPath,
                appName,
                appPackage,
              });
              const displayPath =
                file.type === "delete" ? oldPath : newPath || oldPath;

              const hunks = (file.hunks ?? []) as Array<{
                changes?: Array<{ type?: string }>;
              }>;
              const additions =
                hunks.reduce(
                  (sum, hunk) =>
                    sum +
                    (hunk.changes ?? []).filter(
                      (change) => change.type === "insert"
                    ).length,
                  0
                ) || 0;
              const deletions =
                hunks.reduce(
                  (sum, hunk) =>
                    sum +
                    (hunk.changes ?? []).filter(
                      (change) => change.type === "delete"
                    ).length,
                  0
                ) || 0;

              return (
                <li key={key}>
                  <div
                    className={cn(
                      "flex items-center gap-2.5 px-4 py-2 transition-colors duration-100",
                      isDone ? "bg-surface-2/60" : "hover:bg-surface-2"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFile(isOpen ? null : key)}
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                      aria-expanded={isOpen}
                    >
                      <ChevronRight
                        className={cn(
                          "h-3.5 w-3.5 shrink-0 text-fg-subtle transition-transform duration-150",
                          isOpen && "rotate-90"
                        )}
                        aria-hidden
                      />
                      <FileCode2
                        className="h-3.5 w-3.5 shrink-0 text-fg-subtle"
                        aria-hidden
                      />
                      <span
                        className={cn(
                          "truncate font-mono text-[12.5px]",
                          isDone ? "text-fg-subtle" : "text-fg"
                        )}
                      >
                        {displayPath}
                      </span>
                    </button>

                    {file.type !== "modify" ? (
                      <Badge
                        tone={
                          file.type === "add"
                            ? "success"
                            : file.type === "delete"
                              ? "danger"
                              : "info"
                        }
                      >
                        {file.type}
                      </Badge>
                    ) : null}

                    <span className="tabular w-12 text-right font-mono text-[11.5px] text-success">
                      +{additions}
                    </span>
                    <span className="tabular w-12 text-right font-mono text-[11.5px] text-danger">
                      -{deletions}
                    </span>

                    <button
                      type="button"
                      onClick={() => toggleFile(key)}
                      title={isDone ? "Mark as not reviewed" : "Mark as reviewed"}
                      aria-label={
                        isDone ? "Mark as not reviewed" : "Mark as reviewed"
                      }
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] border transition-colors duration-150",
                        isDone
                          ? "border-success-border bg-success-subtle text-success"
                          : "border-border text-transparent hover:border-border-strong hover:text-fg-subtle"
                      )}
                    >
                      <Check className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>

                  {isOpen ? (
                    <div className="border-t border-border bg-bg-subtle px-4 py-3">
                      <div className="mb-2 flex items-center gap-2">
                        <CopyButton
                          value={() => fileToPatch(file)}
                          label="Copy patch"
                          variant="secondary"
                        />
                        <span className="truncate font-mono text-[11.5px] text-fg-subtle">
                          {displayPath}
                        </span>
                      </div>
                      <div className="diff-view">
                        {file.hunks && file.hunks.length > 0 ? (
                          <Diff
                            viewType={viewType}
                            diffType={file.type || "modify"}
                            hunks={(file.hunks ?? []) as HunkData[]}
                          >
                            {(hunks) =>
                              hunks.map((hunk) => (
                                <Hunk key={hunk.content} hunk={hunk} />
                              ))
                            }
                          </Diff>
                        ) : (
                          <p className="px-4 py-6 text-center text-[12.5px] text-fg-subtle">
                            {file.type === "add"
                              ? "New file"
                              : file.type === "delete"
                                ? "File removed"
                                : "No textual changes"}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })
          )}
        </ul>
      </Card>
    </div>
  );
}
