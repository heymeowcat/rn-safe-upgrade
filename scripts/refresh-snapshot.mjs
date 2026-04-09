#!/usr/bin/env node
/**
 * Regenerates the committed React Native catalog snapshot.
 *
 * The snapshot gives the app instant first paint and an offline fallback.
 * It is fully automatic: CI runs this on a schedule and commits the result,
 * so the content is never updated by hand.
 *
 *   node scripts/refresh-snapshot.mjs
 */
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT = resolve(__dirname, "../src/data/rn-catalog.snapshot.json");

const RELEASES_URL =
  "https://raw.githubusercontent.com/react-native-community/rn-diff-purge/master/RELEASES";
const DIST_TAGS_URL = "https://data.jsdelivr.com/v1/package/npm/react-native";
const GH_RELEASES_URL =
  "https://api.github.com/repos/facebook/react-native/releases?per_page=80";
const BLOG_INDEX_API =
  "https://api.github.com/repos/react/react-native-website/contents/website/blog";

/** How many of the most recent releases get their npm manifest inspected. */
const MANIFEST_LIMIT = Number(process.env.SNAPSHOT_MANIFEST_LIMIT ?? 24);
/** How many announcements get their headline read. */
const HEADLINE_LIMIT = Number(process.env.SNAPSHOT_HEADLINE_LIMIT ?? 30);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, attempt = 0) {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json, text/plain, */*",
        "User-Agent": "rn-safe-upgrade-snapshot",
      },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      throw new Error(`GET ${url} -> ${response.status} ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    if (attempt < 3) {
      await sleep(500 * (attempt + 1));
      return await getJson(url, attempt + 1);
    }
    throw error;
  }
}

async function getText(url, attempt = 0) {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "rn-safe-upgrade-snapshot" },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      throw new Error(`GET ${url} -> ${response.status} ${response.statusText}`);
    }
    return await response.text();
  } catch (error) {
    if (attempt < 3) {
      await sleep(500 * (attempt + 1));
      return await getText(url, attempt + 1);
    }
    throw error;
  }
}

/** Runs `worker` over `items` with a bounded number of parallel requests. */
async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  });

  await Promise.all(runners);
  return results;
}

function parseBlogIndex(files) {
  const posts = new Map();

  const add = (file, match) => {
    const [, year, month, day, rawVersion] = match;
    const minor = rawVersion.split(".").slice(0, 2).join(".");
    if (posts.has(minor)) return;

    const slug = file.name
      .replace(/^\d{4}-\d{2}-\d{2}-/, "")
      .replace(/\.mdx?$/, "");

    posts.set(minor, {
      url: `https://reactnative.dev/blog/${year}/${month}/${day}/${slug}`,
      rawUrl: file.download_url,
      datePublished: `${year}-${month}-${day}T00:00:00.000Z`,
    });
  };

  const strict =
    /^(\d{4})-(\d{2})-(\d{2})-(?:version-|react-native-|release-)(\d+\.\d+)/;
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

  return posts;
}

function parseHeadline(source) {
  const frontMatter = source.match(/^---\n([\s\S]*?)\n---/);
  const title =
    frontMatter?.[1]?.match(/^title:\s*["']?(.+?)["']?\s*$/m)?.[1] ??
    source.match(/^#\s+(.+)$/m)?.[1];
  return title?.trim();
}

const compare = (a, b) => {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  }
  return 0;
};

async function main() {
  console.log("Fetching React Native release list...");
  const releasesText = await getText(RELEASES_URL);
  const versions = releasesText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^0\.\d+\.\d+/.test(line));

  console.log(`  ${versions.length} versions found`);

  console.log("Fetching release channels...");
  const distTags = await getJson(DIST_TAGS_URL);
  const tags = distTags?.tags ?? {};

  console.log("Fetching GitHub releases...");
  const releases = await getJson(GH_RELEASES_URL);
  const releaseDates = new Map();
  for (const release of Array.isArray(releases) ? releases : []) {
    const version = release.tag_name.replace(/^v/, "");
    if (version) releaseDates.set(version, release.published_at);
  }

  console.log("Fetching the official announcements...");
  const blogFiles = await getJson(BLOG_INDEX_API);
  const blogPosts = parseBlogIndex(Array.isArray(blogFiles) ? blogFiles : []);
  console.log(`  ${blogPosts.size} announcements found`);

  const stable = versions.filter((v) => !v.includes("-"));
  const recent = [...stable].sort((a, b) => compare(b, a)).slice(0, MANIFEST_LIMIT);

  console.log(`Inspecting npm manifests for ${recent.length} recent releases...`);
  const manifests = new Map();
  await mapWithConcurrency(recent, 3, async (version) => {
    try {
      const manifest = await getJson(
        `https://registry.npmjs.org/react-native/${version}`
      );
      manifests.set(version, {
        reactPeer: manifest?.peerDependencies?.react,
        typesPeer: manifest?.peerDependencies?.["@types/react"],
        nodeEngine: manifest?.engines?.node,
      });
    } catch (error) {
      console.warn(`  ! ${version}: ${error.message}`);
    }
  });

  console.log(`Reading ${HEADLINE_LIMIT} announcement headlines...`);
  const headlines = new Map();
  const withPosts = recent
    .filter((version) => blogPosts.has(version.split(".").slice(0, 2).join(".")))
    .slice(0, HEADLINE_LIMIT);

  await mapWithConcurrency(withPosts, 3, async (version) => {
    const minor = version.split(".").slice(0, 2).join(".");
    const post = blogPosts.get(minor);
    if (!post) return;
    try {
      const source = await getText(post.rawUrl);
      const title = parseHeadline(source);
      if (title) headlines.set(version, title);
    } catch (error) {
      console.warn(`  ! headline ${version}: ${error.message}`);
    }
  });

  const snapshot = {
    updatedAt: Date.now(),
    tags,
    versions: versions.map((version) => {
      const minor = version.split(".").slice(0, 2).join(".");
      const blog = blogPosts.get(minor);
      const manifest = manifests.get(version) ?? {};
      return {
        version,
        releasedAt: releaseDates.get(version),
        prerelease: version.includes("-"),
        blogUrl: blog?.url,
        blogRawUrl: blog?.rawUrl,
        blogHeadline: headlines.get(version),
        reactPeer: manifest.reactPeer,
        typesPeer: manifest.typesPeer,
        nodeEngine: manifest.nodeEngine,
      };
    }),
  };

  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, JSON.stringify(snapshot, null, 2) + "\n", "utf8");

  const latest = snapshot.versions.find((v) => v.version === tags.latest);
  console.log(`Wrote ${OUTPUT}`);
  console.log(
    `Latest stable: ${tags.latest} (react ${latest?.reactPeer ?? "unknown"})`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
