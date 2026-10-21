/**
 * The React Native release catalog.
 *
 * The catalog is assembled at runtime from public, always-current sources:
 *   - rn-diff-purge `RELEASES`  -> the full list of published versions
 *   - npm `dist-tags`           -> latest / next / nightly / canary channels
 *   - GitHub releases API       -> publication dates
 *   - reactnative.dev/blog      -> the official announcement + headline
 *   - npm per-version metadata  -> the React version each release requires
 *
 * A committed snapshot is used for the very first paint (and as an offline
 * fallback) so the UI never renders empty, but it is always superseded by
 * live data - there is nothing to update by hand.
 */
import { cachedFetchJson, clearCache } from "./http";
import snapshot from "@/data/rn-catalog.snapshot.json";

export interface RnVersionInfo {
  version: string;
  releasedAt?: string;
  prerelease: boolean;
  blogUrl?: string;
  blogHeadline?: string;
  /** The markdown source of the announcement, used to read the headline. */
  blogRawUrl?: string;
  /** The `react` peer range this React Native release requires. */
  reactPeer?: string;
  /** The `@types/react` peer range this React Native release requires. */
  typesPeer?: string;
  /** The `node` engine range this React Native release requires. */
  nodeEngine?: string;
  channels?: string[];
}

export interface RnCatalog {
  versions: RnVersionInfo[];
  /** e.g. { latest: "0.88.0", next: "0.89.0-rc.1" } */
  tags: Record<string, string>;
  updatedAt: number;
  source: "network" | "cache" | "snapshot" | "stale";
}

const RELEASES_URL =
  "https://raw.githubusercontent.com/react-native-community/rn-diff-purge/master/RELEASES";
// The npm `dist-tags` endpoint does not send CORS headers, so the same data
// is read from the jsDelivr package API instead.
const DIST_TAGS_URL = "https://data.jsdelivr.com/v1/package/npm/react-native";

// The official announcements live in the website repository. Reading them from
// there works from the browser (reactnative.dev does not send CORS headers).
const BLOG_INDEX_API =
  "https://api.github.com/repos/react/react-native-website/contents/website/blog";
const GH_RELEASES_URL =
  "https://api.github.com/repos/react/react-native/releases?per_page=60";

const semverCompare = (a: string, b: string): number => {
  const parse = (v: string) => {
    const [core, pre] = v.split("-");
    const parts = core.split(".").map((n) => Number.parseInt(n, 10) || 0);
    return { parts, pre: pre ?? "" };
  };
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < 3; i++) {
    const diff = (pa.parts[i] ?? 0) - (pb.parts[i] ?? 0);
    if (diff !== 0) return diff;
  }
  if (pa.pre === pb.pre) return 0;
  if (!pa.pre) return 1;
  if (!pb.pre) return -1;
  return pa.pre < pb.pre ? -1 : 1;
};

export const isPrerelease = (version: string): boolean =>
  version.includes("-");

export const stableVersions = (versions: RnVersionInfo[]): RnVersionInfo[] =>
  versions.filter((v) => !v.prerelease);

/** Patch versions of the same minor, newest first (0.88.1, 0.88.0). */
export const minorLine = (version: string): string =>
  version.split(".").slice(0, 2).join(".");

export function sortVersionsDescending(versions: RnVersionInfo[]): RnVersionInfo[] {
  return [...versions].sort((a, b) => semverCompare(b.version, a.version));
}

interface GhRelease {
  tag_name: string;
  prerelease: boolean;
  published_at: string;
  html_url: string;
}

interface BlogPost {
  /** The minor line the announcement covers, e.g. "0.88". */
  minor: string;
  /** The public URL of the announcement. */
  url: string;
  /** The raw markdown source, used to read the headline. */
  rawUrl: string;
  datePublished?: string;
}

interface BlogFile {
  name: string;
  type: string;
  download_url: string;
}

/**
 * Maps every release announcement to the version it covers.
 *
 * The file names follow `YYYY-MM-DD-react-native-0.88.mdx` (older posts use
 * `version-0.77`), so the version and the publication date are part of the
 * name.
 */
export function parseBlogIndex(files: BlogFile[]): BlogPost[] {
  const posts = new Map<string, BlogPost>();

  const add = (
    file: BlogFile,
    match: RegExpMatchArray
  ): void => {
    const [, year, month, day, rawVersion] = match;
    const minor = rawVersion.split(".").slice(0, 2).join(".");
    if (posts.has(minor)) return;

    const slug = file.name
      .replace(/^\d{4}-\d{2}-\d{2}-/, "")
      .replace(/\.mdx?$/, "");

    posts.set(minor, {
      minor,
      url: `https://reactnative.dev/blog/${year}/${month}/${day}/${slug}`,
      rawUrl: file.download_url,
      datePublished: `${year}-${month}-${day}T00:00:00.000Z`,
    });
  };

  // Release announcements first: "version-0.77", "react-native-0.88",
  // "release-0.76-new-architecture".
  const strict =
    /^(\d{4})-(\d{2})-(\d{2})-(?:version-|react-native-|release-)(\d+\.\d+)/;
  // Any other post that mentions a version, e.g. "0.73-debugging-improvements".
  const loose = /^(\d{4})-(\d{2})-(\d{2})-(.*?\d+\.\d+)(?:[-_].*)?\.mdx?$/;

  for (const file of files) {
    if (file.type !== "file") continue;
    const match = file.name.match(strict);
    if (match) add(file, match);
  }

  for (const file of files) {
    if (file.type !== "file") continue;
    const match = file.name.match(loose);
    if (match) add(file, match);
  }

  return Array.from(posts.values()).sort((a, b) =>
    semverCompare(b.minor, a.minor)
  );
}

export function snapshotToCatalog(): RnCatalog {
  const snap = snapshot as {
    updatedAt?: number;
    tags?: Record<string, string>;
    versions?: Array<{
      version: string;
      releasedAt?: string;
      prerelease?: boolean;
      blogUrl?: string;
      blogHeadline?: string;
      blogRawUrl?: string;
      reactPeer?: string;
      typesPeer?: string;
      nodeEngine?: string;
    }>;
  };

  return {
    versions: sortVersionsDescending(
      (snap.versions ?? []).map((v) => ({
        version: v.version,
        releasedAt: v.releasedAt,
        prerelease: v.prerelease ?? isPrerelease(v.version),
        blogUrl: v.blogUrl,
        blogHeadline: v.blogHeadline,
        blogRawUrl: v.blogRawUrl,
        reactPeer: v.reactPeer,
        typesPeer: v.typesPeer,
        nodeEngine: v.nodeEngine,
      }))
    ),
    tags: snap.tags ?? {},
    updatedAt: snap.updatedAt ?? 0,
    source: "snapshot",
  };
}

interface Sourced<T> {
  data: T;
  fetchedAt: number;
}

async function fetchVersionList(): Promise<Sourced<string[]>> {
  const result = await cachedFetchJson<string>(
    "releases-list",
    RELEASES_URL,
    { ttl: 6 * 60 * 60 * 1000, timeout: 12000 }
  );
  if (!result) return { data: [], fetchedAt: Date.now() };

  const raw = result.data;
  const text = Array.isArray(raw) ? raw.join("\n") : String(raw);

  const versions = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^0\.\d+\.\d+/.test(line));

  return { data: versions, fetchedAt: result.fetchedAt };
}

async function fetchDistTags(): Promise<Sourced<Record<string, string>>> {
  const result = await cachedFetchJson<{ tags?: Record<string, string> }>(
    "dist-tags",
    DIST_TAGS_URL,
    { ttl: 60 * 60 * 1000, timeout: 20000 }
  );
  return {
    data: result?.data?.tags ?? {},
    fetchedAt: result?.fetchedAt ?? Date.now(),
  };
}

async function fetchReleaseDates(): Promise<
  Sourced<Map<string, { releasedAt: string; url: string }>>
> {
  const map = new Map<string, { releasedAt: string; url: string }>();
  const result = await cachedFetchJson<GhRelease[]>(
    "gh-releases",
    GH_RELEASES_URL,
    { ttl: 60 * 60 * 1000, timeout: 15000 }
  );
  if (!result || !Array.isArray(result.data)) {
    return { data: map, fetchedAt: Date.now() };
  }

  for (const release of result.data) {
    const version = release.tag_name.replace(/^v/, "");
    if (!version) continue;
    map.set(version, {
      releasedAt: release.published_at,
      url: release.html_url,
    });
  }
  return { data: map, fetchedAt: result.fetchedAt };
}

async function fetchBlogPosts(): Promise<Sourced<Map<string, BlogPost>>> {
  const map = new Map<string, BlogPost>();
  const result = await cachedFetchJson<BlogFile[]>("blog-index", BLOG_INDEX_API, {
    ttl: 24 * 60 * 60 * 1000,
    timeout: 15000,
  });
  if (!result || !Array.isArray(result.data)) {
    return { data: map, fetchedAt: Date.now() };
  }

  for (const post of parseBlogIndex(result.data)) {
    map.set(post.minor, post);
  }
  return { data: map, fetchedAt: result.fetchedAt };
}

/**
 * Reads the headline of an announcement from its markdown source.
 */
export async function fetchHeadline(
  post: BlogPost
): Promise<string | undefined> {
  if (!post.rawUrl) return undefined;

  const result = await cachedFetchJson<string>(
    `headline:${post.minor}`,
    post.rawUrl,
    { ttl: 30 * 24 * 60 * 60 * 1000, timeout: 12000 }
  );
  if (!result) return undefined;

  const source = result.data;
  const frontMatter = source.match(/^---\n([\s\S]*?)\n---/);
  const title =
    frontMatter?.[1]?.match(/^title:\s*["']?(.+?)["']?\s*$/m)?.[1] ??
    source.match(/^#\s+(.+)$/m)?.[1];

  return title?.trim();
}

/**
 * Resolves the `react` version a given React Native release expects by
 * reading its npm manifest. This replaces the hand-maintained version table
 * that used to live in the compatibility checker.
 */
export async function resolveReactPeer(
  version: string
): Promise<{ reactPeer?: string; typesPeer?: string; nodeEngine?: string }> {
  const clean = version.replace(/[\^~]/g, "");
  if (!/^\d+\.\d+\.\d+$/.test(clean)) return {};

  const result = await cachedFetchJson<{
    peerDependencies?: Record<string, string>;
    engines?: { node?: string };
  }>(`rn-manifest-${clean}`, `https://registry.npmjs.org/react-native/${clean}`, {
    ttl: 7 * 24 * 60 * 60 * 1000,
    timeout: 12000,
  });

  if (!result) return {};
  return {
    reactPeer: result.data?.peerDependencies?.react,
    typesPeer: result.data?.peerDependencies?.["@types/react"],
    nodeEngine: result.data?.engines?.node,
  };
}

/** Fills in the React requirement for a set of versions in parallel. */
export async function hydrateReactPeers(
  versions: RnVersionInfo[],
  limit = 8
): Promise<RnVersionInfo[]> {
  const missing = versions.filter((v) => !v.reactPeer).slice(0, limit);

  await Promise.all(
    missing.map(async (version) => {
      const peer = await resolveReactPeer(version.version);
      if (peer.reactPeer) version.reactPeer = peer.reactPeer;
      if (peer.typesPeer) version.typesPeer = peer.typesPeer;
      if (peer.nodeEngine) version.nodeEngine = peer.nodeEngine;
    })
  );

  return versions;
}

let inFlight: Promise<RnCatalog> | null = null;

export async function loadCatalog(options?: {
  force?: boolean;
}): Promise<RnCatalog> {
  if (inFlight && !options?.force) return inFlight;

  if (options?.force) {
    for (const key of ["releases-list", "dist-tags", "gh-releases", "blog-index"]) {
      clearCache(key);
    }
  }

  inFlight = (async (): Promise<RnCatalog> => {
    const fallback = snapshotToCatalog();

    const [versionList, distTags, releaseInfo, blogInfo] = await Promise.all([
      fetchVersionList(),
      fetchDistTags(),
      fetchReleaseDates(),
      fetchBlogPosts(),
    ]);

    const versions = versionList.data.length
      ? versionList.data
      : fallback.versions.map((v) => v.version);
    const tagMap = Object.keys(distTags.data).length
      ? distTags.data
      : fallback.tags;
    const releaseDates = releaseInfo.data;
    const blogPosts = blogInfo.data;

    const channelByVersion = new Map<string, string[]>();
    for (const [channel, version] of Object.entries(tagMap)) {
      if (!version) continue;
      const list = channelByVersion.get(version) ?? [];
      list.push(channel);
      channelByVersion.set(version, list);
    }

    const merged: RnVersionInfo[] = versions.map((version) => {
      const snap = fallback.versions.find((v) => v.version === version);
      const release = releaseDates.get(version);
      const blog = blogPosts.get(minorLine(version));
      return {
        version,
        releasedAt: release?.releasedAt ?? snap?.releasedAt,
        prerelease: isPrerelease(version),
        blogUrl: blog?.url ?? snap?.blogUrl,
        blogHeadline: snap?.blogHeadline,
        blogRawUrl: blog?.rawUrl ?? snap?.blogRawUrl,
        reactPeer: snap?.reactPeer,
        typesPeer: snap?.typesPeer,
        nodeEngine: snap?.nodeEngine,
        channels: channelByVersion.get(version),
      };
    });

    if (!merged.length) {
      return { ...fallback, source: "snapshot" };
    }

    return {
      versions: sortVersionsDescending(merged),
      tags: tagMap,
      // The catalog is only as fresh as its stalest source.
      updatedAt: Math.min(
        versionList.fetchedAt,
        distTags.fetchedAt,
        releaseInfo.fetchedAt,
        blogInfo.fetchedAt
      ),
      source: "network",
    };
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

/**
 * The state the app starts with: the catalog from the committed snapshot and
 * the version pair that is shown by default. It is rendered on the server so
 * the first paint already contains the content.
 */
export function initialSession(): {
  catalog: RnCatalog;
  fromVersion: string;
  toVersion: string;
} {
  const catalog = snapshotToCatalog();
  const stable = catalog.versions.filter((version) => !version.prerelease);

  const toVersion = catalog.tags.latest ?? stable[0]?.version ?? "";
  const index = stable.findIndex((version) => version.version === toVersion);
  const fromVersion = stable[index + 1]?.version ?? stable[0]?.version ?? "";

  return { catalog, fromVersion, toVersion };
}

export function findVersion(
  catalog: RnCatalog,
  version: string
): RnVersionInfo | undefined {
  return catalog.versions.find((v) => v.version === version);
}

/**
 * The versions a user can pick as an upgrade target: everything newer than
 * the version they are on.
 */
export function upgradeTargets(
  catalog: RnCatalog,
  fromVersion: string
): RnVersionInfo[] {
  if (!fromVersion) return catalog.versions;
  return catalog.versions.filter(
    (v) => semverCompare(v.version, fromVersion) > 0
  );
}

/** The versions a user can plausibly be coming from. */
export function upgradeSources(
  catalog: RnCatalog,
  toVersion: string
): RnVersionInfo[] {
  if (!toVersion) return catalog.versions;
  return catalog.versions.filter(
    (v) => semverCompare(v.version, toVersion) < 0
  );
}

export { semverCompare };
