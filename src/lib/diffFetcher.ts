import { parseDiff } from "react-diff-view";
import type { DiffFile } from "./types";
import {
  DEFAULT_APP_NAME,
  DEFAULT_APP_PACKAGE,
  PACKAGE_NAMES,
  RN_DIFF_REPOSITORIES,
  RN_CHANGELOG_URLS,
} from "./constants";

/**
 * Get the diff URL from rn-diff-purge
 */
export const getDiffURL = ({
  packageName = PACKAGE_NAMES.RN,
  fromVersion,
  toVersion,
}: {
  packageName?: string;
  fromVersion: string;
  toVersion: string;
}): string => {
  const repo =
    RN_DIFF_REPOSITORIES[packageName as keyof typeof RN_DIFF_REPOSITORIES] ||
    RN_DIFF_REPOSITORIES[PACKAGE_NAMES.RN];
  return `https://raw.githubusercontent.com/${repo}/diffs/diffs/${fromVersion}..${toVersion}.diff`;
};

/**
 * Fetch and parse the diff between two React Native versions
 */
export async function fetchRNDiff(
  fromVersion: string,
  toVersion: string,
  packageName: string = PACKAGE_NAMES.RN
): Promise<DiffFile[]> {
  try {
    const cleanFrom = fromVersion.replace(/[\^~]/g, "");
    const cleanTo = toVersion.replace(/[\^~]/g, "");

    const diffUrl = getDiffURL({
      packageName,
      fromVersion: cleanFrom,
      toVersion: cleanTo,
    });

    console.log("Fetching diff from:", diffUrl);

    const [response] = await Promise.all([
      fetch(diffUrl),
      new Promise<void>((resolve) => setTimeout(() => resolve(), 300)),
    ]);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch diff: ${response.status} ${response.statusText}`
      );
    }

    const diffText = await response.text();

    if (!diffText || diffText.trim() === "") {
      throw new Error("Empty diff received");
    }

    const files = parseDiff(diffText);
    const sorted = movePackageJsonToTop(files);

    return sorted;
  } catch (error) {
    console.error("Error fetching RN diff:", error);
    throw error;
  }
}

/**
 * Move package.json to the top of the file list
 */
function movePackageJsonToTop(files: DiffFile[]): DiffFile[] {
  return [...files].sort((a, b) => {
    const aPath = a.newPath || a.oldPath || "";
    const bPath = b.newPath || b.oldPath || "";

    if (aPath.includes("package.json")) return -1;
    if (bPath.includes("package.json")) return 1;
    return 0;
  });
}

/**
 * Get changelog URL for a version
 */
export function getChangelogURL(
  version: string,
  packageName: string = PACKAGE_NAMES.RN
): string | null {
  if (version.includes("-rc")) return null;

  const baseUrl =
    RN_CHANGELOG_URLS[packageName as keyof typeof RN_CHANGELOG_URLS];

  if (!baseUrl) return null;

  if (packageName === PACKAGE_NAMES.RN) {
    return `${baseUrl}#v${version.replaceAll(".", "")}`;
  }

  return `${baseUrl}v${version}`;
}

/**
 * Get language for syntax highlighting
 */
export function getLanguageFromPath(path: string): string {
  const extension = path.split(".").pop()?.toLowerCase();

  const languageMap: Record<string, string> = {
    js: "javascript",
    jsx: "jsx",
    ts: "typescript",
    tsx: "tsx",
    json: "json",
    java: "java",
    kt: "kotlin",
    swift: "swift",
    m: "objectivec",
    mm: "objectivec",
    h: "objectivec",
    xml: "xml",
    gradle: "groovy",
    rb: "ruby",
    md: "markdown",
    yml: "yaml",
    yaml: "yaml",
    sh: "bash",
    podspec: "ruby",
    properties: "properties",
  };

  return languageMap[extension || ""] || "text";
}

/**
 * Check if a file is binary
 */
export function isBinaryFile(path: string): boolean {
  const binaryExtensions = [
    "png",
    "jpg",
    "jpeg",
    "gif",
    "ico",
    "ttf",
    "woff",
    "woff2",
    "eot",
    "otf",
    "zip",
    "jar",
    "so",
    "a",
    "dylib",
    "aar",
  ];

  const extension = path.split(".").pop()?.toLowerCase();
  return binaryExtensions.includes(extension || "");
}

/**
 * Categorize files by platform/type
 */
export function categorizeFiles(files: DiffFile[]): {
  android: DiffFile[];
  ios: DiffFile[];
  javascript: DiffFile[];
  config: DiffFile[];
  other: DiffFile[];
} {
  const categories = {
    android: [] as DiffFile[],
    ios: [] as DiffFile[],
    javascript: [] as DiffFile[],
    config: [] as DiffFile[],
    other: [] as DiffFile[],
  };

  files.forEach((file) => {
    const path = (file.newPath || file.oldPath || "").toLowerCase();

    if (
      path.startsWith("android/") ||
      path.endsWith(".gradle") ||
      path.endsWith(".java") ||
      path.endsWith(".kt")
    ) {
      categories.android.push(file);
    } else if (
      path.startsWith("ios/") ||
      path.endsWith(".swift") ||
      path.endsWith(".m") ||
      path.endsWith(".h") ||
      path.endsWith(".podspec")
    ) {
      categories.ios.push(file);
    } else if (path.match(/\.(js|jsx|ts|tsx)$/)) {
      categories.javascript.push(file);
    } else if (
      path.match(/\.(json|yaml|yml|properties|xml)$/) ||
      path.includes("config") ||
      path === ".gitignore" ||
      path === ".watchmanconfig" ||
      path === ".prettierrc" ||
      path === ".eslintrc" ||
      path.startsWith(".bundle")
    ) {
      categories.config.push(file);
    } else {
      categories.other.push(file);
    }
  });

  return categories;
}

/**
 * Remove app path prefix
 */
export function removeAppPathPrefix(
  path: string,
  appName: string = DEFAULT_APP_NAME
): string {
  return path.replace(new RegExp(`^${appName}/`), "");
}

/**
 * Replace app details in path/content
 */
export function replaceAppDetails(
  str: string,
  appName?: string,
  appPackage?: string
): string {
  const appNameOrFallback = appName || DEFAULT_APP_NAME;
  const appPackageOrFallback = appPackage || DEFAULT_APP_PACKAGE;

  return str
    .replaceAll(DEFAULT_APP_PACKAGE, appPackageOrFallback)
    .replaceAll(
      DEFAULT_APP_PACKAGE.replaceAll(".", "/"),
      appPackageOrFallback.replaceAll(".", "/")
    )
    .replaceAll(DEFAULT_APP_NAME, appNameOrFallback)
    .replaceAll(
      DEFAULT_APP_NAME.toLowerCase(),
      appNameOrFallback.toLowerCase()
    );
}

/**
 * Get file paths to show (sanitized)
 */
export function getFilePathsToShow({
  oldPath,
  newPath,
  appName,
  appPackage,
}: {
  oldPath?: string;
  newPath?: string;
  appName?: string;
  appPackage?: string;
}): {
  oldPath: string;
  newPath: string;
} {
  const oldPathSanitized = oldPath
    ? replaceAppDetails(oldPath, appName, appPackage)
    : "";
  const newPathSanitized = newPath
    ? replaceAppDetails(newPath, appName, appPackage)
    : "";

  return {
    oldPath: removeAppPathPrefix(oldPathSanitized, appName),
    newPath: removeAppPathPrefix(newPathSanitized, appName),
  };
}
