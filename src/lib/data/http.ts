/**
 * Network primitives with a local, TTL-based cache.
 *
 * Everything the UI shows about React Native is fetched at runtime from public
 * sources (npm registry, GitHub releases, reactnative.dev). Nothing is hardcoded,
 * so the app stays current without a manual content pass.
 */

export type CacheSource = "network" | "cache" | "stale" | "snapshot" | "none";

export interface CachedResult<T> {
  data: T;
  source: CacheSource;
  fetchedAt: number;
  /** Set when the network call failed but a previously cached copy was used. */
  error?: string;
}

interface CacheEnvelope<T> {
  data: T;
  storedAt: number;
}

const memoryCache = new Map<string, CacheEnvelope<unknown>>();
const LS_PREFIX = "rnsa:v2:";

/** Payloads larger than this are kept in memory only. */
const MAX_LOCAL_STORAGE_BYTES = 1_500_000;

function canUseLocalStorage(): boolean {
  if (typeof window === "undefined" || !window.localStorage) return false;
  try {
    const probe = "__rnsa_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

function readLocal<T>(key: string): CacheEnvelope<T> | null {
  if (!canUseLocalStorage()) return null;
  try {
    const raw = window.localStorage.getItem(LS_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (typeof parsed?.storedAt !== "number" || parsed.data === undefined) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeLocal<T>(key: string, envelope: CacheEnvelope<T>): void {
  if (!canUseLocalStorage()) return;
  try {
    const raw = JSON.stringify(envelope);
    if (raw.length > MAX_LOCAL_STORAGE_BYTES) return;
    window.localStorage.setItem(LS_PREFIX + key, raw);
  } catch {
    /* quota exceeded - memory cache still works */
  }
}

export function readCache<T>(key: string): CacheEnvelope<T> | null {
  const fromMemory = memoryCache.get(key);
  if (fromMemory) return fromMemory as CacheEnvelope<T>;
  const fromLocal = readLocal<T>(key);
  if (fromLocal) memoryCache.set(key, fromLocal as CacheEnvelope<unknown>);
  return fromLocal;
}

export function writeCache<T>(key: string, data: T): void {
  const envelope: CacheEnvelope<T> = { data, storedAt: Date.now() };
  memoryCache.set(key, envelope as CacheEnvelope<unknown>);
  writeLocal(key, envelope);
}

export function clearCache(prefix?: string): void {
  if (prefix) {
    for (const key of Array.from(memoryCache.keys())) {
      if (key.startsWith(prefix)) memoryCache.delete(key);
    }
    if (canUseLocalStorage()) {
      const doomed: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith(LS_PREFIX + prefix)) doomed.push(key);
      }
      doomed.forEach((key) => window.localStorage.removeItem(key));
    }
    return;
  }

  memoryCache.clear();
  if (canUseLocalStorage()) {
    const doomed: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(LS_PREFIX)) doomed.push(key);
    }
    doomed.forEach((key) => window.localStorage.removeItem(key));
  }
}

export interface FetchOptions {
  /** How long a cached copy stays fresh, in milliseconds. */
  ttl?: number;
  timeout?: number;
  headers?: Record<string, string>;
  /** Return the cached copy even if it is older than the TTL. */
  allowStale?: boolean;
  signal?: AbortSignal;
}

/**
 * Fetches JSON with a cache, a timeout and a stale-while-revalidate fallback.
 * Never throws for network problems when a cached copy exists.
 */
export async function cachedFetchJson<T>(
  cacheKey: string,
  url: string,
  options: FetchOptions = {}
): Promise<CachedResult<T> | null> {
  const { ttl = 6 * 60 * 60 * 1000, timeout = 15000, headers, allowStale = true } =
    options;
  void allowStale;

  const cached = readCache<CachedResult<T> | T>(cacheKey);
  const cachedData = cached?.data as CachedResult<T> | T | undefined;
  const isEnvelope =
    cachedData &&
    typeof cachedData === "object" &&
    "data" in (cachedData as object) &&
    "source" in (cachedData as object);

  if (cached && !isEnvelope) {
    const age = Date.now() - cached.storedAt;
    if (age < ttl) {
      return {
        data: cached.data as T,
        source: "cache",
        fetchedAt: cached.storedAt,
      };
    }
  } else if (cached && isEnvelope) {
    const envelope = cachedData as CachedResult<T>;
    const age = Date.now() - envelope.fetchedAt;
    if (envelope.source === "network" && age < ttl) {
      return envelope;
    }
  }

  try {
    const data = await fetchJson<T>(url, { timeout, headers, signal: options.signal });
    const result: CachedResult<T> = {
      data,
      source: "network",
      fetchedAt: Date.now(),
    };
    writeCache(cacheKey, result);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (cached) {
      const fallback = isEnvelope
        ? (cachedData as CachedResult<T>)
        : {
            data: cached.data as T,
            source: "cache" as const,
            fetchedAt: cached.storedAt,
          };
      return { ...fallback, error: message };
    }
    return null;
  }
}

export async function fetchJson<T>(
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  const response = await fetchWithTimeout(url, options);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

export async function fetchText(
  url: string,
  options: FetchOptions = {}
): Promise<string> {
  const response = await fetchWithTimeout(url, options);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }
  return await response.text();
}

async function fetchWithTimeout(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const { timeout = 15000, headers, signal } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  try {
    return await fetch(url, {
      headers: { Accept: "application/json, text/plain, */*", ...headers },
      signal: controller.signal,
      // The GitHub API rejects unidentified clients.
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request timed out");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
