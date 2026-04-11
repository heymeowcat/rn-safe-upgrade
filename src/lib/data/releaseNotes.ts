/**
 * Turns the auto-published React Native release notes into structured,
 * actionable information.
 *
 * The notes are pulled from the GitHub release body that React Native
 * publishes for every single version - there is no hand-written content
 * involved, so every release (including ones released today) is covered.
 */
import { cachedFetchJson } from "./http";

export type NoteCategory =
  | "added"
  | "changed"
  | "deprecated"
  | "removed"
  | "fixed"
  | "security";

export interface ReleaseNote {
  category: NoteCategory;
  /** "Android", "iOS", "C++", "JavaScript API" ... */
  area?: string;
  /** The bullet text with links and commit hashes stripped. */
  text: string;
  /** True when the entry explicitly describes a breaking change. */
  breaking: boolean;
  /** True when the entry changes behaviour and is worth a closer look. */
  review: boolean;
  /** The PR / commit URL when the entry contains one. */
  url?: string;
}

export interface ReleaseNotes {
  version: string;
  tag: string;
  publishedAt?: string;
  url?: string;
  /** The prose summary of releases that do not use the structured format. */
  summary?: string;
  /** Links the release points at (announcements, guides, release notes). */
  links: Array<{ title: string; url: string }>;
  notes: ReleaseNote[];
  breaking: ReleaseNote[];
  review: ReleaseNote[];
  deprecated: ReleaseNote[];
  removed: ReleaseNote[];
  added: ReleaseNote[];
  changed: ReleaseNote[];
  fixed: ReleaseNote[];
  security: ReleaseNote[];
  /** Headline pulled from the official announcement, when available. */
  headline?: string;
  error?: string;
}

const CATEGORY_BY_HEADING: Record<string, NoteCategory> = {
  added: "added",
  new: "added",
  features: "added",
  changed: "changed",
  improvements: "changed",
  deprecated: "deprecated",
  deprecations: "deprecated",
  removed: "removed",
  removals: "removed",
  fixed: "fixed",
  fixes: "fixed",
  bugfixes: "fixed",
  security: "security",
};

/**
 * High confidence signals: the entry explicitly describes a removal, a
 * renamed API or a new hard requirement.
 */
const BREAKING_PATTERNS = [
  /\bbreaking change\b/i,
  /\bhas been removed\b/i,
  /\bwas removed\b/i,
  /\bwill be removed\b/i,
  /\bno longer supported\b/i,
  /\bno longer available\b/i,
  /\bnow requires?\b/i,
  /\bmust now\b/i,
  /\brenamed to\b/i,
  /\bdropped support for\b/i,
  /\bis deprecated\b/i,
  /\bdeprecation of\b/i,
  /\bdisabled by default\b/i,
];

/**
 * Softer signals: the behaviour changes, so it deserves a look, but the
 * release may not consider it a breaking change.
 */
const REVIEW_PATTERNS = [
  /\bno longer\b/i,
  /\bfails? to\b/i,
  /\bdeprecat/i,
  /\bmigrat/i,
  /\bbreaking\b/i,
  /\bmandatory\b/i,
];

const URL_PATTERN = /\]\((https?:\/\/[^)\s]+)\)/g;

function isBreaking(text: string): boolean {
  return BREAKING_PATTERNS.some((pattern) => pattern.test(text));
}

function needsReview(text: string): boolean {
  return REVIEW_PATTERNS.some((pattern) => pattern.test(text));
}

function stripMarkdown(text: string): string {
  return (
    text
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      // Drop the trailing "(commit by @author)" marker the release bot adds.
      .replace(/\s*\(\s*[0-9a-f]{7,40}\s+by\s+@[^)]*\)\s*$/i, "")
      .replace(/\s*\(\s*[0-9a-f]{7,40}\s*\)\s*$/i, "")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function extractUrl(text: string): string | undefined {
  URL_PATTERN.lastIndex = 0;
  const match = URL_PATTERN.exec(text);
  return match?.[1];
}

/**
 * Parses a React Native release body into structured notes.
 *
 * The body looks like:
 *   ### Added
 *   - **C++**: Something changed ([abc123](link) by [@user](link))
 *   #### Android specific
 *   - **Android**: Something else
 */
export function parseReleaseBody(
  body: string,
  options: { keepFullText?: boolean } = {}
): ReleaseNote[] {
  const notes: ReleaseNote[] = [];
  if (!body) return notes;

  // GitHub release bodies use CRLF line endings.
  body = body.replace(/\r\n/g, "\n");

  let category: NoteCategory | null = null;
  let area: string | undefined;
  let sawHeading = false;

  for (const rawLine of body.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    const heading = line.match(/^#{2,5}\s+(.*)$/);
    if (heading) {
      const title = heading[1].replace(/[*:]/g, "").trim();
      const normalized = title.toLowerCase();
      const matched = Object.entries(CATEGORY_BY_HEADING).find(([key]) =>
        normalized.startsWith(key)
      );
      if (matched) {
        category = matched[1];
        area = undefined;
        sawHeading = true;
      } else {
        // A sub-heading such as "Android specific" or "C++" scopes the bullets.
        category = null;
        area = title.replace(/\s+specific$/i, "").trim();
      }
      continue;
    }

    if (!line.startsWith("-") && !line.startsWith("*")) continue;

    const content = line.replace(/^[-*]\s*/, "").trim();
    if (!content) continue;

    const inlineArea = content.match(/^\*\*([^*]+)\*\*\s*:\s*(.*)$/);
    let noteArea = area;
    let text = content;

    if (inlineArea) {
      noteArea = inlineArea[1].trim();
      text = inlineArea[2].trim();
    }

    const clean = options.keepFullText ? text : stripMarkdown(text);

    // Auto-detected breaking changes are only meaningful for change-ish
    // categories; a fix is never a breaking change.
    const changeLike =
      category === "changed" ||
      category === "deprecated" ||
      category === "removed";

    const breaking = changeLike ? isBreaking(clean) : false;
    const review = changeLike && !breaking ? needsReview(clean) : false;

    notes.push({
      category: category ?? "changed",
      area: noteArea,
      text: clean,
      breaking,
      review,
      url: extractUrl(content),
    });
  }

  // Releases without a single section heading use the prose format - those
  // are handled by parseProseRelease instead.
  return sawHeading ? notes : [];
}

/**
 * Older releases use a prose format instead of the structured sections. The
 * summary and the links are still worth showing.
 */
export function parseProseRelease(body: string): {
  summary?: string;
  links: Array<{ title: string; url: string }>;
} {
  if (!body) return { links: [] };

  const [head] = body.replace(/\r\n/g, "\n").split(/\n-{3,}\n/);
  const withoutComments = head
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\n{2,}/g, "\n\n")
    .trim();

  const links: Array<{ title: string; url: string }> = [];
  const seen = new Set<string>();
  for (const match of withoutComments.matchAll(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g
  )) {
    const url = match[2];
    if (seen.has(url)) continue;
    seen.add(url);
    // Only the links that actually help: announcements, guides and the
    // changelog.
    if (!/reactnative\.dev|github\.com\/facebook\/react-native/.test(url)) {
      continue;
    }
    links.push({ title: match[1], url });
  }

  const summary = withoutComments
    .replace(/\n{2,}/g, "\n\n")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();

  return { summary: summary.slice(0, 1200), links };
}

interface GhReleaseDetail {
  tag_name: string;
  published_at?: string;
  html_url?: string;
  body?: string;
  prerelease?: boolean;
}

export async function fetchReleaseNotes(
  version: string
): Promise<ReleaseNotes | null> {
  const clean = version.replace(/[\^~]/g, "");
  if (!/^\d+\.\d+\.\d+$/.test(clean)) return null;

  const result = await cachedFetchJson<GhReleaseDetail>(
    `gh-release-${clean}`,
    `https://api.github.com/repos/facebook/react-native/releases/tags/v${clean}`,
    { ttl: 24 * 60 * 60 * 1000, timeout: 15000 }
  );

  if (!result) return null;

  const release = result.data;
  const notes = parseReleaseBody(release.body ?? "");
  const prose = notes.length === 0 ? parseProseRelease(release.body ?? "") : { links: [] };

  return {
    version: clean,
    tag: release.tag_name,
    publishedAt: release.published_at,
    url: release.html_url,
    summary: prose.summary,
    links: prose.links,
    notes,
    breaking: notes.filter((n) => n.breaking),
    review: notes.filter((n) => n.review),
    deprecated: notes.filter((n) => n.category === "deprecated"),
    removed: notes.filter((n) => n.category === "removed"),
    added: notes.filter((n) => n.category === "added"),
    changed: notes.filter((n) => n.category === "changed"),
    fixed: notes.filter((n) => n.category === "fixed"),
    security: notes.filter((n) => n.category === "security"),
    error: result.error,
  };
}

/**
 * The headline of the official blog announcement often states whether the
 * release contains breaking changes - that is the fastest way to grade the
 * risk of an upgrade.
 */
export function headlineSignalsBreakingChange(
  headline: string | undefined
): boolean | null {
  if (!headline) return null;
  const text = headline.toLowerCase();
  if (text.includes("no breaking change")) return false;
  if (text.includes("breaking change")) return true;
  return null;
}
