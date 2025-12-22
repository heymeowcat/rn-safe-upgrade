"use client";

import { useState } from "react";
import Header from "@/components/Header";

import type { PackageJson } from "@/lib/types";
import { ArrowRight, FileCode2, Package } from "lucide-react";
import JsonUploader from "@/components/JsonUploader";
import VersionSelector from "@/components/VersionSelector";
import DependencyAnalyzer from "@/components/DependencyAnalyzer";
import RnDiffViewer from "@/components/RnDiffViewer";
import Footer from "@/components/Footer";

type Mode = "quick" | "full";

export default function Home() {
  const [mode, setMode] = useState<Mode>("quick");
  const [packageJson, setPackageJson] = useState<PackageJson | null>(null);
  const [currentVersion, setCurrentVersion] = useState<string>("");
  const [targetVersion, setTargetVersion] = useState<string>("");
  const [appName, setAppName] = useState<string | undefined>(undefined);
  const [appPackage, setAppPackage] = useState<string | undefined>(undefined);

  const handlePackageJsonLoad = (data: PackageJson) => {
    setPackageJson(data);

    if (data.name) {
      const extractedName = data.name
        .split(/[-_]/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join("");
      setAppName(extractedName);
      setAppPackage(`com.${extractedName.toLowerCase()}`);
    }

    const rnVersion =
      data.dependencies?.["react-native"] ||
      data.devDependencies?.["react-native"];
    if (rnVersion) {
      const cleanVersion = rnVersion.replace(/[\^~]/, "");
      setCurrentVersion(cleanVersion);
    }
  };

  const canShowDiff = currentVersion && targetVersion && currentVersion !== targetVersion;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900">
      <Header />

      <main className="flex-1">
        <section className="px-6 py-8 text-center">
          <div className="animate-fade-in">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
              Upgrade React Native
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-violet-600">
                Dependencies Safely
              </span>
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 mb-6 max-w-2xl mx-auto">
              View file changes between versions and get compatibility-checked
              recommendations for your target React Native version.
            </p>
          </div>

          <div className="flex justify-center gap-2 mb-6">
            <button
              onClick={() => setMode("quick")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                mode === "quick"
                  ? "bg-blue-600 text-white shadow-lg"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              <FileCode2 className="w-4 h-4" />
              Quick Mode
            </button>
            <button
              onClick={() => setMode("full")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                mode === "full"
                  ? "bg-blue-600 text-white shadow-lg"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              <Package className="w-4 h-4" />
              Full Analysis
            </button>
          </div>
        </section>

        <section className="px-6 pb-12">
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold mb-4">Select Versions</h2>
              <VersionSelector
                currentVersion={currentVersion}
                targetVersion={targetVersion}
                onCurrentChange={setCurrentVersion}
                onTargetChange={setTargetVersion}
              />
            </div>

            {mode === "full" && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 animate-slide-in">
                <h2 className="text-lg font-semibold mb-4">
                  Paste Your package.json
                  <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">
                    (for smart dependency analysis)
                  </span>
                </h2>
                <JsonUploader onPackageJsonLoad={handlePackageJsonLoad} />
                {appName && (
                  <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <p className="text-sm text-green-800 dark:text-green-200">
                      ✓ Detected app: <strong>{appName}</strong> — file paths will be updated accordingly
                    </p>
                  </div>
                )}
              </div>
            )}

            {canShowDiff && (
              <div className="animate-fade-in">
                {mode === "full" && packageJson ? (
                  <DependencyAnalyzer
                    packageJson={packageJson}
                    currentVersion={currentVersion}
                    targetVersion={targetVersion}
                    appName={appName}
                    appPackage={appPackage}
                  />
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-center gap-3 py-2">
                      <span className="font-mono font-semibold text-lg text-blue-600 dark:text-blue-400">
                        {currentVersion}
                      </span>
                      <ArrowRight className="w-5 h-5 text-gray-400" />
                      <span className="font-mono font-semibold text-lg text-violet-600 dark:text-violet-400">
                        {targetVersion}
                      </span>
                    </div>
                    <RnDiffViewer
                      fromVersion={currentVersion}
                      toVersion={targetVersion}
                      appName={appName}
                      appPackage={appPackage}
                    />
                  </div>
                )}
              </div>
            )}

            {!canShowDiff && (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <p>Select your current and target versions above to see the upgrade diff</p>
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
