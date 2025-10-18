"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Download,
  Copy,
  CheckCircle2,
} from "lucide-react";
import { Diff, Hunk, parseDiff } from "react-diff-view";
import type { PackageJson, DependencyAnalysis } from "@/lib/types";
import {
  mergePackageJsonWithAnalysis,
  getPackageJsonChangeSummary,
  createAnnotatedPackageJson,
} from "@/lib/packageJsonMerger";

interface PackageJsonDiffViewerProps {
  userPackageJson: PackageJson;
  dependencyAnalysis: DependencyAnalysis[];
  targetVersion: string;
}

export default function PackageJsonDiffViewer({
  userPackageJson,
  dependencyAnalysis,
  targetVersion,
}: PackageJsonDiffViewerProps) {
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  const merged = mergePackageJsonWithAnalysis(
    userPackageJson,
    dependencyAnalysis,
    targetVersion
  );

  const summary = getPackageJsonChangeSummary(merged.original, merged.upgraded);

  const parsedDiff = parseDiff(merged.diffText);
  const file = parsedDiff[0];

  const handleDownload = () => {
    const content = JSON.stringify(merged.upgraded, null, 2);
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "package.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    const content = JSON.stringify(merged.upgraded, null, 2);
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadAnnotated = () => {
    const content = createAnnotatedPackageJson(
      merged.upgraded,
      dependencyAnalysis
    );
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "package.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="border border-blue-500 rounded-lg overflow-hidden bg-blue-50/50 dark:bg-blue-900/10">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-b border-blue-200 dark:border-blue-800">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-shrink-0 hover:bg-white/50 dark:hover:bg-gray-800/50 p-1 rounded transition-colors"
        >
          {expanded ? (
            <ChevronDown className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          )}
        </button>

        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-bold text-blue-900 dark:text-blue-100">
              📦 package.json
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-200">
              YOUR PROJECT
            </span>
            {summary.updated.length > 0 && (
              <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded font-medium">
                {summary.updated.length} updated
              </span>
            )}
            {summary.added.length > 0 && (
              <span className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded font-medium">
                {summary.added.length} added
              </span>
            )}
            {summary.removed.length > 0 && (
              <span className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2 py-0.5 rounded font-medium">
                {summary.removed.length} removed
              </span>
            )}
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            This shows your dependencies upgraded to compatible versions
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg transition-colors"
            title="Copy to clipboard"
          >
            {copied ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="text-green-600">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy
              </>
            )}
          </button>

          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            title="Download updated package.json"
          >
            <Download className="w-4 h-4" />
            Download
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="px-4 py-3 bg-blue-100/50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-2 text-sm">
          <span className="text-blue-600 dark:text-blue-400 font-semibold">
            ℹ️
          </span>
          <div className="flex-1">
            <p className="text-blue-900 dark:text-blue-100 font-medium">
              Smart Package.json Upgrade
            </p>
            <p className="text-blue-700 dark:text-blue-300 text-xs mt-1">
              We've analyzed your dependencies and updated them to versions
              compatible with React Native {targetVersion}. This includes both
              your current dependencies AND React Native core changes.
            </p>
          </div>
        </div>
      </div>

      {/* Diff Content */}
      {expanded && file && file.hunks && file.hunks.length > 0 && (
        <div className="diff-container-fixed">
          <Diff viewType="split" diffType="modify" hunks={file.hunks}>
            {(hunks: any[]) =>
              hunks.map((hunk: any) => <Hunk key={hunk.content} hunk={hunk} />)
            }
          </Diff>
        </div>
      )}

      {/* Summary Footer */}
      {expanded && (
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-400">Total:</span>
              <span className="ml-2 font-semibold text-gray-900 dark:text-gray-100">
                {summary.updated.length +
                  summary.added.length +
                  summary.removed.length +
                  summary.unchanged.length}
              </span>
            </div>
            <div>
              <span className="text-amber-600 dark:text-amber-400">
                Updated:
              </span>
              <span className="ml-2 font-semibold text-amber-700 dark:text-amber-300">
                {summary.updated.length}
              </span>
            </div>
            <div>
              <span className="text-green-600 dark:text-green-400">Added:</span>
              <span className="ml-2 font-semibold text-green-700 dark:text-green-300">
                {summary.added.length}
              </span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">
                Unchanged:
              </span>
              <span className="ml-2 font-semibold text-gray-700 dark:text-gray-300">
                {summary.unchanged.length}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
