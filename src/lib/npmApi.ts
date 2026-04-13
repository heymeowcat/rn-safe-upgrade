import semver from "semver";
import type { NpmPackageInfo } from "./types";
import { cachedFetchJson } from "./data/http";

const NPM_REGISTRY = "https://registry.npmjs.org";

/**
 * The abbreviated packument is a fraction of the size of the full document
 * and still contains everything we need (versions, peer dependencies, tags).
 */
const ABBREVIATED_HEADERS = {
  Accept: "application/vnd.npm.install-v1+json",
};

export async function fetchPackageInfo(
  packageName: string
): Promise<NpmPackageInfo | null> {
  const result = await cachedFetchJson<NpmPackageInfo>(
    `npm:${packageName}`,
    `${NPM_REGISTRY}/${packageName}`,
    { ttl: 6 * 60 * 60 * 1000, timeout: 20000, headers: ABBREVIATED_HEADERS }
  );

  return result?.data ?? null;
}

/**
 * Fetches the manifest of one specific version. Much cheaper than the whole
 * packument and used for React Native releases.
 */
export async function fetchPackageVersion(
  packageName: string,
  version: string
): Promise<NpmPackageInfo["versions"][string] | null> {
  const result = await cachedFetchJson<{
    version: string;
    peerDependencies?: Record<string, string>;
    dependencies?: Record<string, string>;
    engines?: { node?: string; npm?: string };
  }>(`npm:${packageName}@${version}`, `${NPM_REGISTRY}/${packageName}/${version}`, {
    ttl: 24 * 60 * 60 * 1000,
    timeout: 20000,
  });

  return result?.data ?? null;
}

export function getAvailableVersions(packageInfo: NpmPackageInfo): string[] {
  return Object.keys(packageInfo.versions).sort((a, b) => {
    return semver.rcompare(a, b);
  });
}

export function getLatestVersion(packageInfo: NpmPackageInfo): string {
  return packageInfo["dist-tags"]?.latest;
}

export function hasPeerDependencies(
  packageInfo: NpmPackageInfo,
  version: string,
  peerPackage: string
): boolean {
  const versionInfo = packageInfo.versions[version];
  if (!versionInfo?.peerDependencies) return false;

  return peerPackage in versionInfo.peerDependencies;
}
