/**
 * Rebuilds a unified patch from parsed diff hunks so a single file change can
 * be copied or applied on its own.
 */
import type { DiffFile } from "../types";

interface HunkLike {
  content: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  changes: Array<{
    type: "insert" | "delete" | "normal";
    content: string;
    lineNumber?: number;
    oldLineNumber?: number;
    newLineNumber?: number;
  }>;
}

export function fileToPatch(file: DiffFile): string {
  const hunks = (file.hunks ?? []) as unknown as HunkLike[];
  if (!hunks.length) return "";

  const oldPath = file.oldPath || "/dev/null";
  const newPath = file.newPath || "/dev/null";
  const lines: string[] = [];

  lines.push(`diff --git a/${oldPath} b/${newPath}`);
  if (file.type === "add") {
    lines.push("new file mode 100644");
  } else if (file.type === "delete") {
    lines.push("deleted file mode 100644");
  }
  lines.push(`--- ${file.type === "add" ? "/dev/null" : `a/${oldPath}`}`);
  lines.push(`+++ ${file.type === "delete" ? "/dev/null" : `b/${newPath}`}`);

  for (const hunk of hunks) {
    lines.push(
      `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@${hunk.content ?? ""}`
    );
    for (const change of hunk.changes) {
      const prefix =
        change.type === "insert" ? "+" : change.type === "delete" ? "-" : " ";
      lines.push(prefix + change.content);
    }
  }

  return lines.join("\n") + "\n";
}

export function filesToPatch(files: DiffFile[]): string {
  return files.map((file) => fileToPatch(file)).join("");
}
