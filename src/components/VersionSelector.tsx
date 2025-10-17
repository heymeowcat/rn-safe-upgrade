"use client";
import { ArrowRight } from "lucide-react";
interface VersionSelectorProps {
  currentVersion: string;
  targetVersion: string;
  onCurrentChange: (version: string) => void;
  onTargetChange: (version: string) => void;
}
const RN_VERSIONS = [
  "0.75.0",
  "0.74.0",
  "0.73.0",
  "0.72.0",
  "0.71.0",
  "0.70.0",
  "0.69.0",
  "0.68.0",
  "0.67.0",
  "0.66.0",
];
export default function VersionSelector({
  currentVersion,
  targetVersion,
  onCurrentChange,
  onTargetChange,
}: VersionSelectorProps) {
  return (
    <div className="space-y-6">
      {" "}
      <div className="grid md:grid-cols-[1fr_auto_1fr] gap-6 items-center">
        {" "}
        {/* Current Version */}{" "}
        <div>
          {" "}
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {" "}
            Current Version{" "}
          </label>{" "}
          <select
            value={currentVersion}
            onChange={(e) => onCurrentChange(e.target.value)}
            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-base"
          >
            {" "}
            <option value="">Select version...</option>{" "}
            {RN_VERSIONS.map((version) => (
              <option key={version} value={version}>
                {" "}
                {version}{" "}
              </option>
            ))}{" "}
          </select>{" "}
        </div>{" "}
        {/* Arrow */}{" "}
        <div className="hidden md:flex justify-center pt-7">
          {" "}
          <ArrowRight className="w-6 h-6 text-gray-400" />{" "}
        </div>{" "}
        {/* Target Version */}{" "}
        <div>
          {" "}
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {" "}
            Target Version{" "}
          </label>{" "}
          <select
            value={targetVersion}
            onChange={(e) => onTargetChange(e.target.value)}
            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-base"
          >
            {" "}
            <option value="">Select version...</option>{" "}
            {RN_VERSIONS.map((version) => (
              <option key={version} value={version}>
                {" "}
                {version}{" "}
              </option>
            ))}{" "}
          </select>{" "}
        </div>{" "}
      </div>{" "}
      {/* Version comparison */}{" "}
      {currentVersion && targetVersion && currentVersion !== targetVersion && (
        <div className="flex items-center justify-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm">
          {" "}
          <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
            {" "}
            {currentVersion}{" "}
          </span>{" "}
          <ArrowRight className="w-4 h-4 text-gray-400" />{" "}
          <span className="font-mono font-semibold text-violet-600 dark:text-violet-400">
            {" "}
            {targetVersion}{" "}
          </span>{" "}
        </div>
      )}{" "}
    </div>
  );
}
