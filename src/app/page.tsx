"use client";

import { useState } from "react";
import Header from "@/components/Header";

import type { PackageJson } from "@/lib/types";
import { ArrowRight } from "lucide-react";
import JsonUploader from "@/components/JsonUploader";
import VersionSelector from "@/components/VersionSelector";
import DependencyAnalyzer from "@/components/DependencyAnalyzer";
import Footer from "@/components/Footer";

export default function Home() {
  const [packageJson, setPackageJson] = useState<PackageJson | null>(null);
  const [currentVersion, setCurrentVersion] = useState<string>("");
  const [targetVersion, setTargetVersion] = useState<string>("");
  const [showResults, setShowResults] = useState(false);

  const handlePackageJsonLoad = (data: PackageJson) => {
    setPackageJson(data);
    setShowResults(false);

    const rnVersion =
      data.dependencies?.["react-native"] ||
      data.devDependencies?.["react-native"];
    if (rnVersion) {
      const cleanVersion = rnVersion.replace(/[\^~]/, "");
      setCurrentVersion(cleanVersion);
    }
  };

  const handleAnalyze = () => {
    if (packageJson && currentVersion && targetVersion) {
      setShowResults(true);
    }
  };

  const canAnalyze =
    packageJson &&
    currentVersion &&
    targetVersion &&
    currentVersion !== targetVersion;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900">
      <Header />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="container mx-auto px-4 py-16 max-w-4xl text-center">
          <div className="animate-fade-in">
            <h1 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight">
              Upgrade React Native
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-violet-600">
                Dependencies Safely
              </span>
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-400 mb-12 max-w-2xl mx-auto">
              Analyze your package.json and get compatibility-checked
              recommendations for your target React Native version.
            </p>
          </div>
        </section>

        {/* Main Content */}
        <section className="container mx-auto px-4 pb-16 max-w-5xl">
          <div className="space-y-8">
            {/* Step 1 */}
            <div className="animate-fade-in">
              <StepHeader number={1} title="Paste Your package.json" />
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <JsonUploader onPackageJsonLoad={handlePackageJsonLoad} />
              </div>
            </div>

            {/* Step 2 */}
            {packageJson && (
              <div className="animate-slide-in">
                <StepHeader number={2} title="Select Target Version" />
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                  <VersionSelector
                    currentVersion={currentVersion}
                    targetVersion={targetVersion}
                    onCurrentChange={setCurrentVersion}
                    onTargetChange={setTargetVersion}
                  />
                </div>
              </div>
            )}

            {/* Analyze Button */}
            {packageJson && (
              <div className="text-center animate-slide-in">
                <button
                  onClick={handleAnalyze}
                  disabled={!canAnalyze}
                  className={`group inline-flex items-center gap-3 px-8 py-4 rounded-xl font-semibold text-lg shadow-lg transition-all ${
                    canAnalyze
                      ? "bg-gradient-to-r from-blue-600 to-violet-600 text-white hover:shadow-xl hover:scale-105 active:scale-100"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  Analyze Dependencies
                  <ArrowRight
                    className={`w-5 h-5 transition-transform ${
                      canAnalyze ? "group-hover:translate-x-1" : ""
                    }`}
                  />
                </button>
                {!canAnalyze && currentVersion === targetVersion && (
                  <p className="text-sm text-gray-500 mt-3">
                    Please select a different target version
                  </p>
                )}
              </div>
            )}

            {/* Step 3 - Results */}
            {showResults && packageJson && (
              <div className="animate-fade-in">
                <StepHeader number={3} title="Review Changes" />
                <DependencyAnalyzer
                  packageJson={packageJson}
                  currentVersion={currentVersion}
                  targetVersion={targetVersion}
                />
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

// Step Header Component
function StepHeader({ number, title }: { number: number; title: string }) {
  return (
    <div className="flex items-center gap-4 mb-4">
      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-r from-blue-600 to-violet-600 text-white font-bold shadow-md">
        {number}
      </div>
      <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
        {title}
      </h2>
    </div>
  );
}
