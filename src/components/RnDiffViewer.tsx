"use client";

import { useState, useEffect, useRef } from "react";
import {
  Loader2,
  AlertCircle,
  CheckSquare,
  Square,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  ClipboardCopy,
  Check,
  ClipboardList,
  ChevronRight,
} from "lucide-react";
import { Diff, Hunk, type ViewType } from "react-diff-view";
import {
  fetchRNDiff,
  getChangelogURL,
  categorizeFiles,
  getFilePathsToShow,
} from "@/lib/diffFetcher";
import type { DiffFile } from "@/lib/types";

interface RnDiffViewerProps {
  fromVersion: string;
  toVersion: string;
  appName?: string;
  appPackage?: string;
}

function getFileKey(file: DiffFile): string {
  const oldP = file.oldPath || "none";
  const newP = file.newPath || "none";
  return `${file.type}-${oldP}-${newP}`;
}

export default function RnDiffViewer({
  fromVersion,
  toVersion,
  appName,
  appPackage,
}: RnDiffViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [diffFiles, setDiffFiles] = useState<DiffFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [completedFiles, setCompletedFiles] = useState<Set<string>>(new Set());
  const [viewType, setViewType] = useState<ViewType>("split");
  const [selectedCategory, setSelectedCategory] = useState<
    "all" | "android" | "ios" | "javascript" | "config"
  >("all");
  const [showCompleted, setShowCompleted] = useState(false);
  const doneSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadDiff = async () => {
      setIsLoading(true);
      setError(null);
      setCompletedFiles(new Set());

      try {
        const files = await fetchRNDiff(fromVersion, toVersion);
        setDiffFiles(files);
      } catch (err) {
        console.error("Error loading diff:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load React Native upgrade diff. Please check the versions."
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadDiff();
  }, [fromVersion, toVersion]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedView = localStorage.getItem("diffViewType") as ViewType;
      if (savedView) setViewType(savedView);
    }
  }, []);

  const toggleFileComplete = (filepath: string) => {
    setCompletedFiles((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(filepath)) {
        newSet.delete(filepath);
      } else {
        newSet.add(filepath);
      }
      return newSet;
    });
  };

  const handleViewTypeChange = (newType: ViewType) => {
    setViewType(newType);
    if (typeof window !== "undefined") {
      localStorage.setItem("diffViewType", newType);
    }
  };

  const categorizedFiles = categorizeFiles(diffFiles);
  const displayFiles =
    selectedCategory === "all" ? diffFiles : categorizedFiles[selectedCategory];

  const pendingFiles = displayFiles.filter(
    (file) => !completedFiles.has(getFileKey(file))
  );
  const completedFilesList = displayFiles.filter((file) =>
    completedFiles.has(getFileKey(file))
  );

  const stats = {
    total: diffFiles.length,
    completed: completedFiles.size,
    android: categorizedFiles.android.length,
    ios: categorizedFiles.ios.length,
    javascript: categorizedFiles.javascript.length,
    config: categorizedFiles.config.length,
  };

  const changelogUrl = getChangelogURL(toVersion);

  const scrollToDone = () => {
    doneSectionRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  if (isLoading) {
    return (
      <div className="w-full max-w-6xl mx-auto px-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">
            Loading React Native Diff
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Comparing {fromVersion} → {toVersion}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-6xl mx-auto px-4">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-800 dark:text-red-200 mb-1">
              Failed to Load Diff
            </h3>
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-4">
      {/* Useful Links Section */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2 text-sm">
          📚 Useful Resources
        </h3>
        <div className="flex flex-wrap gap-4 text-sm">
          {changelogUrl && (
            <a
              href={changelogUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              React Native v{toVersion} Changelog
            </a>
          )}
          <a
            href="https://reactnative.dev/docs/upgrading"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:underline"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Upgrade Guide
          </a>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-4 border-b border-gray-200 dark:border-gray-700 mb-6">
        <div>
          <h2 className="text-2xl font-bold">
            Upgrading from{" "}
            <span className="text-blue-600 dark:text-blue-400">
              {fromVersion}
            </span>{" "}
            →{" "}
            <span className="text-violet-600 dark:text-violet-400">
              {toVersion}
            </span>
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {diffFiles.length} file{diffFiles.length !== 1 ? "s" : ""} changed
          </p>
        </div>

        <div className="flex items-center gap-3">
          <SegmentedControl
            viewType={viewType}
            onChange={handleViewTypeChange}
          />
        </div>
      </div>

      {/* Progress Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Completed" value={stats.completed} color="green" />
        <StatCard label="Android" value={stats.android} />
        <StatCard label="iOS" value={stats.ios} />
        <StatCard label="JavaScript" value={stats.javascript} />
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <CategoryButton
          label="All Files"
          count={diffFiles.length}
          active={selectedCategory === "all"}
          onClick={() => setSelectedCategory("all")}
        />
        <CategoryButton
          label="Android"
          count={stats.android}
          active={selectedCategory === "android"}
          onClick={() => setSelectedCategory("android")}
        />
        <CategoryButton
          label="iOS"
          count={stats.ios}
          active={selectedCategory === "ios"}
          onClick={() => setSelectedCategory("ios")}
        />
        <CategoryButton
          label="JavaScript"
          count={stats.javascript}
          active={selectedCategory === "javascript"}
          onClick={() => setSelectedCategory("javascript")}
        />
        <CategoryButton
          label="Config"
          count={stats.config}
          active={selectedCategory === "config"}
          onClick={() => setSelectedCategory("config")}
        />
      </div>

      {/* Pending Files */}
      <div className="space-y-3 mb-8">
        {pendingFiles.map((file) => {
          const key = getFileKey(file);
          return (
            <FileCard
              key={key}
              file={file}
              viewType={viewType}
              isCompleted={false}
              onToggle={() => toggleFileComplete(key)}
              appName={appName}
              appPackage={appPackage}
            />
          );
        })}
      </div>

      {/* Completion Message */}
      {stats.completed === stats.total && stats.total > 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white text-lg">✓</span>
            </div>
            <div>
              <h3 className="font-semibold text-green-800 dark:text-green-200">
                Your upgrade is complete! 🎉
              </h3>
              <p className="text-sm text-green-700 dark:text-green-300 mt-0.5">
                All {stats.total} files have been reviewed.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Completed Files Section */}
      {completedFilesList.length > 0 && (
        <div ref={doneSectionRef} className="mt-8">
          <div className="flex items-center gap-3 mb-4">
            <h3 className="text-xl font-semibold">Done</h3>
            <span className="text-sm bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-1 rounded">
              {completedFilesList.length} file
              {completedFilesList.length !== 1 ? "s" : ""}
            </span>
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className="ml-auto flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            >
              {showCompleted ? "Hide" : "Show"}
              {showCompleted ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>

          {showCompleted && (
            <div className="space-y-3 opacity-60">
              {completedFilesList.map((file) => {
                const key = getFileKey(file);
                return (
                  <FileCard
                    key={key}
                    file={file}
                    viewType={viewType}
                    isCompleted={true}
                    onToggle={() => toggleFileComplete(key)}
                    appName={appName}
                    appPackage={appPackage}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Floating Progress Button */}
      {stats.total > 0 && (
        <button
          onClick={scrollToDone}
          className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg transition-all hover:scale-105 z-50"
          aria-label="Scroll to completed files"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {stats.completed}/{stats.total}
            </span>
            <svg className="w-8 h-8 transform -rotate-90" viewBox="0 0 32 32">
              <circle
                cx="16"
                cy="16"
                r="14"
                fill="none"
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="2"
              />
              <circle
                cx="16"
                cy="16"
                r="14"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeDasharray={`${(stats.completed / stats.total) * 100} 100`}
                strokeLinecap="round"
              />
            </svg>
          </div>
        </button>
      )}
    </div>
  );
}

function SegmentedControl({
  viewType,
  onChange,
}: {
  viewType: ViewType;
  onChange: (type: ViewType) => void;
}) {
  return (
    <div className="flex items-center rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-0 text-sm">
      <button
        onClick={() => onChange("split")}
        className={`px-4 py-1.5 rounded-l-[7px] transition-colors focus:outline-none relative ${
          viewType === "split"
            ? "text-blue-600 dark:text-blue-400"
            : "text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
        }`}
      >
        {viewType === "split" && (
          <div className="absolute inset-0 ring-1 ring-inset ring-blue-500 rounded-l-lg"></div>
        )}
        Split
      </button>
      <div className="w-px self-stretch bg-gray-300 dark:bg-gray-700"></div>
      <button
        onClick={() => onChange("unified")}
        className={`px-4 py-1.5 rounded-r-[7px] transition-colors focus:outline-none relative ${
          viewType === "unified"
            ? "text-blue-600 dark:text-blue-400"
            : "text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
        }`}
      >
        {viewType === "unified" && (
          <div className="absolute inset-0 ring-1 ring-inset ring-blue-500 rounded-r-lg"></div>
        )}
        Unified
      </button>
    </div>
  );
}

interface FileCardProps {
  file: DiffFile;
  viewType: ViewType;
  isCompleted: boolean;
  onToggle: () => void;
  appName?: string;
  appPackage?: string;
}

function FileCard({
  file,
  viewType,
  isCompleted,
  onToggle,
  appName,
  appPackage,
}: FileCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const [isPatchCopied, setIsPatchCopied] = useState(false);

  const { oldPath, newPath } = getFilePathsToShow({
    oldPath: file.oldPath,
    newPath: file.newPath,
    appName,
    appPackage,
  });
  const displayPath = newPath || oldPath || "unknown";

  const additions =
    file.hunks?.reduce(
      (sum, hunk) =>
        sum + hunk.changes.filter((c) => c.type === "insert").length,
      0
    ) || 0;
  const deletions =
    file.hunks?.reduce(
      (sum, hunk) =>
        sum + hunk.changes.filter((c) => c.type === "delete").length,
      0
    ) || 0;

  const getStatusBadge = () => {
    if (file.type === "add")
      return {
        label: "ADDED",
        color:
          "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
      };
    if (file.type === "delete")
      return {
        label: "REMOVED",
        color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
      };
    if (file.type === "rename")
      return {
        label: "RENAMED",
        color:
          "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
      };
    return {
      label: "MODIFIED",
      color:
        "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
    };
  };
  const status = getStatusBadge();

  const handleCopy = async () => {
    if (!file.hunks) return;
    const newFileContent = file.hunks
      .flatMap((hunk) => hunk.changes)
      .filter((change) => change.type !== "delete")
      .map((change) => change.content.substring(1))
      .join("\n");
    try {
      await navigator.clipboard.writeText(newFileContent);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy file content:", err);
    }
  };

  const handleRawView = () => {
    if (!file.hunks) return;
    const newFileContent = file.hunks
      .flatMap((hunk) => hunk.changes)
      .filter((change) => change.type !== "delete")
      .map((change) => change.content.substring(1))
      .join("\n");
    const blob = new Blob([newFileContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    URL.revokeObjectURL(url);
  };

  const handleCopyPatch = async () => {
    if (!file.hunks) return;
    const patch = [
      `--- a/${file.oldPath}`,
      `+++ b/${file.newPath}`,
      ...file.hunks.flatMap((hunk) => [
        `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`,
        ...hunk.changes.map((change) => change.content),
      ]),
    ].join("\n");

    try {
      await navigator.clipboard.writeText(patch);
      setIsPatchCopied(true);
      setTimeout(() => setIsPatchCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy patch:", err);
    }
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-900">
        {/* ✅ NEW: Icon button for collapsing */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          )}
        </button>

        {/* ✅ MODIFIED: Main clickable area */}
        <div
          className="flex-1 flex items-center gap-2 flex-wrap cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <span className="font-mono text-sm break-all text-gray-900 dark:text-gray-100">
            {displayPath}
          </span>
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded ${status.color}`}
          >
            {status.label}
          </span>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCopyPatch();
            }}
            title="Copy file patch"
            className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
          >
            {isPatchCopied ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <ClipboardList className="w-4 h-4" />
            )}
          </button>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {additions > 0 && (
            <span className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-1.5 py-0.5 rounded">
              +{additions}
            </span>
          )}
          {deletions > 0 && (
            <span className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-1.5 py-0.5 rounded">
              -{deletions}
            </span>
          )}

          {file.type !== "delete" && (
            <button
              onClick={handleRawView}
              title="View raw file"
              className="px-3 py-1 text-sm rounded-md border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Raw
            </button>
          )}

          {file.type !== "delete" && (
            <button
              onClick={handleCopy}
              title="Copy new file contents"
              className="p-2 rounded-md border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
            >
              {isCopied ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <ClipboardCopy className="w-4 h-4" />
              )}
            </button>
          )}

          <button
            onClick={onToggle}
            title={isCompleted ? "Mark as incomplete" : "Mark as complete"}
            className="p-2 rounded-md border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {isCompleted ? (
              <CheckSquare className="w-4 h-4 text-green-600" />
            ) : (
              <Square className="w-4 h-4 text-gray-400" />
            )}
          </button>

          {/* ✅ REMOVED: Collapse text button */}
        </div>
      </div>

      {/* Diff Content */}
      {expanded && file.hunks && file.hunks.length > 0 && (
        <div className="diff-container-fixed">
          <Diff
            viewType={viewType}
            diffType={file.type || "modify"}
            hunks={file.hunks}
          >
            {(hunks) =>
              hunks.map((hunk) => <Hunk key={hunk.content} hunk={hunk} />)
            }
          </Diff>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  const colorClass =
    color === "green"
      ? "text-green-600 dark:text-green-400"
      : "text-gray-900 dark:text-gray-100";
  return (
    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
      <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
        {label}
      </div>
      <div className={`text-2xl font-bold ${colorClass}`}>{value}</div>
    </div>
  );
}

function CategoryButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        active
          ? "bg-blue-600 text-white"
          : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
      }`}
    >
      {label} ({count})
    </button>
  );
}
