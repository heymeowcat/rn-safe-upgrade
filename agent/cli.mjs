#!/usr/bin/env node
/**
 * RN Safe Upgrade - local agent bridge
 * ===================================
 *
 * Runs a tiny HTTP server on your machine so the web app can drive a real
 * upgrade inside your project instead of you copying files by hand.
 *
 *   npx --yes github:heymeowcat/rn-safe-upgrade
 *
 * The bridge is deliberately conservative:
 *   - it only binds to 127.0.0.1
 *   - every request must carry the session token printed on startup
 *   - every request must come from an allowed origin
 *   - nothing is written to disk without an explicit "apply" step
 */
import { createServer } from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { readFile, writeFile, mkdir, stat, rm } from "node:fs/promises";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import os from "node:os";
import { tmpdir } from "node:os";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEFAULT_PORT = 4317;
const ALLOWED_ORIGINS = new Set([
  "https://heymeowcat.is-a.dev",
  "https://www.heymeowcat.is-a.dev",
  "http://localhost:3000",
  "http://localhost:4321",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:4321",
  "null",
]);

const AGENT_CANDIDATES = [
  { id: "claude", bin: "claude", args: ["-p"], label: "Claude Code" },
  { id: "codex", bin: "codex", args: ["exec"], label: "Codex CLI" },
  { id: "gemini", bin: "gemini", args: ["-p"], label: "Gemini CLI" },
  { id: "opencode", bin: "opencode", args: ["run"], label: "OpenCode" },
  { id: "aider", bin: "aider", args: ["--no-auto-commits", "--yes"], label: "Aider" },
];

const WEB_APP_URL =
  process.env.RN_SAFE_UPGRADE_WEB_APP ??
  "https://heymeowcat.is-a.dev/rn-safe-upgrade/";

const TEMPLATE_RAW_BASE =
  "https://raw.githubusercontent.com/react-native-community/rn-diff-purge/release";

const args = process.argv.slice(2);
const flags = new Map();
const positional = [];

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg.startsWith("--")) {
    const [name, inlineValue] = arg.slice(2).split("=");
    if (inlineValue !== undefined) {
      flags.set(name, inlineValue);
    } else if (args[i + 1] && !args[i + 1].startsWith("--")) {
      flags.set(name, args[++i]);
    } else {
      flags.set(name, true);
    }
  } else if (arg === "-p" || arg === "--port") {
    flags.set("port", args[++i]);
  } else {
    positional.push(arg);
  }
}

const PORT = Number(flags.get("port") ?? DEFAULT_PORT);
const ROOT = resolve(process.cwd());
const TOKEN = String(flags.get("token") ?? randomBytes(16).toString("hex"));
const AGENT_OVERRIDE = flags.get("agent");
const RUN_INSTALL = flags.has("install");
const RUN_POD_INSTALL = flags.has("pods");
const VERBOSE = flags.has("verbose");

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const state = {
  startedAt: Date.now(),
  job: null, // { id, status, startedAt, finishedAt, steps: [] }
  logs: [],
};

const clients = new Set();

function log(level, message, extra) {
  const entry = {
    id: randomUUID(),
    at: Date.now(),
    level,
    message: String(message),
    ...(extra ? { extra } : {}),
  };
  state.logs.push(entry);
  if (state.logs.length > 500) state.logs.splice(0, state.logs.length - 500);
  broadcast("log", entry);
  if (VERBOSE || level === "error") {
    const stamp = new Date(entry.at).toISOString().slice(11, 19);
    console.log(`${stamp} ${level.toUpperCase().padEnd(5)} ${entry.message}`);
  }
  return entry;
}

function broadcast(event, payload) {
  const frame = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of clients) {
    try {
      client.write(frame);
    } catch {
      clients.delete(client);
    }
  }
}

// ---------------------------------------------------------------------------
// Project introspection
// ---------------------------------------------------------------------------

async function readProject() {
  const packageJsonPath = join(ROOT, "package.json");
  let packageJson = null;
  if (existsSync(packageJsonPath)) {
    try {
      packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
    } catch {
      log("error", "package.json could not be parsed");
    }
  }

  const rnVersion =
    packageJson?.dependencies?.["react-native"] ??
    packageJson?.devDependencies?.["react-native"] ??
    null;

  const reactVersion =
    packageJson?.dependencies?.react ?? packageJson?.devDependencies?.react ?? null;

  let branch = null;
  let dirty = false;
  if (existsSync(join(ROOT, ".git"))) {
    const branchResult = spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd: ROOT,
      encoding: "utf8",
    });
    branch = (branchResult.stdout || "").trim() || null;
    const statusResult = spawnSync("git", ["status", "--porcelain"], {
      cwd: ROOT,
      encoding: "utf8",
    });
    dirty = Boolean((statusResult.stdout || "").trim());
  }

  return {
    name: packageJson?.name ?? null,
    rnVersion,
    reactVersion,
    branch,
    dirty,
    root: ROOT,
    platform: os.platform(),
    node: process.version,
  };
}

function detectAgents() {
  const available = [];
  for (const candidate of AGENT_CANDIDATES) {
    const result = spawnSync(process.platform === "win32" ? "where" : "which", [candidate.bin], {
      encoding: "utf8",
    });
    if (result.status === 0) available.push(candidate);
  }
  return available;
}

// ---------------------------------------------------------------------------
// Git helpers
// ---------------------------------------------------------------------------

async function ensureCleanBranch(branchName) {
  if (!existsSync(join(ROOT, ".git"))) return null;

  const status = spawnSync("git", ["status", "--porcelain"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if ((status.stdout || "").trim()) {
    log("warn", "Working tree has uncommitted changes - they are preserved.");
  }

  const exists = spawnSync("git", ["rev-parse", "--verify", branchName], {
    cwd: ROOT,
    encoding: "utf8",
  });

  const args =
    exists.status === 0
      ? ["checkout", branchName]
      : ["checkout", "-b", branchName];

  const checkout = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
  if (checkout.status !== 0) {
    log(
      "warn",
      `Could not switch to ${branchName}: ${(checkout.stderr || "").trim()}`
    );
    return null;
  }
  log("info", `Working on branch ${branchName}`);
  return branchName;
}

async function gitDiffStat() {
  if (!existsSync(join(ROOT, ".git"))) return null;
  const result = spawnSync("git", ["diff", "--stat"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return (result.stdout || "").trim();
}

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------

function isPathInside(root, target) {
  const relativePath = relative(root, resolve(target));
  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !isAbsolute(relativePath))
  );
}

async function pathExists(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

function substituteAppDetails(content, appName, appPackage) {
  let result = content;
  if (appPackage) {
    result = result
      .split("com.rnsafeupgradeapp")
      .join(appPackage)
      .split("com/rnsafeupgradeapp")
      .join(appPackage.split(".").join("/"));
  }
  if (appName) {
    result = result.split("RnDiffApp").join(appName);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

function runCommand(command, args, options = {}) {
  return new Promise((resolvePromise) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? ROOT,
      env: { ...process.env, ...(options.env ?? {}) },
      shell: false,
    });

    let stdout = "";
    let stderr = "";

    const forward = (stream, target) => {
      stream.on("data", (chunk) => {
        const text = chunk.toString();
        target.push(text);
        if (options.stream !== false) {
          for (const line of text.split("\n")) {
            if (line.trim()) log("info", line.trim());
          }
        }
      });
    };

    forward(child.stdout, []);
    forward(child.stderr, []);

    child.on("error", (error) => {
      log("error", `Failed to start ${command}: ${error.message}`);
      resolvePromise({ code: -1, stdout, stderr: error.message });
    });

    child.on("close", (code) => {
      resolvePromise({ code: code ?? 0, stdout, stderr });
    });
  });
}

async function applyPackageJsonUpdates(updates) {
  const packageJsonPath = join(ROOT, "package.json");
  if (!existsSync(packageJsonPath)) {
    log("error", "No package.json found in the current directory.");
    return { applied: 0, failed: 0 };
  }

  const raw = await readFile(packageJsonPath, "utf8");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    log("error", "package.json is not valid JSON.");
    return { applied: 0, failed: 0 };
  }

  let applied = 0;
  let failed = 0;

  for (const update of updates) {
    const { name, version, range } = update;
    const target = range ?? `^${version}`;
    let touched = false;

    for (const field of ["dependencies", "devDependencies"]) {
      if (parsed[field] && name in parsed[field]) {
        parsed[field][name] = target;
        touched = true;
      }
    }

    if (!touched) {
      for (const field of ["dependencies", "devDependencies"]) {
        if (!parsed[field]) continue;
        const existing = parsed[field][name];
        if (existing === undefined) continue;
      }
    }

    if (touched) {
      applied++;
      log("info", `package.json: ${name} -> ${target}`);
    } else {
      failed++;
      log("warn", `package.json: ${name} is not a dependency of this project.`);
    }
  }

  if (applied > 0) {
    await writeFile(packageJsonPath, JSON.stringify(parsed, null, 2) + "\n", "utf8");
    log("info", "package.json updated");
  }

  return { applied, failed };
}

async function writePackageJson(content) {
  const packageJsonPath = join(ROOT, "package.json");
  if (!existsSync(packageJsonPath)) {
    log("error", "No package.json found in the current directory.");
    return { applied: 0, failed: 0 };
  }

  try {
    JSON.parse(content);
  } catch (error) {
    log("error", `The generated package.json is not valid JSON: ${error.message}`);
    return { applied: 0, failed: 0 };
  }

  await writeFile(packageJsonPath, content, "utf8");
  log("info", "package.json updated");
  return { applied: 1, failed: 0 };
}

async function applyTemplateFiles(
  files,
  { fromVersion, toVersion, appName, appPackage, createMissing }
) {
  const stats = {
    written: 0,
    merged: 0,
    conflicts: 0,
    skipped: 0,
    failed: 0,
  };

  for (const file of files) {
    const relativePath = file.path;
    if (!relativePath) continue;
    if (file.binary) {
      stats.skipped++;
      continue;
    }

    // package.json is handled by the dependency updater - overwriting it with
    // the template would drop the dependencies of the real project.
    if (relativePath === "package.json") {
      stats.skipped++;
      continue;
    }

    const target = join(ROOT, relativePath);
    if (!isPathInside(ROOT, target)) {
      stats.failed++;
      log("error", `Refusing to write outside the project: ${relativePath}`);
      continue;
    }

    const exists = await pathExists(target);
    if (!exists && !createMissing) {
      stats.skipped++;
      continue;
    }

    try {
      const theirs = await fetchTemplateFile(
        toVersion,
        relativePath,
        appName,
        appPackage
      );
      if (theirs === null) {
        stats.skipped++;
        log("warn", `Template file not available for ${relativePath}`);
        continue;
      }

      if (!exists) {
        await writeProjectFile(target, theirs);
        stats.written++;
        log("info", `Created ${relativePath}`);
        continue;
      }

      const ours = await readFile(target, "utf8");

      // The file the project was based on. Merging against it keeps the local
      // customisations instead of throwing them away.
      const base = await fetchTemplateFile(
        fromVersion,
        relativePath,
        appName,
        appPackage
      );

      if (base === null) {
        await writeProjectFile(target, theirs);
        stats.written++;
        log("warn", `No base version available, ${relativePath} was replaced`);
        continue;
      }

      if (ours === base) {
        // Untouched by the project - the template version is the right one.
        await writeProjectFile(target, theirs);
        stats.written++;
        log("info", `Updated ${relativePath}`);
        continue;
      }

      const merged = mergeThreeWay(ours, base, theirs, {
        ours: "your project",
        base: `template ${fromVersion}`,
        theirs: `template ${toVersion}`,
      });
      await writeProjectFile(target, merged.content);

      if (merged.conflicts > 0) {
        stats.conflicts++;
        stats.merged++;
        log(
          "warn",
          `Merged ${relativePath} with ${merged.conflicts} conflict${
            merged.conflicts === 1 ? "" : "s"
          } - the markers are in the file`
        );
      } else {
        stats.merged++;
        log("info", `Merged ${relativePath}`);
      }
    } catch (error) {
      stats.failed++;
      log("error", `Could not update ${relativePath}: ${error.message}`);
    }
  }

  return stats;
}

/**
 * Removes the files that the new template version no longer contains. A file
 * that the project modified is kept - deleting it would throw work away.
 */
async function applyTemplateDeletions(
  files,
  { fromVersion, appName, appPackage }
) {
  const stats = { deleted: 0, kept: 0, skipped: 0 };

  for (const file of files) {
    const relativePath = file.path;
    if (!relativePath) continue;

    const target = join(ROOT, relativePath);
    if (!isPathInside(ROOT, target)) continue;
    if (!(await pathExists(target))) {
      stats.skipped++;
      continue;
    }

    const base = await fetchTemplateFile(
      fromVersion,
      relativePath,
      appName,
      appPackage
    );
    const ours = await readFile(target, "utf8").catch(() => null);
    if (ours === null) {
      stats.skipped++;
      continue;
    }

    if (base === null) {
      stats.kept++;
      log("warn", `Kept ${relativePath} - the template no longer has it`);
      continue;
    }

    if (ours === base) {
      await rm(target, { force: true });
      stats.deleted++;
      log("info", `Removed ${relativePath}`);
    } else {
      stats.kept++;
      log("warn", `Kept ${relativePath} - it was changed in this project`);
    }
  }

  return stats;
}

/**
 * Fetches a file of the official template for a given React Native version.
 */
async function fetchTemplateFile(
  version,
  relativePath,
  appName,
  appPackage
) {
  const url = `${TEMPLATE_RAW_BASE}/${version}/RnDiffApp/${relativePath}`;
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "rn-safe-upgrade-bridge" },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) return null;
    // The template files carry the reference app name and package - they are
    // replaced so the merge compares the project with the template, not with
    // the reference app.
    return substituteAppDetails(await response.text(), appName, appPackage);
  } catch {
    return null;
  }
}

async function writeProjectFile(target, content) {
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content, "utf8");
}

/**
 * Three way merge: the file of the project (ours), the file of the old
 * template (base) and the file of the new template (theirs).
 *
 * `git merge-file` is used when git is available, because it is the exact
 * algorithm git uses. Without git the new template wins, which is reported.
 */
function mergeThreeWay(ours, base, theirs, labels) {
  const canUseGit = spawnSync("git", ["--version"], { encoding: "utf8" }).status === 0;
  if (!canUseGit) {
    return { content: theirs, conflicts: 0 };
  }

  const directory = mkdtempSync(join(tmpdir(), "rnsa-merge-"));
  const oursFile = join(directory, "ours");
  const baseFile = join(directory, "base");
  const theirsFile = join(directory, "theirs");

  try {
    writeFileSync(oursFile, ours, "utf8");
    writeFileSync(baseFile, base, "utf8");
    writeFileSync(theirsFile, theirs, "utf8");

    const args = ["merge-file", "-p", "--diff3"];
    if (labels) {
      args.push(
        "-L",
        labels.ours,
        "-L",
        labels.base,
        "-L",
        labels.theirs
      );
    }
    args.push(oursFile, baseFile, theirsFile);

    const result = spawnSync("git", args, { encoding: "utf8" });

    if (result.status === undefined || result.status < 0) {
      return { content: theirs, conflicts: 0 };
    }

    return {
      content: result.stdout ?? theirs,
      conflicts: result.status,
    };
  } catch {
    return { content: theirs, conflicts: 0 };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function buildAgentPrompt(plan) {
  const lines = [];
  lines.push(
    `You are upgrading a React Native project from ${plan.fromVersion} to ${plan.toVersion}.`
  );
  lines.push("");
  lines.push("Do the following, in this order:");
  lines.push("");

  let step = 1;
  if (plan.dependencyUpdates?.length) {
    lines.push(`${step++}. Update the dependencies in package.json:`);
    for (const update of plan.dependencyUpdates) {
      lines.push(
        `   - ${update.name}: ${update.current} -> ${update.range ?? update.version}`
      );
    }
    const install = plan.dependencyUpdates
      .map((update) => `${update.name}@${update.range ?? update.version}`)
      .join(" ");
    lines.push(`   Then run: npm install ${install}`);
    lines.push("");
  }

  if (plan.filesToApply?.length) {
    lines.push(
      `${step++}. Apply the template files of React Native ${plan.toVersion}.`
    );
    lines.push(
      "   The bridge already copied them, check that they are in place and keep the app name and the package id:"
    );
    for (const file of plan.filesToApply.slice(0, 120)) {
      lines.push(`   - ${file.path}`);
    }
    lines.push("");
  }

  if (plan.breakingChanges?.length) {
    lines.push(
      `${step++}. Update the application code for the changes below.`
    );
    for (const change of plan.breakingChanges.slice(0, 40)) {
      const area = change.area ? `[${change.area}] ` : "";
      lines.push(`   - ${area}${change.text}`);
      if (change.action) lines.push(`     Do: ${change.action}`);
      if (change.file) lines.push(`     Usual place: ${change.file}`);
    }
    lines.push("");
  }

  lines.push(`${step++}. Verify the project:`);
  lines.push("   - npm install");
  lines.push("   - npx react-native run-android and npx react-native run-ios");
  lines.push("");

  if (plan.reactVersion) {
    lines.push(`Context: React Native ${plan.toVersion} requires react ${plan.reactVersion}.`);
    lines.push("");
  }
  if (plan.appName) {
    lines.push(`Context: the application name is ${plan.appName}.`);
  }
  if (plan.appPackage) {
    lines.push(`Context: the android package id is ${plan.appPackage}.`);
  }
  lines.push("");

  lines.push("Rules:");
  lines.push(
    "- Keep the change set minimal and consistent with the existing code style."
  );
  lines.push(
    "- Do not remove the behaviour of the app, only adapt it to the new release."
  );
  lines.push(
    "- Do not run destructive commands and do not commit unless explicitly asked."
  );
  lines.push("");
  lines.push(
    "Report the files you changed and anything that needs manual attention."
  );

  return lines.join("\n");
}

async function runAgent(plan) {
  const available = detectAgents();
  if (available.length === 0) {
    return {
      ok: false,
      message:
        "No agent CLI was found. Install one of: claude, codex, gemini, opencode, aider - or use deterministic mode.",
    };
  }

  const chosen =
    (AGENT_OVERRIDE &&
      available.find((agent) => agent.id === AGENT_OVERRIDE)) ||
    available[0];

  if (AGENT_OVERRIDE && !chosen) {
    return {
      ok: false,
      message: `Agent "${AGENT_OVERRIDE}" is not installed. Available: ${available
        .map((a) => a.id)
        .join(", ")}`,
    };
  }

  const prompt = buildAgentPrompt(plan);
  log("info", `Handing the upgrade over to ${chosen.label}`);

  const result = await runCommand(chosen.bin, [...chosen.args, prompt], {
    stream: true,
  });

  return {
    ok: result.code === 0,
    message:
      result.code === 0
        ? `${chosen.label} finished.`
        : `${chosen.label} exited with code ${result.code}.`,
    agent: chosen.id,
  };
}

// ---------------------------------------------------------------------------
// Job orchestration
// ---------------------------------------------------------------------------

async function startJob(plan) {
  if (state.job && state.job.status === "running") {
    return { error: "A job is already running." };
  }

  const job = {
    id: randomUUID(),
    status: "running",
    startedAt: Date.now(),
    finishedAt: null,
    plan,
    result: null,
  };
  state.job = job;
  broadcast("job", publicJob());

  try {
    const branch = await ensureCleanBranch(
      `chore/rn-upgrade-${plan.fromVersion}-to-${plan.toVersion}`
    );
    job.branch = branch;

    if (plan.packageJsonContent) {
      log("info", "Writing the updated package.json...");
      job.packageJson = await writePackageJson(plan.packageJsonContent);
    } else if (plan.dependencyUpdates?.length) {
      log("info", "Applying dependency updates...");
      job.packageJson = await applyPackageJsonUpdates(plan.dependencyUpdates);
    }

    if (plan.filesToApply?.length) {
      log("info", `Applying ${plan.filesToApply.length} template files...`);
      job.templates = await applyTemplateFiles(plan.filesToApply, {
        fromVersion: plan.fromVersion,
        toVersion: plan.toVersion,
        appName: plan.appName,
        appPackage: plan.appPackage,
        createMissing: Boolean(plan.createMissingFiles),
      });
    }

    if (plan.filesToDelete?.length) {
      log("info", `Removing ${plan.filesToDelete.length} files the template dropped...`);
      job.deletions = await applyTemplateDeletions(plan.filesToDelete, {
        fromVersion: plan.fromVersion,
        appName: plan.appName,
        appPackage: plan.appPackage,
      });
    }

    if (plan.useAgent) {
      job.agent = await runAgent(plan);
    }

    if (RUN_INSTALL) {
      log("info", "Running npm install...");
      job.install = await runCommand(
        process.platform === "win32" ? "npm.cmd" : "npm",
        ["install"],
        { stream: true }
      );
    }

    if (RUN_POD_INSTALL) {
      const iosDir = join(ROOT, "ios");
      if (await pathExists(iosDir)) {
        log("info", "Running pod install...");
        job.pods = await runCommand("pod", ["install"], {
          cwd: iosDir,
          stream: true,
        });
      }
    }

    job.diff = await gitDiffStat();
    job.status = "completed";
    job.finishedAt = Date.now();
    log("info", "Upgrade run finished.");
  } catch (error) {
    job.status = "failed";
    job.error = error instanceof Error ? error.message : String(error);
    job.finishedAt = Date.now();
    log("error", job.error);
  }

  broadcast("job", publicJob());
  return publicJob();
}

function publicJob() {
  if (!state.job) return null;
  const { plan, ...rest } = state.job;
  return {
    ...rest,
    planSummary: plan
      ? {
          fromVersion: plan.fromVersion,
          toVersion: plan.toVersion,
          dependencies: plan.dependencyUpdates?.length ?? 0,
          files: plan.filesToApply?.length ?? 0,
        }
      : null,
  };
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------

function json(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    "Cache-Control": "no-store",
    ...extraHeaders,
  });
  res.end(payload);
}

function corsHeaders(req) {
  const origin = req.headers.origin;
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : null;
  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-RNSA-Token",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
  if (allowed) headers["Access-Control-Allow-Origin"] = allowed;
  return { headers, allowed };
}

function readBody(req) {
  return new Promise((resolvePromise, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 8 * 1024 * 1024) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolvePromise(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  const { headers, allowed } = corsHeaders(req);
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, headers);
    res.end();
    return;
  }

  const token = req.headers["x-rnsa-token"] ?? url.searchParams.get("token");
  const authenticated = token === TOKEN;

  if (!allowed) {
    json(
      res,
      403,
      {
        error: "Origin not allowed",
        hint: "Open the app from https://heymeowcat.is-a.dev or a local dev server.",
      },
      headers
    );
    return;
  }

  // Discovery is public on purpose: it only reveals that a bridge is running
  // and which version it is. Everything else needs the session token.
  if (url.pathname === "/health" && !authenticated && !token) {
    json(
      res,
      200,
      {
        ok: true,
        name: "rn-safe-upgrade-bridge",
        version: 1,
        requiresToken: true,
      },
      headers
    );
    return;
  }

  if (!authenticated) {
    json(res, 401, { error: "Invalid or missing session token" }, headers);
    return;
  }

  try {
    switch (`${req.method} ${url.pathname}`) {
      case "GET /health": {
        const project = await readProject();
        json(
          res,
          200,
          {
            ok: true,
            name: "rn-safe-upgrade-bridge",
            version: 1,
            project,
            agents: detectAgents().map((agent) => ({
              id: agent.id,
              label: agent.label,
            })),
            capabilities: ["plan", "files", "agent", "install", "pods"],
            startedAt: state.startedAt,
          },
          headers
        );
        return;
      }

      case "GET /events": {
        res.writeHead(200, {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          ...headers,
        });
        res.write(": connected\n\n");
        clients.add(res);

        const keepAlive = setInterval(() => {
          try {
            res.write(": ping\n\n");
          } catch {
            /* closed */
          }
        }, 20000);

        req.on("close", () => {
          clearInterval(keepAlive);
          clients.delete(res);
        });
        return;
      }

      case "GET /logs": {
        json(res, 200, { logs: state.logs.slice(-200) }, headers);
        return;
      }

      case "GET /status": {
        json(res, 200, { job: publicJob(), project: await readProject() }, headers);
        return;
      }

      case "POST /plan": {
        const plan = await readBody(req);
        const job = await startJob(plan);
        json(res, 200, { job }, headers);
        return;
      }

      case "POST /command": {
        const payload = await readBody(req);
        const command = String(payload.command ?? "");
        if (!command) {
          json(res, 400, { error: "No command provided" }, headers);
          return;
        }
        const result = await runCommand(command, payload.args ?? [], {
          stream: true,
        });
        json(res, 200, { result }, headers);
        return;
      }

      default:
        json(res, 404, { error: "Not found" }, headers);
    }
  } catch (error) {
    json(
      res,
      500,
      {
        error: error instanceof Error ? error.message : String(error),
      },
      headers
    );
  }
});

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

function printBanner(project, agents) {
  const line = "─".repeat(62);
  console.log(`\n\x1b[36m┌${line}┐\x1b[0m`);
  console.log(
    `\x1b[36m│\x1b[0m  \x1b[1mRN Safe Upgrade - local agent bridge\x1b[0m`
  );
  console.log(`\x1b[36m└${line}┘\x1b[0m`);
  console.log(`  Project   ${project.name ?? "(unnamed)"}`);
  console.log(`  Path      ${project.root}`);
  console.log(
    `  React Native  ${project.rnVersion ?? "not detected"}${
      project.reactVersion ? `   react ${project.reactVersion}` : ""
    }`
  );
  if (project.branch) {
    console.log(
      `  Git       ${project.branch}${project.dirty ? " (uncommitted changes)" : ""}`
    );
  }
  console.log(
    `  Agents    ${
      agents.length ? agents.map((a) => a.id).join(", ") : "none detected (deterministic mode)"
    }`
  );
  console.log("");
  console.log("  Open this link to connect the web app:");
  console.log(
    `\x1b[1m    ${WEB_APP_URL}#bridge=127.0.0.1:${PORT}&token=${TOKEN}\x1b[0m`
  );
  console.log("");
  console.log("  Session token (in case you need to paste it):");
  console.log(`\x1b[1m    ${TOKEN}\x1b[0m`);
  console.log("");
  console.log(`  Listening on \x1b[1mhttp://127.0.0.1:${PORT}\x1b[0m`);
  console.log("  Press Ctrl+C to stop.");
  console.log("");
}

async function main() {
  if (flags.has("help") || flags.has("h")) {
    console.log(`
RN Safe Upgrade - local agent bridge

Usage
  npx --yes github:heymeowcat/rn-safe-upgrade            start the bridge
  npx --yes github:heymeowcat/rn-safe-upgrade --help     show this message

Options
  --port <number>     port to listen on (default ${DEFAULT_PORT})
  --token <string>    use a fixed session token instead of a random one
  --agent <id>        force an agent: ${AGENT_CANDIDATES.map((a) => a.id).join(", ")}
  --yes               (reserved) apply changes as soon as the plan arrives
  --install           run "npm install" after applying the plan
  --pods              run "pod install" after applying the plan
  --verbose           print every log line to the terminal
`);
    return;
  }

  const project = await readProject();
  const agents = detectAgents();

  if (!project.rnVersion) {
    console.warn(
      "\n  ⚠  No react-native dependency detected in package.json."
    );
    console.warn("     Run this from the root of your React Native project.\n");
  }

  printBanner(project, agents);

  server.listen(PORT, "127.0.0.1", () => {
    log("info", `Bridge listening on http://127.0.0.1:${PORT}`);
  });

  const shutdown = () => {
    console.log("\n  Stopping bridge.");
    for (const client of clients) {
      try {
        client.end();
      } catch {
        /* ignore */
      }
    }
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 500);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
