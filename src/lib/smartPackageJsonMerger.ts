import type { PackageJson, DependencyAnalysis } from "./types";

// Core RN packages that should use rn-diff-purge's recommended versions
const CORE_RN_PACKAGES = [
  "react",
  "react-native",
  "react-dom",
  "react-test-renderer",
  "@react-native/babel-preset",
  "@react-native/eslint-config", 
  "@react-native/metro-config",
  "@react-native/typescript-config",
  "@react-native/new-app-screen",
  "@react-native-community/cli",
  "@react-native-community/cli-platform-android",
  "@react-native-community/cli-platform-ios",
];

/**
 * Fetch the target version's package.json from rn-diff-purge
 */
export async function fetchRnDiffPurgePackageJson(version: string): Promise<PackageJson | null> {
  try {
    const cleanVersion = version.replace(/[\^~]/g, "");
    const url = `https://raw.githubusercontent.com/react-native-community/rn-diff-purge/diffs/RnDiffApp/release/${cleanVersion}/package.json`;
    
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Could not fetch rn-diff-purge package.json for ${version}`);
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error fetching rn-diff-purge package.json:", error);
    return null;
  }
}

/**
 * Smart merge that combines:
 * 1. User's package.json as the base (name, version, description, scripts, etc.)
 * 2. rn-diff-purge's core RN package versions
 * 3. Our dependency analysis for the user's other packages
 */
export function createSmartMergedPackageJson(
  userPackageJson: PackageJson,
  rnDiffPurgePackageJson: PackageJson | null,
  dependencyAnalysis: DependencyAnalysis[],
  targetRNVersion: string
): PackageJson {
  const merged: PackageJson = JSON.parse(JSON.stringify(userPackageJson));
  
  const analysisMap = new Map<string, DependencyAnalysis>();
  dependencyAnalysis.forEach((a) => analysisMap.set(a.package, a));
  
  // Get rn-diff-purge's recommended versions for core packages
  const rnDiffDeps = rnDiffPurgePackageJson?.dependencies || {};
  const rnDiffDevDeps = rnDiffPurgePackageJson?.devDependencies || {};
  
  if (merged.dependencies) {
    Object.keys(merged.dependencies).forEach((pkgName) => {
      if (isCoreRNPackage(pkgName)) {
        // Use rn-diff-purge's version for core packages
        const rnDiffVersion = rnDiffDeps[pkgName] || rnDiffDevDeps[pkgName];
        if (rnDiffVersion) {
          merged.dependencies![pkgName] = rnDiffVersion;
        } else if (pkgName === "react-native") {
          merged.dependencies![pkgName] = targetRNVersion;
        }
      } else {
        // Use our analysis for non-core packages
        const analysis = analysisMap.get(pkgName);
        if (analysis && analysis.needsUpdate) {
          merged.dependencies![pkgName] = `^${analysis.recommendedVersion}`;
        }
        // If no update needed, keep current version
      }
    });
  }
  
  if (merged.devDependencies) {
    Object.keys(merged.devDependencies).forEach((pkgName) => {
      if (isCoreRNPackage(pkgName)) {
        // Use rn-diff-purge's version for core packages
        const rnDiffVersion = rnDiffDevDeps[pkgName] || rnDiffDeps[pkgName];
        if (rnDiffVersion) {
          merged.devDependencies![pkgName] = rnDiffVersion;
        }
      } else {
        // Use our analysis for non-core packages
        const analysis = analysisMap.get(pkgName);
        if (analysis && analysis.needsUpdate) {
          merged.devDependencies![pkgName] = `^${analysis.recommendedVersion}`;
        }
        // If no update needed, keep current version
      }
    });
  }
  
  return merged;
}

/**
 * Check if a package is a core React Native package
 */
function isCoreRNPackage(packageName: string): boolean {
  if (CORE_RN_PACKAGES.includes(packageName)) {
    return true;
  }
  // Also match @react-native/* scoped packages
  if (packageName.startsWith("@react-native/")) {
    return true;
  }
  // Match @react-native-community/cli* packages
  if (packageName.startsWith("@react-native-community/cli")) {
    return true;
  }
  return false;
}


export function generatePackageJsonDiff(
  originalPackageJson: PackageJson,
  mergedPackageJson: PackageJson
): string {
  const originalStr = JSON.stringify(originalPackageJson, null, 2);
  const mergedStr = JSON.stringify(mergedPackageJson, null, 2);
  
  if (originalStr === mergedStr) {
    return ""; // No changes
  }
  
  const originalLines = originalStr.split("\n");
  const mergedLines = mergedStr.split("\n");
  
  let diff = `diff --git a/package.json b/package.json
index 0000000..1111111 100644
--- a/package.json
+++ b/package.json
`;

 
  const hunkLines: string[] = [];
  const maxLines = Math.max(originalLines.length, mergedLines.length);
  
  for (let i = 0; i < maxLines; i++) {
    const origLine = originalLines[i] ?? "";
    const modLine = mergedLines[i] ?? "";

    if (origLine !== modLine) {
      if (origLine && modLine) {
        hunkLines.push(`-${origLine}`);
        hunkLines.push(`+${modLine}`);
      } else if (origLine && !modLine) {
        hunkLines.push(`-${origLine}`);
      } else if (!origLine && modLine) {
        hunkLines.push(`+${modLine}`);
      }
    } else {
      hunkLines.push(` ${origLine}`);
    }
  }

  const added = hunkLines.filter((l) => l.startsWith("+")).length;
  const removed = hunkLines.filter((l) => l.startsWith("-")).length;
  const context = hunkLines.filter((l) => l.startsWith(" ")).length;
  
  diff += `@@ -1,${removed + context} +1,${added + context} @@\n`;
  diff += hunkLines.join("\n") + "\n";

  return diff;
}
