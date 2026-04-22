/**
 * Builds the upgrade plan - the single artifact that describes what has to
 * change in a project when moving from one React Native version to another.
 *
 * The plan is what the local agent bridge executes, what the Markdown export
 * contains, and what an agent CLI receives as its prompt.
 */
import type { DependencyAnalysis, DiffFile, PackageJson } from "../types";
import type { UpgradeBrief } from "../data/upgradeBrief";
import type { ReleaseNotes } from "../data/releaseNotes";
import type { UpgradePlanPayload } from "../agent/bridgeClient";

export interface PlanInput {
  fromVersion: string;
  toVersion: string;
  appName?: string;
  appPackage?: string;
  reactPeer?: string;
  packageJson?: PackageJson | null;
  mergedPackageJson?: PackageJson | null;
  analysis?: DependencyAnalysis[];
  diffFiles?: DiffFile[];
  brief?: UpgradeBrief | null;
  releaseNotes?: ReleaseNotes | null;
  useAgent?: boolean;
  createMissingFiles?: boolean;
}

export interface UpgradePlan extends UpgradePlanPayload {
  /** The merged package.json, ready to be written by the bridge. */
  packageJsonContent?: string;
  dependencyUpdates: Array<{
    name: string;
    current: string;
    version: string;
    range?: string;
  }>;
  breakingChanges: Array<{ area?: string; text: string; url?: string }>;
  filesToApply: Array<{ path: string; binary?: boolean }>;
  /** Files the new template version no longer contains. */
  filesToDelete: Array<{ path: string }>;
  requiredFiles: string[];
}

export function buildUpgradePlan(input: PlanInput): UpgradePlan {
  const dependencyUpdates = (input.analysis ?? [])
    .filter((item) => item.needsUpdate && item.recommendedVersion)
    .map((item) => ({
      name: item.package,
      current: item.currentVersion,
      version: item.recommendedVersion,
      // React Native itself is pinned - the packages around it use a range.
      range:
        item.package === "react-native"
          ? item.recommendedVersion
          : `^${item.recommendedVersion}`,
    }));

  // React has to move together with React Native.
  const reactPeer = input.reactPeer;
  if (reactPeer && input.packageJson) {
    const currentReact =
      input.packageJson.dependencies?.react ??
      input.packageJson.devDependencies?.react;
    const alreadyCovered = dependencyUpdates.some(
      (update) => update.name === "react"
    );
    if (currentReact && currentReact !== reactPeer && !alreadyCovered) {
      dependencyUpdates.push({
        name: "react",
        current: currentReact,
        version: reactPeer.replace(/^[\^~]/, ""),
        range: reactPeer,
      });
    }
  }

  const breakingChanges = [
    ...(input.releaseNotes?.breaking ?? []),
    ...(input.releaseNotes?.deprecated ?? []),
    ...(input.releaseNotes?.removed ?? []),
  ].map((note) => ({ area: note.area, text: note.text, url: note.url }));

  const filesToApply = (input.diffFiles ?? [])
    .filter((file) => file.type !== "delete")
    .map((file) => ({
      path: (file.newPath || file.oldPath || "").replace(/^RnDiffApp\//, ""),
      binary: file.isBinary,
    }))
    .filter((file) => file.path.length > 0);

  const filesToDelete = (input.diffFiles ?? [])
    .filter((file) => file.type === "delete")
    .map((file) => ({
      path: (file.oldPath || "").replace(/^RnDiffApp\//, ""),
    }))
    .filter((file) => file.path.length > 0);

  return {
    fromVersion: input.fromVersion,
    toVersion: input.toVersion,
    packageJsonContent: input.mergedPackageJson
      ? JSON.stringify(input.mergedPackageJson, null, 2) + "\n"
      : undefined,
    appName: input.appName,
    appPackage: input.appPackage,
    reactVersion: reactPeer,
    dependencyUpdates,
    breakingChanges,
    requiredFiles: filesToApply.map((file) => file.path),
    filesToApply,
    filesToDelete,
    useAgent: input.useAgent ?? false,
    createMissingFiles: input.createMissingFiles ?? false,
  };
}

/** Renders the plan as Markdown - handy for a PR description or a prompt. */
export function planToMarkdown(plan: UpgradePlan, brief?: UpgradeBrief | null): string {
  const lines: string[] = [];

  lines.push(`# React Native ${plan.fromVersion} → ${plan.toVersion}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");

  if (brief) {
    lines.push(`- **Risk:** ${brief.risk.toUpperCase()}`);
    if (brief.headline) lines.push(`- **Release:** ${brief.headline}`);
    if (brief.requirements.react) {
      lines.push(`- **Required react:** ${brief.requirements.react}`);
    }
    if (brief.requirements.node) {
      lines.push(`- **Required Node:** ${brief.requirements.node}`);
    }
    lines.push(
      `- **Template changes:** ${brief.highlights.total} files (+${brief.highlights.additions} / -${brief.highlights.deletions})`
    );
    lines.push("");
    if (brief.riskReasons.length) {
      lines.push("### Why");
      lines.push("");
      for (const reason of brief.riskReasons) lines.push(`- ${reason}`);
      lines.push("");
    }
  }

  if (plan.dependencyUpdates.length) {
    lines.push("## Dependency updates");
    lines.push("");
    lines.push("| Package | Current | Target |");
    lines.push("| --- | --- | --- |");
    for (const update of plan.dependencyUpdates) {
      lines.push(
        `| \`${update.name}\` | \`${update.current}\` | \`${update.range ?? update.version}\` |`
      );
    }
    lines.push("");
  }

  if (plan.breakingChanges.length) {
    lines.push("## Breaking changes and deprecations");
    lines.push("");
    for (const change of plan.breakingChanges) {
      const area = change.area ? `**${change.area}** — ` : "";
      lines.push(`- ${area}${change.text}`);
    }
    lines.push("");
  }

  if (plan.requiredFiles.length) {
    lines.push("## Files changed in the template");
    lines.push("");
    for (const file of plan.requiredFiles) lines.push(`- \`${file}\``);
    lines.push("");
  }

  lines.push("## Checklist");
  lines.push("");
  lines.push("- [ ] Dependency versions updated");
  lines.push("- [ ] Native project files updated");
  lines.push("- [ ] Breaking changes handled in application code");
  lines.push("- [ ] App builds on Android");
  lines.push("- [ ] App builds on iOS");
  lines.push("");

  return lines.join("\n");
}
