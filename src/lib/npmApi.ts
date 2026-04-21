import semver from "semver";
import type { VersionInfo } from "./types";
import { cachedFetchJson } from "./data/http";

const NPM_REGISTRY = "https://registry.npmjs.org";
/**
 * The npm packument of a package with hundreds of versions can take tens of
 * seconds to download. The jsDelivr package API returns the same version list
 * in a fraction of the time, and the peer dependencies are read from the
 * (small) manifest of a single version.
 */
const CDN_REGISTRY = "https://data.jsdelivr.com/v1/package/npm";

export interface PackageCatalog {
  versions: string[];
  tags: Record<string, string>;
}

export async function fetchPackageCatalog(
  packageName: string
): Promise<PackageCatalog | null> {
  const result = await cachedFetchJson<{
    versions?: string[];
    tags?: Record<string, string>;
  }>(`pkg:${packageName}`, `${CDN_REGISTRY}/${packageName}`, {
    ttl: 6 * 60 * 60 * 1000,
    timeout: 15000,
  });

  if (!result?.data) return null;

  return {
    versions: result.data.versions ?? [],
    tags: result.data.tags ?? {},
  };
}

/**
 * Fetches the manifest of one specific version. It contains the peer
 * dependencies, which is what the compatibility check is based on.
 */
export async function fetchPackageVersion(
  packageName: string,
  version: string
): Promise<VersionInfo | null> {
  const result = await cachedFetchJson<VersionInfo>(
    `pkgv:${packageName}@${version}`,
    `${NPM_REGISTRY}/${packageName}/${version}`,
    { ttl: 24 * 60 * 60 * 1000, timeout: 15000 }
  );

  return result?.data ?? null;
}

/**
 * The latest published version of a package, according to the registry.
 */
export async function fetchLatestVersion(
  packageName: string
): Promise<string | null> {
  const result = await cachedFetchJson<VersionInfo>(
    `pkgl:${packageName}`,
    `${NPM_REGISTRY}/${packageName}/latest`,
    { ttl: 6 * 60 * 60 * 1000, timeout: 15000 }
  );

  return result?.data?.version ?? null;
}

export function getAvailableVersions(catalog: PackageCatalog): string[] {
  return [...catalog.versions].sort((a, b) => semver.rcompare(a, b));
}
