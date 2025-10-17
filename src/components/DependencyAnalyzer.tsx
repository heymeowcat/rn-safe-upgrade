"use client";

import { useState, useEffect } from "react";
import {
  Loader2,
  Download,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Info,
} from "lucide-react";
import type { PackageJson, DependencyAnalysis } from "@/lib/types";
import { analyzeAllDependencies } from "@/lib/compatibilityChecker";
import DiffViewer from "./DiffViewer";

interface DependencyAnalyzerProps {
  packageJson: PackageJson;
  currentVersion: string;
  targetVersion: string;
}

export default function DependencyAnalyzer({
  packageJson,
  currentVersion,
  targetVersion,
}: DependencyAnalyzerProps) {
  const [analyzing, setAnalyzing] = useState(true);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<DependencyAnalysis[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "updates" | "breaking">("all");

  useEffect(() => {
    analyzePackages();
  }, [packageJson, currentVersion, targetVersion]);

  const analyzePackages = async () => {
    setAnalyzing(true);
    setError(null);

    try {
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      const analysisResults = await analyzeAllDependencies(
        allDeps,
        targetVersion,
        (current, total) => {
          setProgress({ current, total });
        }
      );

      setResults(analysisResults);
    } catch (err) {
      setError("Failed to analyze dependencies. Please try again.");
      console.error(err);
    } finally {
      setAnalyzing(false);
    }
  };

  const filteredResults = results.filter((result) => {
    if (filter === "updates") return result.needsUpdate;
    if (filter === "breaking") return result.hasBreakingChanges;
    return true;
  });

  const stats = {
    total: results.length,
    updates: results.filter((r) => r.needsUpdate).length,
    breaking: results.filter((r) => r.hasBreakingChanges).length,
    compatible: results.filter((r) => !r.needsUpdate).length,
  };

  const generateNewPackageJson = () => {
    const newPackageJson = { ...packageJson };

    // Update dependencies
    if (newPackageJson.dependencies) {
      results.forEach((result) => {
        if (newPackageJson.dependencies![result.package]) {
          newPackageJson.dependencies![
            result.package
          ] = `^${result.recommendedVersion}`;
        }
      });
    }

    // Update devDependencies
    if (newPackageJson.devDependencies) {
      results.forEach((result) => {
        if (newPackageJson.devDependencies![result.package]) {
          newPackageJson.devDependencies![
            result.package
          ] = `^${result.recommendedVersion}`;
        }
      });
    }

    // Update React Native version
    if (newPackageJson.dependencies?.["react-native"]) {
      newPackageJson.dependencies["react-native"] = targetVersion;
    }

    return newPackageJson;
  };

  const downloadPackageJson = () => {
    const newPackageJson = generateNewPackageJson();
    const blob = new Blob([JSON.stringify(newPackageJson, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "package.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = () => {
    const newPackageJson = generateNewPackageJson();
    navigator.clipboard.writeText(JSON.stringify(newPackageJson, null, 2));
  };

  if (analyzing) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8">
        <div className="flex flex-col items-center justify-center space-y-4">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-2">
              Analyzing Dependencies...
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Checking {progress.current} of {progress.total} packages
            </p>
            <div className="w-64 h-2 bg-gray-200 dark:bg-gray-700 rounded-full mt-4 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-600 to-purple-600 transition-all duration-300"
                style={{
                  width: `${(progress.current / progress.total) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <div className="flex items-center gap-3">
          <XCircle className="w-6 h-6 text-red-600" />
          <div>
            <h3 className="font-semibold text-red-800 dark:text-red-200">
              Analysis Failed
            </h3>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">
              {error}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Packages"
          value={stats.total}
          icon={Info}
          color="blue"
        />
        <StatCard
          label="Need Updates"
          value={stats.updates}
          icon={AlertTriangle}
          color="yellow"
        />
        <StatCard
          label="Breaking Changes"
          value={stats.breaking}
          icon={XCircle}
          color="red"
        />
        <StatCard
          label="Compatible"
          value={stats.compatible}
          icon={CheckCircle}
          color="green"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={downloadPackageJson}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Download className="w-4 h-4" />
          Download Updated package.json
        </button>
        <button
          onClick={copyToClipboard}
          className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          📋 Copy to Clipboard
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        <FilterTab
          label="All"
          count={stats.total}
          active={filter === "all"}
          onClick={() => setFilter("all")}
        />
        <FilterTab
          label="Updates"
          count={stats.updates}
          active={filter === "updates"}
          onClick={() => setFilter("updates")}
        />
        <FilterTab
          label="Breaking"
          count={stats.breaking}
          active={filter === "breaking"}
          onClick={() => setFilter("breaking")}
        />
      </div>

      {/* Dependency List */}
      <div className="space-y-3">
        {filteredResults.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No dependencies match the selected filter.
          </div>
        ) : (
          filteredResults.map((result) => (
            <DependencyCard key={result.package} analysis={result} />
          ))
        )}
      </div>

      {/* Diff Viewer */}
      <div className="mt-8">
        <h3 className="text-xl font-semibold mb-4">📄 package.json Diff</h3>
        <DiffViewer
          oldPackageJson={packageJson}
          newPackageJson={generateNewPackageJson()}
        />
      </div>
    </div>
  );
}

// Statistics Card Component
interface StatCardProps {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: "blue" | "yellow" | "red" | "green";
}

function StatCard({ label, value, icon: Icon, color }: StatCardProps) {
  const colorClasses = {
    blue: "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200",
    yellow:
      "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200",
    red: "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200",
    green: "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200",
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {label}
        </span>
        <Icon className="w-5 h-5 text-gray-400" />
      </div>
      <div className={`text-2xl font-bold ${colorClasses[color]}`}>{value}</div>
    </div>
  );
}

// Filter Tab Component
interface FilterTabProps {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}

function FilterTab({ label, count, active, onClick }: FilterTabProps) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 font-medium transition-colors ${
        active
          ? "text-blue-600 border-b-2 border-blue-600"
          : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
      }`}
    >
      {label} ({count})
    </button>
  );
}

// Dependency Card Component
interface DependencyCardProps {
  analysis: DependencyAnalysis;
}

function DependencyCard({ analysis }: DependencyCardProps) {
  const [expanded, setExpanded] = useState(false);

  const getStatusColor = () => {
    if (analysis.hasBreakingChanges)
      return "border-red-500 bg-red-50 dark:bg-red-900/20";
    if (analysis.needsUpdate)
      return "border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20";
    return "border-green-500 bg-green-50 dark:bg-green-900/20";
  };

  const getStatusIcon = () => {
    if (analysis.hasBreakingChanges)
      return <XCircle className="w-5 h-5 text-red-600" />;
    if (analysis.needsUpdate)
      return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
    return <CheckCircle className="w-5 h-5 text-green-600" />;
  };

  return (
    <div className={`border-l-4 rounded-lg p-4 ${getStatusColor()}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            {getStatusIcon()}
            <h4 className="font-mono font-semibold text-lg">
              {analysis.package}
            </h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-400">Current:</span>
              <span className="ml-2 font-mono">{analysis.currentVersion}</span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">
                Recommended:
              </span>
              <span className="ml-2 font-mono font-semibold text-blue-600">
                {analysis.recommendedVersion}
              </span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Latest:</span>
              <span className="ml-2 font-mono">{analysis.latestVersion}</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="ml-4 text-sm text-blue-600 hover:text-blue-800"
        >
          {expanded ? "Less" : "More"}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-300 dark:border-gray-700">
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
            <strong>Reason:</strong> {analysis.reason}
          </p>
          {analysis.hasBreakingChanges && (
            <div className="bg-red-100 dark:bg-red-900/40 border border-red-300 dark:border-red-700 rounded p-3 mt-2">
              <p className="text-sm text-red-800 dark:text-red-200">
                ⚠️ <strong>Breaking Changes Detected:</strong> Review the
                changelog before upgrading.
              </p>
            </div>
          )}
          {analysis.changelogUrl && (
            <a
              href={analysis.changelogUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 text-sm text-blue-600 hover:text-blue-800 underline"
            >
              View Changelog on npm →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
