import type { PackageJson, DependencyAnalysis } from "./types";

/**
 * Fetch the target version's package.json from rn-diff-purge
 */
export async function fetchRnDiffPurgePackageJson(version: string): Promise<PackageJson | null> {
  const cleanVersion = version.replace(/[\^~]/g, "");
  
  // Correct URL structure for rn-diff-purge repository
  const url = `https://raw.githubusercontent.com/react-native-community/rn-diff-purge/release/${cleanVersion}/RnDiffApp/package.json`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`[SmartMerge] Could not fetch rn-diff-purge package.json for ${version}: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    console.log(`[SmartMerge] Successfully fetched template for RN ${version}`);
    return data;
  } catch (error) {
    console.error("[SmartMerge] Error fetching rn-diff-purge package.json:", error);
    return null;
  }
}

/**
 * Create a merged package.json that:
 * 1. Keeps user's package structure (name, scripts, etc.)
 * 2. Updates packages that exist in both user's and standard template to template versions
 * 3. Updates remaining packages based on dependency analysis
 */
export function createSmartMergedPackageJson(
  userPackageJson: PackageJson,
  templatePackageJson: PackageJson | null,
  dependencyAnalysis: DependencyAnalysis[],
  targetRNVersion: string
): PackageJson {
  const merged: PackageJson = JSON.parse(JSON.stringify(userPackageJson));
  
  // Build analysis map for quick lookup
  const analysisMap = new Map<string, DependencyAnalysis>();
  dependencyAnalysis.forEach((a) => analysisMap.set(a.package, a));
  
  // Build template versions map (both deps and devDeps combined)
  const templateVersions = new Map<string, string>();
  if (templatePackageJson) {
    Object.entries(templatePackageJson.dependencies || {}).forEach(([k, v]) => templateVersions.set(k, v));
    Object.entries(templatePackageJson.devDependencies || {}).forEach(([k, v]) => templateVersions.set(k, v));
  }

  // Update dependencies
  if (merged.dependencies) {
    for (const pkgName of Object.keys(merged.dependencies)) {
      // If package exists in template, use template version
      if (templateVersions.has(pkgName)) {
        merged.dependencies[pkgName] = templateVersions.get(pkgName)!;
      }
      // Special case: always update react-native to target version
      else if (pkgName === "react-native") {
        merged.dependencies[pkgName] = targetRNVersion;
      }
      // Otherwise check if analysis recommends an update
      else {
        const analysis = analysisMap.get(pkgName);
        if (analysis?.needsUpdate && analysis.recommendedVersion) {
          merged.dependencies[pkgName] = `^${analysis.recommendedVersion}`;
        }
      }
    }
  }

  // Update devDependencies
  if (merged.devDependencies) {
    for (const pkgName of Object.keys(merged.devDependencies)) {
      // If package exists in template, use template version
      if (templateVersions.has(pkgName)) {
        merged.devDependencies[pkgName] = templateVersions.get(pkgName)!;
      }
      // Otherwise check if analysis recommends an update
      else {
        const analysis = analysisMap.get(pkgName);
        if (analysis?.needsUpdate && analysis.recommendedVersion) {
          merged.devDependencies[pkgName] = `^${analysis.recommendedVersion}`;
        }
      }
    }
  }

  return merged;
}

/**
 * Generate a unified diff between original and merged package.json
 */
export function generatePackageJsonDiff(
  originalPackageJson: PackageJson,
  mergedPackageJson: PackageJson
): string {
  const originalStr = JSON.stringify(originalPackageJson, null, 2);
  const mergedStr = JSON.stringify(mergedPackageJson, null, 2);
  
  if (originalStr === mergedStr) {
    return "";
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
