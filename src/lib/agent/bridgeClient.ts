/**
 * Browser side of the local agent bridge.
 *
 * The bridge is a tiny HTTP server that the user runs inside their own
 * project. Nothing about the project ever leaves the machine unless the user
 * explicitly asks an agent to act on it.
 */

export interface BridgeProject {
  name: string | null;
  rnVersion: string | null;
  reactVersion: string | null;
  branch: string | null;
  dirty: boolean;
  root: string;
  platform: string;
  node: string;
}

export interface BridgeInfo {
  ok: boolean;
  name: string;
  version: number;
  requiresToken?: boolean;
  project?: BridgeProject;
  agents?: Array<{ id: string; label: string }>;
  capabilities?: string[];
}

export interface BridgeLogEntry {
  id: string;
  at: number;
  level: "info" | "warn" | "error";
  message: string;
}

export interface BridgeJob {
  id: string;
  status: "running" | "completed" | "failed";
  startedAt: number;
  finishedAt: number | null;
  branch?: string | null;
  diff?: string | null;
  error?: string;
  templates?: {
    written: number;
    merged: number;
    conflicts: number;
    skipped: number;
    failed: number;
  };
  deletions?: { deleted: number; kept: number; skipped: number };
  packageJson?: { applied: number; failed: number };
  result?: unknown;
  planSummary?: {
    fromVersion: string;
    toVersion: string;
    dependencies: number;
    files: number;
  } | null;
}

export interface UpgradePlanPayload {
  fromVersion: string;
  toVersion: string;
  appName?: string;
  appPackage?: string;
  reactVersion?: string;
  dependencyUpdates?: Array<{
    name: string;
    current: string;
    version: string;
    range?: string;
  }>;
  breakingChanges?: Array<{ area?: string; text: string; url?: string }>;
  requiredFiles?: string[];
  filesToApply?: Array<{ path: string; binary?: boolean }>;
  filesToDelete?: Array<{ path: string }>;
  packageJsonContent?: string;
  useAgent?: boolean;
  createMissingFiles?: boolean;
}

export const BRIDGE_PORTS = [4317, 4318, 4319, 4320];

export class BridgeError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "BridgeError";
  }
}

function endpoint(port: number, path: string, token?: string): string {
  const url = new URL(`http://127.0.0.1:${port}${path}`);
  if (token) url.searchParams.set("token", token);
  return url.toString();
}

async function request<T>(
  port: number,
  path: string,
  options: RequestInit & { token?: string; timeout?: number } = {}
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    options.timeout ?? 4000
  );

  try {
    const response = await fetch(endpoint(port, path, options.token), {
      method: options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(options.token ? { "X-RNSA-Token": options.token } : {}),
        ...(options.headers ?? {}),
      },
      body: options.body,
      signal: controller.signal,
      mode: "cors",
      cache: "no-store",
    });

    const text = await response.text();
    let payload: unknown = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = { error: text.slice(0, 200) };
    }

    if (!response.ok) {
      const message =
        (payload as { error?: string })?.error ??
        `Bridge request failed (${response.status})`;
      throw new BridgeError(message, response.status);
    }

    return payload as T;
  } catch (error) {
    if (error instanceof BridgeError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new BridgeError("The bridge did not respond in time.");
    }
    throw new BridgeError(
      error instanceof Error ? error.message : "Could not reach the bridge."
    );
  } finally {
    clearTimeout(timer);
  }
}

/** Checks whether a bridge is running on the given port. */
export async function probePort(port: number, timeout = 1200): Promise<boolean> {
  try {
    const info = await request<BridgeInfo>(port, "/health", { timeout });
    return Boolean(info?.ok);
  } catch {
    return false;
  }
}

/** Scans the well known ports for a running bridge. */
export async function discoverBridge(
  ports: number[] = BRIDGE_PORTS
): Promise<{ port: number; info: BridgeInfo } | null> {
  for (const port of ports) {
    try {
      const info = await request<BridgeInfo>(port, "/health", { timeout: 1200 });
      if (info?.ok) return { port, info };
    } catch {
      /* keep scanning */
    }
  }
  return null;
}

export async function connectBridge(
  port: number,
  token: string
): Promise<BridgeInfo> {
  return await request<BridgeInfo>(port, "/health", { token, timeout: 6000 });
}

export async function fetchStatus(
  port: number,
  token: string
): Promise<{ job: BridgeJob | null; project: BridgeProject }> {
  return await request(port, "/status", { token, timeout: 6000 });
}

export async function sendPlan(
  port: number,
  token: string,
  plan: UpgradePlanPayload
): Promise<{ job: BridgeJob }> {
  return await request(port, "/plan", {
    method: "POST",
    token,
    timeout: 120000,
    body: JSON.stringify(plan),
  });
}

export async function runBridgeCommand(
  port: number,
  token: string,
  command: string,
  args: string[] = []
): Promise<{ result: { code: number } }> {
  return await request(port, "/command", {
    method: "POST",
    token,
    timeout: 300000,
    body: JSON.stringify({ command, args }),
  });
}

/**
 * Subscribes to the bridge log stream. Returns a disposer.
 */
export function subscribeToBridge(
  port: number,
  token: string,
  handlers: {
    onLog?: (entry: BridgeLogEntry) => void;
    onJob?: (job: BridgeJob) => void;
    onError?: (error: Error) => void;
    onOpen?: () => void;
  }
): () => void {
  if (typeof EventSource === "undefined") {
    handlers.onError?.(new Error("This browser does not support EventSource."));
    return () => {};
  }

  const source = new EventSource(endpoint(port, "/events", token));

  const logListener = (event: MessageEvent) => {
    try {
      handlers.onLog?.(JSON.parse(event.data) as BridgeLogEntry);
    } catch {
      /* ignore malformed frames */
    }
  };

  const jobListener = (event: MessageEvent) => {
    try {
      handlers.onJob?.(JSON.parse(event.data) as BridgeJob);
    } catch {
      /* ignore malformed frames */
    }
  };

  source.addEventListener("log", logListener as EventListener);
  source.addEventListener("job", jobListener as EventListener);
  source.onopen = () => handlers.onOpen?.();
  source.onerror = () =>
    handlers.onError?.(new Error("Lost the connection to the bridge."));

  return () => {
    source.removeEventListener("log", logListener as EventListener);
    source.removeEventListener("job", jobListener as EventListener);
    source.close();
  };
}

/**
 * Reads a bridge deep link, e.g.
 *   https://heymeowcat.is-a.dev/rn-safe-upgrade/#bridge=127.0.0.1:4317&token=abc
 */
export function parseBridgeLink(hash: string): {
  port: number;
  token: string;
} | null {
  if (!hash) return null;
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const bridge = params.get("bridge");
  const token = params.get("token");
  if (!bridge || !token) return null;

  const port = Number(bridge.split(":").pop());
  if (!Number.isFinite(port) || port <= 0) return null;

  return { port, token };
}
