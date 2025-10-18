import semver from "semver";
import type { DependencyAnalysis, NpmPackageInfo } from "./types";
import { fetchPackageInfo, getLatestVersion } from "./npmApi";

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

  const recommendedVersion = await findCompatibleVersion(
    packageInfo,
    targetRNVersion
  );

  return createAnalysis(
    packageName,
    currentVersion,
    recommendedVersion,
    latestVersion,
    "Based on peer dependency analysis"
  );
}

async function findCompatibleVersion(
  packageInfo: NpmPackageInfo,
  targetRNVersion: string
): Promise<string> {
  const versions = Object.keys(packageInfo.versions).sort((a, b) =>
    semver.rcompare(a, b)
  );

  for (const version of versions) {
    const versionInfo = packageInfo.versions[version];
    const peerDeps = versionInfo.peerDependencies;

    if (!peerDeps?.["react-native"]) {
      continue;
    }

    const rnPeerDep = peerDeps["react-native"];

    if (semver.satisfies(targetRNVersion, rnPeerDep)) {
      return version;
    }
  }

  return getLatestVersion(packageInfo);
}

function createAnalysis(
  packageName: string,
  currentVersion: string,
  recommendedVersion: string,
  latestVersion: string,
  reason: string
): DependencyAnalysis {
  const current = semver.coerce(currentVersion)?.version || currentVersion;
  const recommended =
    semver.coerce(recommendedVersion)?.version || recommendedVersion;

  const needsUpdate = current !== recommended;
  const hasBreakingChanges =
    needsUpdate && semver.major(recommended) > semver.major(current);

  let compatibilityStatus: DependencyAnalysis["compatibilityStatus"] =
    "compatible";

  if (hasBreakingChanges) {
    compatibilityStatus = "warning";
  } else if (needsUpdate) {
    compatibilityStatus = "warning";
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

export async function analyzeAllDependencies(
  dependencies: Record<string, string>,
  targetRNVersion: string,
  onProgress?: (current: number, total: number) => void
): Promise<DependencyAnalysis[]> {
  const entries = Object.entries(dependencies);
  const results: DependencyAnalysis[] = [];

  for (let i = 0; i < entries.length; i++) {
    const [packageName, version] = entries[i];

    if (onProgress) {
      onProgress(i + 1, entries.length);
    }

    const analysis = await analyzeDependency(
      packageName,
      version,
      targetRNVersion
    );
    results.push(analysis);
  }

  return results;
}
