"use client";

import { useState } from "react";
import { Diff, Hunk, parseDiff } from "react-diff-view";
import { ChevronDown, ChevronRight, Check } from "lucide-react";
import type { DiffFile } from "@/lib/types";

interface FileDiffViewerProps {
  file: DiffFile;
  onToggleDone?: (path: string, done: boolean) => void;
  isDone?: boolean;
}

interface Change {
  type: "insert" | "delete" | "normal";
  content: string;
  lineNumber?: number;
  oldLineNumber?: number;
  newLineNumber?: number;
}

interface Hunk {
  content: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  changes: Change[];
}

export default function FileDiffViewer({
  file,
  onToggleDone,
  isDone = false,
}: FileDiffViewerProps) {
  const [expanded, setExpanded] = useState(false);

  const path = file.newPath || file.oldPath || "unknown";

  const getFileStatus = () => {
    if (file.type === "add")
      return {
        label: "Added",
        color: "text-green-600 bg-green-50 dark:bg-green-900/20",
      };
    if (file.type === "delete")
      return {
        label: "Deleted",
        color: "text-red-600 bg-red-50 dark:bg-red-900/20",
      };
    if (file.type === "rename")
      return {
        label: "Renamed",
        color: "text-blue-600 bg-blue-50 dark:bg-blue-900/20",
      };
    return {
      label: "Modified",
      color: "text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20",
    };
  };

  const status = getFileStatus();

  const additions =
    file.hunks?.reduce(
      (acc: number, hunk: Hunk) =>
        acc + hunk.changes.filter((c: Change) => c.type === "insert").length,
      0
    ) || 0;

  const deletions =
    file.hunks?.reduce(
      (acc: number, hunk: Hunk) =>
        acc + hunk.changes.filter((c: Change) => c.type === "delete").length,
      0
    ) || 0;

  const handleToggleDone = () => {
    if (onToggleDone) {
      onToggleDone(path, !isDone);
    }
  };

  return (
    <div
      className={`border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden ${
        isDone ? "opacity-50" : ""
      }`}
    >
      {/* File header */}
      <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            {/* Expand/Collapse button */}
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
              aria-label={expanded ? "Collapse diff" : "Expand diff"}
            >
              {expanded ? (
                <ChevronDown className="w-5 h-5" />
              ) : (
                <ChevronRight className="w-5 h-5" />
              )}
            </button>

            {/* File path */}
            <div className="flex-1">
              <div className="font-mono text-sm font-medium text-gray-900 dark:text-gray-100">
                {path}
              </div>
              {file.type === "rename" && file.oldPath && (
                <div className="font-mono text-xs text-gray-500 mt-1">
                  Renamed from: {file.oldPath}
                </div>
              )}
            </div>

            {/* Status badge */}
            <span
              className={`px-2 py-1 text-xs font-semibold rounded ${status.color}`}
            >
              {status.label}
            </span>

            {/* Changes count */}
            {(additions > 0 || deletions > 0) && (
              <div className="flex items-center gap-2 text-sm font-mono">
                {additions > 0 && (
                  <span className="text-green-600 dark:text-green-400">
                    +{additions}
                  </span>
                )}
                {deletions > 0 && (
                  <span className="text-red-600 dark:text-red-400">
                    -{deletions}
                  </span>
                )}
              </div>
            )}

            {/* Done checkbox */}
            <button
              onClick={handleToggleDone}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isDone
                  ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
              }`}
              aria-label={isDone ? "Mark as not done" : "Mark as done"}
            >
              <Check
                className={`w-4 h-4 ${isDone ? "opacity-100" : "opacity-40"}`}
              />
              {isDone ? "Done" : "Mark Done"}
            </button>
          </div>
        </div>
      </div>

      {/* Diff content */}
      {expanded && (
        <div className="bg-white dark:bg-gray-900">
          {file.hunks && file.hunks.length > 0 ? (
            <Diff
              viewType="split"
              diffType={file.type || "modify"}
              hunks={file.hunks || []}
            >
              {(hunks: Hunk[]) =>
                hunks.map((hunk: Hunk) => (
                  <Hunk key={hunk.content} hunk={hunk} />
                ))
              }
            </Diff>
          ) : (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              {file.type === "add" && "New file added"}
              {file.type === "delete" && "File deleted"}
              {!file.type && "No changes to display"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
