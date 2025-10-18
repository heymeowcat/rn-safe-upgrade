import type { PackageJson, DependencyAnalysis } from "./types";

interface MergedPackageJson {
  original: PackageJson;
  upgraded: PackageJson;
  diffText: string;
}

/**
 * Merge user's package.json with dependency analysis results
 * and generate a unified diff
 */
export function mergePackageJsonWithAnalysis(
  userPackageJson: PackageJson,
  dependencyAnalysis: DependencyAnalysis[],
  targetRNVersion: string
): MergedPackageJson {
  // Create upgraded version
  const upgraded: PackageJson = JSON.parse(JSON.stringify(userPackageJson));

  // Create a map of analysis results for quick lookup
  const analysisMap = new Map<string, DependencyAnalysis>();
  dependencyAnalysis.forEach((analysis) => {
    analysisMap.set(analysis.package, analysis);
  });

  // Update dependencies
  if (upgraded.dependencies) {
    Object.keys(upgraded.dependencies).forEach((pkgName) => {
      if (pkgName === "react-native") {
        // Update React Native to target version
        upgraded.dependencies![pkgName] = targetRNVersion;
      } else {
        // Update other dependencies based on analysis
        const analysis = analysisMap.get(pkgName);
        if (analysis && analysis.needsUpdate) {
          upgraded.dependencies![pkgName] = `^${analysis.recommendedVersion}`;
        }
      }
    });
  }

  // Update devDependencies
  if (upgraded.devDependencies) {
    Object.keys(upgraded.devDependencies).forEach((pkgName) => {
      const analysis = analysisMap.get(pkgName);
      if (analysis && analysis.needsUpdate) {
        upgraded.devDependencies![pkgName] = `^${analysis.recommendedVersion}`;
      }
    });
  }

  // Generate unified diff text
  const diffText = generatePackageJsonDiff(userPackageJson, upgraded);

  return {
    original: userPackageJson,
    upgraded,
    diffText,
  };
}

/**
 * Generate a unified diff format for package.json changes
 */
function generatePackageJsonDiff(
  original: PackageJson,
  upgraded: PackageJson
): string {
  const originalStr = JSON.stringify(original, null, 2);
  const upgradedStr = JSON.stringify(upgraded, null, 2);

  const originalLines = originalStr.split("\n");
  const upgradedLines = upgradedStr.split("\n");

  let diff = `diff --git a/package.json b/package.json
index 0000000..1111111 100644
--- a/package.json
+++ b/package.json
`;

  // Find differences
  const maxLines = Math.max(originalLines.length, upgradedLines.length);
  let hunkStart = -1;
  let hunkLines: string[] = [];

  for (let i = 0; i < maxLines; i++) {
    const origLine = originalLines[i] || "";
    const upgLine = upgradedLines[i] || "";

    if (origLine !== upgLine) {
      if (hunkStart === -1) {
        hunkStart = i;
      }

      // Add context (3 lines before if available)
      if (hunkLines.length === 0 && i > 0) {
        const contextStart = Math.max(0, i - 3);
        for (let j = contextStart; j < i; j++) {
          hunkLines.push(` ${originalLines[j]}`);
        }
      }

      if (origLine && !upgLine) {
        hunkLines.push(`-${origLine}`);
      } else if (!origLine && upgLine) {
        hunkLines.push(`+${upgLine}`);
      } else {
        hunkLines.push(`-${origLine}`);
        hunkLines.push(`+${upgLine}`);
      }
    } else if (hunkLines.length > 0) {
      // Add context after changes
      hunkLines.push(` ${origLine}`);

      // If we have 3 lines of context after changes, close the hunk
      const contextAfter = hunkLines.filter(
        (l, idx) =>
          idx >
            hunkLines.findLastIndex(
              (line) => line.startsWith("-") || line.startsWith("+")
            ) && l.startsWith(" ")
      ).length;

      if (contextAfter >= 3) {
        // Output hunk
        const addedCount = hunkLines.filter((l) => l.startsWith("+")).length;
        const removedCount = hunkLines.filter((l) => l.startsWith("-")).length;
        const contextCount = hunkLines.filter((l) => l.startsWith(" ")).length;

        diff += `@@ -${hunkStart + 1},${removedCount + contextCount} +${
          hunkStart + 1
        },${addedCount + contextCount} @@\n`;
        diff += hunkLines.join("\n") + "\n";

        hunkStart = -1;
        hunkLines = [];
      }
    }
  }

  // Output remaining hunk if any
  if (hunkLines.length > 0) {
    const addedCount = hunkLines.filter((l) => l.startsWith("+")).length;
    const removedCount = hunkLines.filter((l) => l.startsWith("-")).length;
    const contextCount = hunkLines.filter((l) => l.startsWith(" ")).length;

    diff += `@@ -${hunkStart + 1},${removedCount + contextCount} +${
      hunkStart + 1
    },${addedCount + contextCount} @@\n`;
    diff += hunkLines.join("\n") + "\n";
  }

  return diff;
}

/**
 * Get summary of changes in package.json
 */
export function getPackageJsonChangeSummary(
  original: PackageJson,
  upgraded: PackageJson
): {
  updated: string[];
  added: string[];
  removed: string[];
  unchanged: string[];
} {
  const updated: string[] = [];
  const added: string[] = [];
  const removed: string[] = [];
  const unchanged: string[] = [];

  const allDeps = new Set([
    ...Object.keys(original.dependencies || {}),
    ...Object.keys(original.devDependencies || {}),
    ...Object.keys(upgraded.dependencies || {}),
    ...Object.keys(upgraded.devDependencies || {}),
  ]);

  allDeps.forEach((pkgName) => {
    const origVersion =
      original.dependencies?.[pkgName] || original.devDependencies?.[pkgName];

    const upgVersion =
      upgraded.dependencies?.[pkgName] || upgraded.devDependencies?.[pkgName];

    if (!origVersion && upgVersion) {
      added.push(pkgName);
    } else if (origVersion && !upgVersion) {
      removed.push(pkgName);
    } else if (origVersion !== upgVersion) {
      updated.push(pkgName);
    } else {
      unchanged.push(pkgName);
    }
  });

  return { updated, added, removed, unchanged };
}

/**
 * Create a download-ready package.json with comments
 */
export function createAnnotatedPackageJson(
  upgraded: PackageJson,
  dependencyAnalysis: DependencyAnalysis[]
): string {
  const analysisMap = new Map<string, DependencyAnalysis>();
  dependencyAnalysis.forEach((analysis) => {
    analysisMap.set(analysis.package, analysis);
  });

  let output = "{\n";

  // Add basic fields
  const basicFields = ["name", "version", "description", "main", "scripts"];
  basicFields.forEach((field) => {
    if (upgraded[field]) {
      output += `  "${field}": ${JSON.stringify(upgraded[field], null, 2)
        .split("\n")
        .join("\n  ")},\n`;
    }
  });

  // Add dependencies with comments
  if (upgraded.dependencies) {
    output += '  "dependencies": {\n';
    const deps = Object.entries(upgraded.dependencies);
    deps.forEach(([pkgName, version], index) => {
      const analysis = analysisMap.get(pkgName);
      let comment = "";

      if (analysis?.hasBreakingChanges) {
        comment = " // ⚠️ Breaking changes - review changelog";
      } else if (analysis?.needsUpdate) {
        comment = " // ✅ Updated for compatibility";
      }

      const comma = index < deps.length - 1 ? "," : "";
      output += `    "${pkgName}": "${version}"${comma}${comment}\n`;
    });
    output += "  },\n";
  }

  // Add devDependencies with comments
  if (upgraded.devDependencies) {
    output += '  "devDependencies": {\n';
    const devDeps = Object.entries(upgraded.devDependencies);
    devDeps.forEach(([pkgName, version], index) => {
      const analysis = analysisMap.get(pkgName);
      let comment = "";

      if (analysis?.hasBreakingChanges) {
        comment = " // ⚠️ Breaking changes - review changelog";
      } else if (analysis?.needsUpdate) {
        comment = " // ✅ Updated for compatibility";
      }

      const comma = index < devDeps.length - 1 ? "," : "";
      output += `    "${pkgName}": "${version}"${comma}${comment}\n`;
    });
    output += "  }\n";
  }

  output += "}";
  return output;
}
