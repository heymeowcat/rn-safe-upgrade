/**
 * Builds the upgrade plan - the single artifact that describes what has to
 * change in a project when moving from one React Native version to another.
 *
 * The plan is what the local agent bridge executes, what the Markdown export
 * contains and what an agent CLI receives as its brief. It is written as a list
 * of steps, not as a description of the situation, because the point of the
 * plan is that something can be done with it.
 */
import type { DependencyAnalysis, DiffFile, PackageJson } from "../types";
import type { UpgradeBrief } from "../data/upgradeBrief";
import type { ReleaseNotes } from "../data/releaseNotes";
import type { UpgradePlanPayload } from "../agent/bridgeClient";
import { guidanceFor } from "./guidance";

export interface PlanInput {
  fromVersion: string;
  toVersion: string;
  appName?: string;
  appPackage?: string;
  reactPeer?: string;
  typesPeer?: string;
  nodeEngine?: string;
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
  breakingChanges: Array<{
    area?: string;
    text: string;
    url?: string;
    file?: string;
    action: string;
  }>;
  filesToApply: Array<{ path: string; binary?: boolean }>;
  /** Files the new template version no longer contains. */
  filesToDelete: Array<{ path: string }>;
  requiredFiles: string[];
  /** The steps, in the order they have to be done. */
  steps: string[];
}

/**
 * The paths in the template diff carry the name of the reference app, the
 * paths of the project that is being upgraded carry the name of that app.
 */
export function normalizeTemplatePath(path: string, appName?: string): string {
  let result = path.replace(/^RnDiffApp\//, "");
  if (appName) {
    result = result.split("RnDiffApp").join(appName);
  }
  return result;
}

export function buildUpgradePlan(input: PlanInput): UpgradePlan {
  const dependencyUpdates: UpgradePlan["dependencyUpdates"] = (
    input.analysis ?? []
  )
    .filter((item) => item.needsUpdate && item.recommendedVersion)
    .map((item) => ({
      name: item.package,
      current: item.currentVersion,
      version: item.recommendedVersion,
      // React Native itself is pinned, the packages around it use a range.
      range:
        item.package === "react-native"
          ? item.recommendedVersion
          : `^${item.recommendedVersion}`,
    }));

  // React Native and React always move together, even when the project was
  // not loaded - the plan is still useful without it.
  const addUpdate = (
    name: string,
    current: string,
    range: string,
    version: string
  ) => {
    if (dependencyUpdates.some((update) => update.name === name)) return;
    dependencyUpdates.push({ name, current, version, range });
  };

  if (input.packageJson) {
    const current =
      input.packageJson.dependencies?.["react-native"] ??
      input.packageJson.devDependencies?.["react-native"] ??
      input.fromVersion;
    addUpdate("react-native", current, input.toVersion, input.toVersion);
  }

  if (input.reactPeer && input.packageJson) {
    const currentReact =
      input.packageJson.dependencies?.react ??
      input.packageJson.devDependencies?.react;
    if (currentReact) {
      addUpdate(
        "react",
        currentReact,
        input.reactPeer,
        input.reactPeer.replace(/^[\^~]/, "")
      );
    }
  }

  const breakingChanges = [
    ...(input.releaseNotes?.breaking ?? []),
    ...(input.releaseNotes?.deprecated ?? []),
    ...(input.releaseNotes?.removed ?? []),
    ...(input.releaseNotes?.review ?? []),
  ].map((note) => {
    const guidance = guidanceFor(note.text, note.area);
    return {
      area: note.area,
      text: note.text,
      url: note.url,
      file: guidance.file,
      action: guidance.action,
    };
  });

  const filesToApply = (input.diffFiles ?? [])
    .filter((file) => file.type !== "delete")
    .map((file) => ({
      path: normalizeTemplatePath(
        (file.newPath || file.oldPath || "").replace(/^RnDiffApp\//, ""),
        input.appName
      ),
      binary: file.isBinary,
    }))
    .filter((file) => file.path.length > 0);

  const filesToDelete = (input.diffFiles ?? [])
    .filter((file) => file.type === "delete")
    .map((file) => ({
      path: normalizeTemplatePath(file.oldPath || "", input.appName),
    }))
    .filter((file) => file.path.length > 0);

  const steps: string[] = [];

  if (dependencyUpdates.length) {
    steps.push(
      `Update ${dependencyUpdates.length} dependenc${
        dependencyUpdates.length === 1 ? "y" : "ies"
      } in package.json.`
    );
  }
  if (filesToApply.length) {
    steps.push(
      `Apply the ${filesToApply.length} template file${
        filesToApply.length === 1 ? "" : "s"
      } of React Native ${input.toVersion}.`
    );
  }
  if (breakingChanges.length) {
    steps.push(
      `Update the application code for ${breakingChanges.length} breaking change${
        breakingChanges.length === 1 ? "" : "s"
      } and deprecation${breakingChanges.length === 1 ? "" : "s"}.`
    );
  }
  steps.push(
    `Reinstall the dependencies and build the app for Android and iOS.`
  );

  return {
    fromVersion: input.fromVersion,
    toVersion: input.toVersion,
    packageJsonContent: input.mergedPackageJson
      ? JSON.stringify(input.mergedPackageJson, null, 2) + "\n"
      : undefined,
    appName: input.appName,
    appPackage: input.appPackage,
    reactVersion: input.reactPeer,
    dependencyUpdates,
    breakingChanges,
    requiredFiles: filesToApply.map((file) => file.path),
    filesToApply,
    filesToDelete,
    steps,
    useAgent: input.useAgent ?? false,
    createMissingFiles: input.createMissingFiles ?? false,
  };
}

/** The command that installs the versions of the plan. */
export function installCommand(plan: UpgradePlan): string {
  if (!plan.dependencyUpdates.length) return "";
  return `npm install ${plan.dependencyUpdates
    .map((update) => `${update.name}@${update.range ?? update.version}`)
    .join(" ")}`;
}

/** Renders the plan as Markdown - the brief for the agent and for a reviewer. */
export function planToMarkdown(
  plan: UpgradePlan,
  brief?: UpgradeBrief | null
): string {
  const lines: string[] = [];

  lines.push(`# React Native ${plan.fromVersion} → ${plan.toVersion}`);
  lines.push("");

  if (brief) {
    lines.push("## Summary");
    lines.push("");
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

  // --- the work ------------------------------------------------------------
  lines.push("## What to do");
  lines.push("");

  let step = 1;
  const stepNumber = () => step++;

  if (plan.dependencyUpdates.length) {
    lines.push(`### ${stepNumber()}. Update the dependencies`);
    lines.push("");
    lines.push("| Package | Current | Target |");
    lines.push("| --- | --- | --- |");
    for (const update of plan.dependencyUpdates) {
      lines.push(
        `| \`${update.name}\` | \`${update.current}\` | \`${update.range ?? update.version}\` |`
      );
    }
    lines.push("");
    const command = installCommand(plan);
    if (command) {
      lines.push("```bash");
      lines.push(command);
      lines.push("```");
      lines.push("");
    }
    if (plan.packageJsonContent) {
      lines.push(
        "The updated `package.json` is included below, write it as it is."
      );
      lines.push("");
    }
  }

  if (plan.filesToApply.length) {
    lines.push(`### ${stepNumber()}. Apply the template files`);
    lines.push("");
    lines.push(
      `These files changed between the React Native ${plan.fromVersion} and ${plan.toVersion} templates. Copy the new version over the project, keeping the app name and the package id.`
    );
    lines.push("");
    for (const file of plan.filesToApply) {
      lines.push(`- \`${file.path}\``);
    }
    lines.push("");
  }

  if (plan.filesToDelete.length) {
    lines.push(
      `The new template does not contain these files any more, remove them if the project did not change them:`
    );
    lines.push("");
    for (const file of plan.filesToDelete) {
      lines.push(`- \`${file.path}\``);
    }
    lines.push("");
  }

  if (plan.breakingChanges.length) {
    lines.push(`### ${stepNumber()}. Update the application code`);
    lines.push("");
    for (const change of plan.breakingChanges) {
      const area = change.area ? `**${change.area}**` : "**Change**";
      lines.push(`- ${area} — ${change.text}`);
      lines.push(`  - Do: ${change.action}`);
      if (change.file) lines.push(`  - Usual place: \`${change.file}\``);
    }
    lines.push("");
  }

  lines.push(`### ${stepNumber()}. Verify`);
  lines.push("");
  lines.push("```bash");
  lines.push("npm install");
  if (plan.filesToApply.some((file) => file.path.startsWith("ios/"))) {
    lines.push("cd ios && pod install && cd ..");
  }
  lines.push("npx react-native run-android");
  lines.push("npx react-native run-ios");
  lines.push("```");
  lines.push("");

  // --- the context ---------------------------------------------------------
  if (brief && (brief.highlights.criticalFiles.length > 0 || brief.highlights.observations.length > 0)) {
    lines.push("## Notes");
    lines.push("");
    for (const observation of brief.highlights.observations) {
      lines.push(`- ${observation}`);
    }
    if (brief.highlights.criticalFiles.length > 0) {
      lines.push(
        `- These files usually need a manual look: ${brief.highlights.criticalFiles
          .map((file) => `\`${file}\``)
          .join(", ")}.`
      );
    }
    lines.push("");
  }

  if (plan.packageJsonContent) {
    lines.push("## The updated package.json");
    lines.push("");
    lines.push("```json");
    lines.push(plan.packageJsonContent.trimEnd());
    lines.push("```");
    lines.push("");
  }

  lines.push("## Checklist");
  lines.push("");
  for (const entry of plan.steps) {
    lines.push(`- [ ] ${entry}`);
  }
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(
    "Generated with [RN Safe Upgrade](https://heymeowcat.is-a.dev/rn-safe-upgrade/)"
  );
  lines.push("");

  return lines.join("\n");
}
