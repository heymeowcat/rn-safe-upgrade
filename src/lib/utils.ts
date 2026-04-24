/**
 * Small class-name helpers.
 *
 * `cn` behaves like `clsx` and additionally resolves conflicting Tailwind
 * utilities from the same group (the later class wins), which keeps component
 * overrides predictable without pulling in a dependency.
 */

type ClassValue =
  | string
  | number
  | null
  | undefined
  | false
  | ClassValue[]
  | Record<string, boolean | null | undefined>;

export function clsx(...inputs: ClassValue[]): string {
  const classes: string[] = [];

  for (const input of inputs) {
    if (!input) continue;
    if (typeof input === "string" || typeof input === "number") {
      classes.push(String(input));
      continue;
    }
    if (Array.isArray(input)) {
      const nested = clsx(...input);
      if (nested) classes.push(nested);
      continue;
    }
    for (const [key, value] of Object.entries(input)) {
      if (value) classes.push(key);
    }
  }

  return classes.join(" ");
}

/** Groups of mutually exclusive Tailwind utilities. */
const CONFLICT_GROUPS: Array<{ test: RegExp; prefix: string }> = [
  { test: /^p[xytblr]?-/, prefix: "p" },
  { test: /^m[xytblr]?-/, prefix: "m" },
  { test: /^w-/, prefix: "w" },
  { test: /^h-/, prefix: "h" },
  { test: /^text-(xs|sm|base|lg|xl|\d|xs|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)$/, prefix: "text-size" },
  { test: /^text-/, prefix: "text-color" },
  { test: /^bg-/, prefix: "bg" },
  { test: /^border-/, prefix: "border" },
  { test: /^rounded(-|$)/, prefix: "rounded" },
  { test: /^gap-/, prefix: "gap" },
  { test: /^flex-/, prefix: "flex" },
  { test: /^font-/, prefix: "font" },
  { test: /^shadow/, prefix: "shadow" },
  { test: /^opacity-/, prefix: "opacity" },
];

function groupOf(className: string): string | null {
  if (className.includes(":")) return null; // variants are scoped separately
  for (const group of CONFLICT_GROUPS) {
    if (group.test.test(className)) return group.prefix;
  }
  return null;
}

export function cn(...inputs: ClassValue[]): string {
  const list = clsx(...inputs).split(" ").filter(Boolean);
  const result: string[] = [];
  const seen = new Map<string, number>();

  for (const className of list) {
    const group = groupOf(className);
    if (!group) {
      result.push(className);
      continue;
    }
    const variantPrefix = className.includes(":")
      ? className.slice(0, className.lastIndexOf(":") + 1)
      : "";
    const key = `${variantPrefix}${group}`;
    const previous = seen.get(key);
    if (previous !== undefined) {
      result[previous] = className;
    } else {
      seen.set(key, result.length);
      result.push(className);
    }
  }

  return result.join(" ");
}

export function formatRelativeTime(input: string | number | Date): string {
  const timestamp =
    input instanceof Date
      ? input.getTime()
      : typeof input === "number"
        ? input
        : new Date(input).getTime();

  if (Number.isNaN(timestamp)) return "";

  const seconds = Math.round((Date.now() - timestamp) / 1000);
  const units: Array<[number, string]> = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.345, "week"],
    [12, "month"],
    [Number.POSITIVE_INFINITY, "year"],
  ];

  let value = seconds;
  let unit = "second";

  for (const [factor, name] of units) {
    if (Math.abs(value) < factor) {
      unit = name;
      break;
    }
    value = Math.round(value / factor);
    unit = name;
  }

  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  return formatter.format(-value, unit as Intl.RelativeTimeFormatUnit);
}

export function formatDate(input: string | number | Date): string {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const IRREGULAR_PLURALS: Record<string, string> = {
  release: "releases",
  index: "indices",
  analysis: "analyses",
};

export function pluralize(count: number, singular: string, plural?: string): string {
  let resolved = plural;

  if (!resolved) {
    if (IRREGULAR_PLURALS[singular]) {
      resolved = IRREGULAR_PLURALS[singular];
    } else if (
      singular.endsWith("y") &&
      !/[aeiou]y$/.test(singular) &&
      singular.length > 1
    ) {
      resolved = `${singular.slice(0, -1)}ies`;
    } else if (/(s|x|z|ch|sh)$/.test(singular)) {
      resolved = `${singular}es`;
    } else {
      resolved = `${singular}s`;
    }
  }

  return `${count} ${count === 1 ? singular : resolved}`;
}
