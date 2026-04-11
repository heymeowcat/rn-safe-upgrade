/**
 * Composes the "Upgrade Brief": the single page a developer reads before
 * touching their project.
 *
 * Every part of the brief is derived from live sources (release notes, the
 * template diff, the npm manifest) - the React Native team does not have to
 * maintain a page for us, and neither do we.
 */
import type { DiffFile } from "../types";
import { pluralize } from "../utils";
import type { RnVersionInfo } from "./rnCatalog";
import {
  headlineSignalsBreakingChange,
  type ReleaseNotes,
} from "./releaseNotes";

export type RiskLevel = "low" | "medium" | "high";

export interface DiffHighlights {
  total: number;
  android: number;
  ios: number;
  javascript: number;
  config: number;
  other: number;
  additions: number;
  deletions: number;
  /** Files that almost always have to be updated by hand. */
  criticalFiles: string[];
  /** Notable, human readable observations about the template diff. */
  observations: string[];
}

export interface UpgradeBrief {
  version: string;
  releasedAt?: string;
  blogUrl?: string;
  announcementUrl?: string;
  headline?: string;
  releaseNotesUrl?: string;
  risk: RiskLevel;
  riskReasons: string[];
  requirements: {
    react?: string;
    node?: string;
  };
  highlights: DiffHighlights;
  counts: {
    breaking: number;
    review: number;
    deprecated: number;
    removed: number;
    added: number;
    changed: number;
    fixed: number;
  };
}

const CRITICAL_PATTERNS = [
  "package.json",
  "android/build.gradle",
  "android/settings.gradle",
  "android/gradle.properties",
  "android/app/build.gradle",
  "ios/Podfile",
  "ios/build.gradle",
  "babel.config.js",
  "metro.config.js",
  "tsconfig.json",
  "app.json",
  "Gemfile",
  "index.js",
];

const OBSERVATION_RULES: Array<{
  match: RegExp;
  describe: (file: string) => string;
}> = [
  {
    match: /android\/gradle\.properties$/,
    describe: () =>
      "Gradle properties changed - check the new architecture flags before building.",
  },
  {
    match: /android\/settings\.gradle$/,
    describe: () =>
      "Gradle settings changed - plugin and version requirements moved.",
  },
  {
    match: /android\/build\.gradle$/,
    describe: () => "Root Gradle build changed - build tooling requirements moved.",
  },
  {
    match: /ios\/Podfile$/,
    describe: () => "CocoaPods setup changed - re-run `pod install` after merging.",
  },
  {
    match: /babel\.config\.js$/,
    describe: () => "Babel configuration changed - the preset list moved.",
  },
  {
    match: /metro\.config\.js$/,
    describe: () => "Metro configuration changed - bundler defaults moved.",
  },
  {
    match: /tsconfig\.json$/,
    describe: () => "TypeScript configuration changed - compiler options moved.",
  },
  {
    match: /android\/app\/src\/main\/java\/.*MainApplication\.kt$/,
    describe: () =>
      "MainApplication changed - the new architecture wiring is part of this file.",
  },
  {
    match: /android\/app\/src\/main\/java\/.*MainActivity\.kt$/,
    describe: () => "MainActivity changed - the activity entry point was updated.",
  },
  {
    match: /ios\/.*AppDelegate\.(mm|swift|m)$/,
    describe: () =>
      "The iOS app delegate changed - this is the file that usually needs manual work.",
  },
  {
    match: /package\.json$/,
    describe: () => "Template dependencies changed - see the dependency tab for exact versions.",
  },
];

export function analyzeDiff(files: DiffFile[]): DiffHighlights {
  const highlights: DiffHighlights = {
    total: files.length,
    android: 0,
    ios: 0,
    javascript: 0,
    config: 0,
    other: 0,
    additions: 0,
    deletions: 0,
    criticalFiles: [],
    observations: [],
  };

  const observations = new Set<string>();

  for (const file of files) {
    const path = (file.newPath || file.oldPath || "").replace(/^RnDiffApp\//, "");
    const lower = path.toLowerCase();

    if (lower.startsWith("android/") || /\.(gradle|java|kt)$/.test(lower)) {
      highlights.android++;
    } else if (
      lower.startsWith("ios/") ||
      /\.(swift|m|mm|h|podspec)$/.test(lower)
    ) {
      highlights.ios++;
    } else if (/\.(js|jsx|ts|tsx)$/.test(lower)) {
      highlights.javascript++;
    } else if (/\.(json|ya?ml|xml|properties)$/.test(lower) || lower.startsWith(".")) {
      highlights.config++;
    } else {
      highlights.other++;
    }

    const hunks = (file.hunks ?? []) as Array<{
      changes?: Array<{ type?: string }>;
    }>;
    for (const hunk of hunks) {
      for (const change of hunk.changes ?? []) {
        if (change.type === "insert") highlights.additions++;
        else if (change.type === "delete") highlights.deletions++;
      }
    }

    if (CRITICAL_PATTERNS.some((pattern) => lower.endsWith(pattern))) {
      highlights.criticalFiles.push(path);
    }

    for (const rule of OBSERVATION_RULES) {
      if (rule.match.test(lower)) observations.add(rule.describe(path));
    }
  }

  highlights.criticalFiles = Array.from(new Set(highlights.criticalFiles)).sort();
  highlights.observations = Array.from(observations);

  return highlights;
}

function gradeRisk(
  releaseNotes: ReleaseNotes | null,
  headline: string | undefined,
  highlights: DiffHighlights
): { risk: RiskLevel; reasons: string[] } {
  const reasons: string[] = [];

  const headlineSignal = headlineSignalsBreakingChange(headline);
  const breakingCount = releaseNotes?.breaking.length ?? 0;
  const reviewCount = releaseNotes?.review.length ?? 0;
  const deprecatedCount = releaseNotes?.deprecated.length ?? 0;
  const removedCount = releaseNotes?.removed.length ?? 0;

  if (headlineSignal === true) {
    reasons.push("The official announcement lists breaking changes.");
  }
  if (breakingCount > 0) {
    reasons.push(
      `${pluralize(breakingCount, "change")} in the release notes ${
        breakingCount === 1 ? "is" : "are"
      } explicitly marked as breaking.`
    );
  }
  if (reviewCount > 0) {
    reasons.push(
      `${pluralize(reviewCount, "other change")} alter existing behaviour and ${
        reviewCount === 1 ? "is" : "are"
      } worth reviewing.`
    );
  }
  if (removedCount > 0) {
    reasons.push(`${removedCount} API${removedCount === 1 ? "" : "s"} were removed.`);
  }
  if (deprecatedCount > 0) {
    reasons.push(
      `${deprecatedCount} API${deprecatedCount === 1 ? "" : "s"} were deprecated and may require action.`
    );
  }
  if (highlights.criticalFiles.length > 0) {
    reasons.push(
      `${highlights.criticalFiles.length} build-critical file${highlights.criticalFiles.length === 1 ? "" : "s"} changed.`
    );
  }

  let risk: RiskLevel = "low";
  const score =
    (headlineSignal === true ? 2 : 0) +
    breakingCount +
    Math.min(reviewCount, 3) +
    removedCount +
    (deprecatedCount > 0 ? 1 : 0) +
    (highlights.criticalFiles.length > 0 ? 1 : 0);

  if (score >= 6) risk = "high";
  else if (score >= 2) risk = "medium";

  if (risk === "low") {
    reasons.push(
      headlineSignal === false
        ? "The official announcement states there are no breaking changes."
        : "No breaking changes were detected in the release notes."
    );
  } else if (headlineSignal === false) {
    reasons.push(
      "The official announcement states there are no breaking changes - the items below are behaviour changes to review."
    );
  }

  return { risk, reasons };
}

export function buildUpgradeBrief({
  version,
  versionInfo,
  releaseNotes,
  diffFiles,
}: {
  version: string;
  versionInfo?: RnVersionInfo;
  releaseNotes: ReleaseNotes | null;
  diffFiles: DiffFile[];
}): UpgradeBrief {
  const highlights = analyzeDiff(diffFiles);
  const { risk, reasons } = gradeRisk(
    releaseNotes,
    versionInfo?.blogHeadline,
    highlights
  );

  return {
    version,
    releasedAt: versionInfo?.releasedAt,
    blogUrl: versionInfo?.blogUrl,
    headline: versionInfo?.blogHeadline,
    releaseNotesUrl:
      releaseNotes?.url ??
      `https://github.com/facebook/react-native/releases/tag/v${version}`,
    announcementUrl: versionInfo?.blogUrl,
    risk,
    riskReasons: reasons,
    requirements: {
      react: versionInfo?.reactPeer,
      node: versionInfo?.nodeEngine,
    },
    highlights,
    counts: {
      breaking: releaseNotes?.breaking.length ?? 0,
      review: releaseNotes?.review.length ?? 0,
      deprecated: releaseNotes?.deprecated.length ?? 0,
      removed: releaseNotes?.removed.length ?? 0,
      added: releaseNotes?.added.length ?? 0,
      changed: releaseNotes?.changed.length ?? 0,
      fixed: releaseNotes?.fixed.length ?? 0,
    },
  };
}
