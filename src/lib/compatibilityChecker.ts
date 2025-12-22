import semver from "semver";
import type { DependencyAnalysis, NpmPackageInfo } from "./types";
import { fetchPackageInfo, getLatestVersion } from "./npmApi";

const CONCURRENCY_LIMIT = 5;

export async function analyzeDependency(
  packageName: string,
  currentVersion: string,
  targetRNVersion: string
): Promise<DependencyAnalysis> {
  if (packageName === "react-native") {
    return {
      package: packageName,
      currentVersion,
      recommendedVersion: targetRNVersion,
      latestVersion: targetRNVersion,
      needsUpdate: currentVersion !== targetRNVersion,
      hasBreakingChanges: false,
      compatibilityStatus: "compatible",
      reason: "React Native core package",
    };
  }

  const packageInfo = await fetchPackageInfo(packageName);

  if (!packageInfo) {
    return {
      package: packageName,
      currentVersion,
      recommendedVersion: currentVersion,
      latestVersion: "unknown",
      needsUpdate: false,
      hasBreakingChanges: false,
      compatibilityStatus: "unknown",
      reason: "Could not fetch package information from npm",
    };
  }

  const latestVersion = getLatestVersion(packageInfo);

  const recommendedVersion = findCompatibleVersion(
    packageInfo,
    targetRNVersion,
    currentVersion
  );

  return createAnalysis(
    packageName,
    currentVersion,
    recommendedVersion,
    latestVersion,
    packageInfo,
    targetRNVersion
  );
}

function findCompatibleVersion(
  packageInfo: NpmPackageInfo,
  targetRNVersion: string,
  currentVersion: string
): string {
  const currentClean = semver.coerce(currentVersion)?.version || currentVersion;
  
  const allVersions = Object.keys(packageInfo.versions)
    .filter((v) => {
      if (!semver.valid(v)) return false;
      const prerelease = semver.prerelease(v);
      if (prerelease) {
        const tag = String(prerelease[0] || "").toLowerCase();
        if (tag.includes("nightly") || tag.includes("canary") || 
            tag.includes("alpha") || tag.includes("beta") || 
            tag.includes("rc") || tag.includes("dev") ||
            tag.includes("next") || tag.includes("experimental")) {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => semver.rcompare(a, b));

  const isCompatibleWithRN = (version: string): boolean => {
    const versionInfo = packageInfo.versions[version];
    const peerDeps = versionInfo?.peerDependencies;
    
    // If no RN peer dep, consider it compatible
    if (!peerDeps?.["react-native"]) {
      return true;
    }
    
    try {
      if (!semver.satisfies(targetRNVersion, peerDeps["react-native"])) {
        return false;
      }
      
      // Also check React compatibility
      const reactPeerDep = peerDeps["react"];
      if (reactPeerDep) {
        const reactVersion = getReactVersionForRN(targetRNVersion);
        if (reactVersion && !semver.satisfies(reactVersion, reactPeerDep)) {
          return false;
        }
      }
      
      return true;
    } catch {
      return false;
    }
  };

  if (allVersions.includes(currentClean) && isCompatibleWithRN(currentClean)) {
    return currentClean;
  }

  const upgradeVersions = allVersions.filter((v) => {
    try {
      return semver.gte(v, currentClean);
    } catch {
      return false;
    }
  });

  // Sort upgrade candidates from lowest to highest (minimal upgrade first)
  upgradeVersions.sort((a, b) => semver.compare(a, b));
  
  for (const version of upgradeVersions) {
    if (isCompatibleWithRN(version)) {
      return version;
    }
  }

  const currentInfo = packageInfo.versions[currentClean];
  if (!currentInfo?.peerDependencies?.["react-native"]) {
    // No RN peer dep requirement, keep current
    return currentClean;
  }

  for (const version of allVersions) {
    if (isCompatibleWithRN(version)) {
      return version;
    }
  }

  return currentClean;
}

function getReactVersionForRN(rnVersion: string): string | null {
  const rnToReact: Record<string, string> = {
    "0.76": "18.3.1",
    "0.75": "18.2.0",
    "0.74": "18.2.0",
    "0.73": "18.2.0",
    "0.72": "18.2.0",
    "0.71": "18.2.0",
    "0.70": "18.1.0",
    "0.69": "18.0.0",
    "0.68": "17.0.2",
  };

  const majorMinor = rnVersion.split(".").slice(0, 2).join(".");
  return rnToReact[majorMinor] || null;
}

function createAnalysis(
  packageName: string,
  currentVersion: string,
  recommendedVersion: string,
  latestVersion: string,
  packageInfo: NpmPackageInfo,
  targetRNVersion: string
): DependencyAnalysis {
  const current = semver.coerce(currentVersion)?.version || currentVersion;
  const recommended =
    semver.coerce(recommendedVersion)?.version || recommendedVersion;

  const needsUpdate = current !== recommended;
  
  let hasBreakingChanges = false;
  try {
    hasBreakingChanges =
      needsUpdate && semver.major(recommended) > semver.major(current);
  } catch {
    hasBreakingChanges = false;
  }

  let compatibilityStatus: DependencyAnalysis["compatibilityStatus"] =
    "compatible";
  let reason = "Compatible with target React Native version";

  const recInfo = packageInfo.versions[recommendedVersion];
  const peerDeps = recInfo?.peerDependencies;

  if (peerDeps?.["react-native"]) {
    try {
      if (!semver.satisfies(targetRNVersion, peerDeps["react-native"])) {
        compatibilityStatus = "warning";
        reason = `Peer dependency requires react-native ${peerDeps["react-native"]}`;
      }
    } catch {
      // Invalid semver range
    }
  }

  if (hasBreakingChanges) {
    compatibilityStatus = "warning";
    reason = `Major version change from ${semver.major(current)} to ${semver.major(recommended)} - review changelog`;
  } else if (needsUpdate) {
    reason = "Updated for compatibility";
  }

  return {
    package: packageName,
    currentVersion,
    recommendedVersion,
    latestVersion,
    needsUpdate,
    hasBreakingChanges,
    compatibilityStatus,
    reason,
    changelogUrl: `https://www.npmjs.com/package/${packageName}?activeTab=versions`,
  };
}

async function runWithConcurrency<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency: number,
  onProgress?: (current: number, total: number) => void
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;
  let completedCount = 0;

  async function processNext(): Promise<void> {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      const item = items[index];
      
      try {
        results[index] = await fn(item, index);
      } catch (error) {
        console.error(`Error processing item at index ${index}:`, error);
        throw error;
      }
      
      completedCount++;
      if (onProgress) {
        onProgress(completedCount, items.length);
      }
    }
  }

  const workers = Array(Math.min(concurrency, items.length))
    .fill(null)
    .map(() => processNext());

  await Promise.all(workers);
  return results;
}

export async function analyzeAllDependencies(
  dependencies: Record<string, string>,
  targetRNVersion: string,
  onProgress?: (current: number, total: number) => void
): Promise<DependencyAnalysis[]> {
  const entries = Object.entries(dependencies);
  
  if (onProgress) {
    onProgress(0, entries.length);
  }

  const results = await runWithConcurrency(
    entries,
    async ([packageName, version]) => {
      return analyzeDependency(packageName, version, targetRNVersion);
    },
    CONCURRENCY_LIMIT,
    onProgress
  );

  return results;
}
