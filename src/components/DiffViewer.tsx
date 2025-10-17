"use client";

import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { PackageJson } from "@/lib/types";

interface DiffViewerProps {
  oldPackageJson: PackageJson;
  newPackageJson: PackageJson;
}

export default function DiffViewer({
  oldPackageJson,
  newPackageJson,
}: DiffViewerProps) {
  const [collapsed, setCollapsed] = useState(false);

  // Generate diff data
  const diffData = useMemo(() => {
    const changes: Array<{
      type: "added" | "removed" | "modified" | "unchanged";
      package: string;
      oldVersion?: string;
      newVersion?: string;
    }> = [];

    const allPackages = new Set([
      ...Object.keys(oldPackageJson.dependencies || {}),
      ...Object.keys(oldPackageJson.devDependencies || {}),
      ...Object.keys(newPackageJson.dependencies || {}),
      ...Object.keys(newPackageJson.devDependencies || {}),
    ]);

    allPackages.forEach((pkg) => {
      const oldVersion =
        oldPackageJson.dependencies?.[pkg] ||
        oldPackageJson.devDependencies?.[pkg];
      const newVersion =
        newPackageJson.dependencies?.[pkg] ||
        newPackageJson.devDependencies?.[pkg];

      if (!oldVersion && newVersion) {
        changes.push({ type: "added", package: pkg, newVersion });
      } else if (oldVersion && !newVersion) {
        changes.push({ type: "removed", package: pkg, oldVersion });
      } else if (oldVersion !== newVersion) {
        changes.push({
          type: "modified",
          package: pkg,
          oldVersion,
          newVersion,
        });
      } else {
        changes.push({
          type: "unchanged",
          package: pkg,
          oldVersion,
          newVersion,
        });
      }
    });

    return changes;
  }, [oldPackageJson, newPackageJson]);

  const stats = {
    modified: diffData.filter((d) => d.type === "modified").length,
    added: diffData.filter((d) => d.type === "added").length,
    removed: diffData.filter((d) => d.type === "removed").length,
    unchanged: diffData.filter((d) => d.type === "unchanged").length,
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-3">
          {collapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
          <h3 className="font-semibold">Dependencies Changes</h3>
        </div>
        <div className="flex gap-4 text-sm">
          <span className="text-green-600">
            +{stats.added + stats.modified}
          </span>
          <span className="text-red-600">-{stats.removed}</span>
          <span className="text-gray-500">{stats.unchanged} unchanged</span>
        </div>
      </div>

      {/* Diff content */}
      {!collapsed && (
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {diffData
            .filter((d) => d.type !== "unchanged")
            .map((change, index) => (
              <DiffLine key={index} change={change} />
            ))}

          {stats.modified === 0 && stats.added === 0 && stats.removed === 0 && (
            <div className="p-4 text-center text-gray-500">
              No changes detected
            </div>
          )}
        </div>
      )}

      {/* Show unchanged (collapsed by default) */}
      {!collapsed && stats.unchanged > 0 && (
        <details className="border-t border-gray-200 dark:border-gray-700">
          <summary className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-gray-600 dark:text-gray-400">
            Show {stats.unchanged} unchanged dependencies
          </summary>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {diffData
              .filter((d) => d.type === "unchanged")
              .map((change, index) => (
                <DiffLine key={index} change={change} />
              ))}
          </div>
        </details>
      )}
    </div>
  );
}

// Individual diff line component
interface DiffLineProps {
  change: {
    type: "added" | "removed" | "modified" | "unchanged";
    package: string;
    oldVersion?: string;
    newVersion?: string;
  };
}

function DiffLine({ change }: DiffLineProps) {
  const getLineStyle = () => {
    switch (change.type) {
      case "added":
        return "bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500";
      case "removed":
        return "bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500";
      case "modified":
        return "bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500";
      default:
        return "bg-gray-50 dark:bg-gray-800";
    }
  };

  const getIcon = () => {
    switch (change.type) {
      case "added":
        return <span className="text-green-600 font-bold">+</span>;
      case "removed":
        return <span className="text-red-600 font-bold">-</span>;
      case "modified":
        return <span className="text-blue-600 font-bold">~</span>;
      default:
        return <span className="text-gray-400"> </span>;
    }
  };

  return (
    <div className={`p-4 font-mono text-sm ${getLineStyle()}`}>
      <div className="flex items-center gap-4">
        <span className="w-4">{getIcon()}</span>
        <span className="flex-1 font-semibold">{change.package}</span>

        {change.type === "modified" && (
          <div className="flex items-center gap-2">
            <span className="text-red-600 line-through">
              {change.oldVersion}
            </span>
            <span className="text-gray-400">→</span>
            <span className="text-green-600 font-semibold">
              {change.newVersion}
            </span>
          </div>
        )}

        {change.type === "added" && (
          <span className="text-green-600 font-semibold">
            {change.newVersion}
          </span>
        )}

        {change.type === "removed" && (
          <span className="text-red-600">{change.oldVersion}</span>
        )}

        {change.type === "unchanged" && (
          <span className="text-gray-600">{change.oldVersion}</span>
        )}
      </div>
    </div>
  );
}
