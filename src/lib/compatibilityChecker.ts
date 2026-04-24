import semver from "semver";
import type { DependencyAnalysis, VersionInfo } from "./types";
import {
  fetchLatestVersion,
  fetchPackageCatalog,
  fetchPackageVersion,
  type PackageCatalog,
} from "./npmApi";

const CONCURRENCY_LIMIT = 4;
/** How many candidate versions are inspected when a package has to move. */
const CANDIDATE_LIMIT = 8;

/** Peer ranges that are too loose to be useful for compatibility checks. */
const WILDCARD_RANGES = new Set(["*", "latest", "x", ""]);

function rangesIntersect(a: string, b: string): boolean | null {
  if (!a || !b) return null;
  if (WILDCARD_RANGES.has(a) || WILDCARD_RANGES.has(b)) return null;
  try {
    return semver.intersects(a, b, { includePrerelease: true });
  } catch {
    return null;
  }
}

function satisfies(range: string, version: string): boolean | null {
  if (!range || WILDCARD_RANGES.has(range)) return null;
  try {
    return semver.satisfies(version, range, { includePrerelease: true });
  } catch {
    return null;
  }
}

function isStableVersion(version: string): boolean {
  if (!semver.valid(version)) return false;
  const prerelease = semver.prerelease(version);
  if (!prerelease) return true;
  const tag = String(prerelease[0] || "").toLowerCase();
  return !(
    tag.includes("nightly") ||
    tag.includes("canary") ||
    tag.includes("alpha") ||
    tag.includes("beta") ||
    tag.includes("rc") ||
    tag.includes("dev") ||
    tag.includes("next") ||
    tag.includes("experimental")
  );
}

/**
 * Checks a single version of a package against the target React Native
 * release and the React version it requires.
 */
function checkCompatibility(
  peerDependencies: Record<string, string> | undefined,
  targetRNVersion: string,
  targetReactPeer?: string
): { compatible: boolean; reason?: string } {
  if (!peerDependencies) return { compatible: true };

  const rnPeer = peerDependencies["react-native"];
  if (rnPeer) {
    const match = satisfies(rnPeer, targetRNVersion);
    if (match === false) {
      return {
        compatible: false,
        reason: `This version requires react-native ${rnPeer}, which does not include ${targetRNVersion}`,
      };
    }
  }

  const reactPeer = peerDependencies.react;
  if (reactPeer && targetReactPeer) {
    const overlap = rangesIntersect(reactPeer, targetReactPeer);
    if (overlap === false) {
      return {
        compatible: false,
        reason: `This version requires react ${reactPeer}, but React Native ${targetRNVersion} needs ${targetReactPeer}`,
      };
    }
  }

  return { compatible: true };
}

/**
 * Analyses a single dependency against the target React Native version.
 *
 * The React version that the target release expects is resolved from the npm
 * manifest of that release - it is never hardcoded, so new React Native
 * versions are supported the day they ship.
 */
export async function analyzeDependency(
  packageName: string,
  currentVersion: string,
  targetRNVersion: string,
  targetReactPeer?: string,
  targetTypesPeer?: string
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
      reason: "React Native core package - set it to the target version",
    };
  }

  if (packageName === "react" && targetReactPeer) {
    return analyzeReact(currentVersion, targetReactPeer, targetRNVersion);
  }

  if (packageName === "@types/react" && targetTypesPeer) {
    return analyzeReactTypes(currentVersion, targetTypesPeer, targetRNVersion);
  }

  const current = semver.coerce(currentVersion)?.version ?? currentVersion;

  const [catalog, currentManifest, latest] = await Promise.all([
    fetchPackageCatalog(packageName),
    fetchPackageVersion(packageName, current),
    fetchLatestVersion(packageName),
  ]);

  if (!catalog && !currentManifest) {
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

  const currentCheck = checkCompatibility(
    currentManifest?.peerDependencies,
    targetRNVersion,
    targetReactPeer
  );

  let recommended = current;
  let recommendedManifest: VersionInfo | undefined = currentManifest ?? undefined;
  let incompatibility: string | undefined;

  if (!currentCheck.compatible) {
    incompatibility = currentCheck.reason;
    const candidate = await findCompatibleVersion(
      packageName,
      catalog,
      current,
      targetRNVersion,
      targetReactPeer
    );
    if (candidate) {
      recommended = candidate.version;
      recommendedManifest = candidate.manifest ?? undefined;
      incompatibility = undefined;
    }
  }

  return buildAnalysis({
    packageName,
    currentVersion,
    current,
    recommended,
    recommendedManifest,
    latest: latest ?? catalog?.tags?.latest ?? "unknown",
    incompatibility,
    targetRNVersion,
    targetReactPeer,
  });
}

/**
 * Finds the closest newer version that is compatible with the target release.
 */
async function findCompatibleVersion(
  packageName: string,
  catalog: PackageCatalog | null,
  current: string,
  targetRNVersion: string,
  targetReactPeer?: string
): Promise<{ version: string; manifest?: VersionInfo } | null> {
  if (!catalog) return null;

  const candidates = catalog.versions
    .filter(isStableVersion)
    .filter((version) => {
      try {
        return semver.gt(version, current);
      } catch {
        return false;
      }
    })
    .sort((a, b) => semver.compare(a, b))
    .slice(0, CANDIDATE_LIMIT);

  for (const version of candidates) {
    const manifest = await fetchPackageVersion(packageName, version);
    const check = checkCompatibility(
      manifest?.peerDependencies,
      targetRNVersion,
      targetReactPeer
    );
    if (check.compatible) return { version, manifest: manifest ?? undefined };
  }

  return null;
}

/**
 * React itself has no peer dependency on React Native, so the requirement
 * comes from the React Native release that is being targeted.
 */
function analyzeReact(
  currentVersion: string,
  targetReactPeer: string,
  targetRNVersion: string
): DependencyAnalysis {
  const current = semver.coerce(currentVersion)?.version ?? currentVersion;
  const minimum = semver.minVersion(targetReactPeer);
  const target = minimum?.version ?? targetReactPeer.replace(/^[\^~>=<\s]*/, "");
  const compatible = satisfies(targetReactPeer, currentVersion);

  if (compatible === false) {
    return {
      package: "react",
      currentVersion,
      recommendedVersion: target,
      latestVersion: target,
      needsUpdate: true,
      hasBreakingChanges: true,
      compatibilityStatus: "warning",
      reason: `React Native ${targetRNVersion} requires react ${targetReactPeer} - React has to move with it`,
      changelogUrl: "https://www.npmjs.com/package/react?activeTab=versions",
    };
  }

  return {
    package: "react",
    currentVersion,
    recommendedVersion: current,
    latestVersion: target,
    needsUpdate: false,
    hasBreakingChanges: false,
    compatibilityStatus: "compatible",
    reason: `Matches the react ${targetReactPeer} range required by React Native ${targetRNVersion}`,
    changelogUrl: "https://www.npmjs.com/package/react?activeTab=versions",
  };
}

/**
 * The React type definitions have to match the React version that ships with
 * the target React Native release.
 */
function analyzeReactTypes(
  currentVersion: string,
  targetTypesPeer: string,
  targetRNVersion: string
): DependencyAnalysis {
  const current = semver.coerce(currentVersion)?.version ?? currentVersion;
  const minimum = semver.minVersion(targetTypesPeer);
  const target = minimum?.version ?? targetTypesPeer.replace(/^[\^~>=<\s]*/, "");
  const compatible = satisfies(targetTypesPeer, currentVersion);

  if (compatible === false) {
    return {
      package: "@types/react",
      currentVersion,
      recommendedVersion: target,
      latestVersion: target,
      needsUpdate: true,
      hasBreakingChanges: true,
      compatibilityStatus: "warning",
      reason: `React Native ${targetRNVersion} ships with @types/react ${targetTypesPeer} - the type definitions have to match React`,
      changelogUrl: "https://www.npmjs.com/package/@types/react?activeTab=versions",
    };
  }

  return {
    package: "@types/react",
    currentVersion,
    recommendedVersion: current,
    latestVersion: target,
    needsUpdate: false,
    hasBreakingChanges: false,
    compatibilityStatus: "compatible",
    reason: `Matches the @types/react ${targetTypesPeer} range required by React Native ${targetRNVersion}`,
    changelogUrl: "https://www.npmjs.com/package/@types/react?activeTab=versions",
  };
}

function buildAnalysis({
  packageName,
  currentVersion,
  current,
  recommended,
  recommendedManifest,
  latest,
  incompatibility,
  targetRNVersion,
  targetReactPeer,
}: {
  packageName: string;
  currentVersion: string;
  current: string;
  recommended: string;
  recommendedManifest?: VersionInfo;
  latest: string;
  incompatibility?: string;
  targetRNVersion: string;
  targetReactPeer?: string;
}): DependencyAnalysis {
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
  let reason = "Compatible with the target React Native version";

  if (incompatibility) {
    compatibilityStatus = "incompatible";
    reason = incompatibility;
  } else {
    const peerDeps = recommendedManifest?.peerDependencies;
    const rnPeer = peerDeps?.["react-native"];
    if (rnPeer) {
      const match = satisfies(rnPeer, targetRNVersion);
      if (match === false) {
        compatibilityStatus = "incompatible";
        reason = `This version requires react-native ${rnPeer}, which does not include ${targetRNVersion}`;
      }
    }
    if (compatibilityStatus !== "incompatible" && peerDeps?.react && targetReactPeer) {
      const overlap = rangesIntersect(peerDeps.react, targetReactPeer);
      if (overlap === false) {
        compatibilityStatus = "incompatible";
        reason = `This version requires react ${peerDeps.react}, but React Native ${targetRNVersion} needs ${targetReactPeer}`;
      }
    }
  }

  if (compatibilityStatus !== "incompatible") {
    if (hasBreakingChanges) {
      compatibilityStatus = "warning";
      reason = `Major version change from ${semver.major(current)} to ${semver.major(
        recommended
      )} - review the changelog before upgrading`;
    } else if (needsUpdate) {
      reason = "Updated for compatibility with the target React Native version";
    } else {
      reason = "Already compatible with the target React Native version";
    }
  }

  return {
    package: packageName,
    currentVersion,
    recommendedVersion: recommended,
    latestVersion: latest,
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
      }

      completedCount++;
      onProgress?.(completedCount, items.length);
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
  options: {
    onProgress?: (current: number, total: number) => void;
    targetReactPeer?: string;
    targetTypesPeer?: string;
    signal?: AbortSignal;
  } = {}
): Promise<DependencyAnalysis[]> {
  const entries = Object.entries(dependencies);

  options.onProgress?.(0, entries.length);

  const results = await runWithConcurrency(
    entries,
    async ([packageName, version]) => {
      if (options.signal?.aborted) {
        throw new Error("Aborted");
      }
      return analyzeDependency(
        packageName,
        version,
        targetRNVersion,
        options.targetReactPeer,
        options.targetTypesPeer
      );
    },
    CONCURRENCY_LIMIT,
    options.onProgress
  );

  return results;
}
