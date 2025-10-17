import axios from "axios";
import semver from "semver";
import type { NpmPackageInfo } from "./types";

const NPM_REGISTRY = "https://registry.npmjs.org";

const packageCache = new Map<string, NpmPackageInfo>();

export async function fetchPackageInfo(
  packageName: string
): Promise<NpmPackageInfo | null> {
  try {
    if (packageCache.has(packageName)) {
      return packageCache.get(packageName)!;
    }

    const response = await axios.get<NpmPackageInfo>(
      `${NPM_REGISTRY}/${packageName}`,
      { timeout: 10000 }
    );

    const data = response.data;
    packageCache.set(packageName, data);
    return data;
  } catch (error) {
    console.error(`Failed to fetch package info for ${packageName}:`, error);
    return null;
  }
}

export function getAvailableVersions(packageInfo: NpmPackageInfo): string[] {
  return Object.keys(packageInfo.versions).sort((a, b) => {
    return semver.rcompare(a, b);
  });
}

export function getLatestVersion(packageInfo: NpmPackageInfo): string {
  return packageInfo["dist-tags"].latest;
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
