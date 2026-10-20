/**
 * Small class-name helpers.
 *
 * `cn` behaves like `clsx` and resolves conflicting Tailwind utilities from
 * the same group (the later class wins). The groups have to be precise: the
 * padding axes are separate, a text size is not a text colour and a font
 * family is not a font weight. Merging them by a loose prefix silently drops
 * classes.
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

const TEXT_SIZES =
  /^(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)$/;
const TEXT_ALIGNMENTS = /^(left|center|right|justify|start|end)$/;
const FONT_FAMILIES = /^(sans|serif|mono)$/;
const FONT_WEIGHTS =
  /^(thin|extralight|light|normal|medium|semibold|bold|extrabold|black|[1-9]00)$/;

/**
 * The group a utility belongs to. Two classes in the same group cannot be
 * applied at the same time, so the later one replaces the earlier one.
 */
function groupOf(className: string): string | null {
  // A variant is only active in a certain state, so it never conflicts with
  // the base class.
  if (className.includes(":")) return null;

  // The padding and the margin axes are independent of each other.
  const box = className.match(/^(p|m)([xytrbl])?-/);
  if (box) return `${box[1]}-${box[2] ?? "all"}`;

  if (className.startsWith("text-")) {
    const value = className.slice(5);
    if (TEXT_ALIGNMENTS.test(value)) return "text-align";
    if (TEXT_SIZES.test(value)) return "text-size";
    if (value.startsWith("[")) {
      const inner = value.slice(1, -1);
      // A length is a size, a colour is a colour.
      if (/^(#|rgb|hsl|oklch|oklab|lab|lch|color)/.test(inner)) {
        return "text-color";
      }
      return "text-size";
    }
    return "text-color";
  }

  if (className.startsWith("font-")) {
    const value = className.slice(5);
    if (FONT_FAMILIES.test(value)) return "font-family";
    if (FONT_WEIGHTS.test(value)) return "font-weight";
    if (value === "italic" || value === "not-italic") return "font-style";
    if (value.startsWith("[")) return "font-size";
    return null;
  }

  if (className.startsWith("w-")) return "width";
  if (className.startsWith("h-")) return "height";
  if (className.startsWith("min-w-")) return "min-width";
  if (className.startsWith("max-w-")) return "max-width";
  if (className.startsWith("min-h-")) return "min-height";
  if (className.startsWith("max-h-")) return "max-height";
  if (className.startsWith("bg-")) return "background";
  if (className.startsWith("rounded")) return "radius";
  if (className.startsWith("gap-")) return "gap";
  if (className.startsWith("flex-")) return "flex";
  if (className.startsWith("shadow")) return "shadow";
  if (className.startsWith("opacity-")) return "opacity";
  if (className.startsWith("z-")) return "z-index";
  if (className.startsWith("inset-")) return "inset";
  if (className.startsWith("top-")) return "top";
  if (className.startsWith("left-")) return "left";
  if (className.startsWith("right-")) return "right";
  if (className.startsWith("border")) {
    if (className === "border" || /^border-\d/.test(className)) {
      return "border-width";
    }
    if (className.startsWith("border-")) return "border-color";
    return null;
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
    const previous = seen.get(group);
    if (previous !== undefined) {
      result[previous] = className;
    } else {
      seen.set(group, result.length);
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
