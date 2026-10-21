"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { DependencyAnalysis, DiffFile, PackageJson } from "../types";
import {
  loadCatalog,
  findVersion,
  fetchHeadline,
  initialSession,
  semverCompare as compareVersions,
  type RnCatalog,
  type RnVersionInfo,
} from "../data/rnCatalog";
import { fetchReleaseNotes, type ReleaseNotes } from "../data/releaseNotes";
import { buildUpgradeBrief, type UpgradeBrief } from "../data/upgradeBrief";
import { analyzeAllDependencies } from "../compatibilityChecker";
import {
  createSmartMergedPackageJson,
  fetchRnDiffPurgePackageJson,
} from "../smartPackageJsonMerger";
import { fetchRNDiff } from "../diffFetcher";
import { buildUpgradePlan, type UpgradePlan } from "../upgrade/plan";

export type TabId = "brief" | "dependencies" | "changes" | "agent";

export interface SessionState {
  catalog: RnCatalog | null;
  catalogLoading: boolean;
  catalogError: string | null;
  refreshCatalog: () => Promise<void>;

  fromVersion: string;
  toVersion: string;
  setFromVersion: (version: string) => void;
  setToVersion: (version: string) => void;
  swapVersions: () => void;

  includePrerelease: boolean;
  setIncludePrerelease: (value: boolean) => void;

  appName?: string;
  appPackage?: string;

  packageJson: PackageJson | null;
  setPackageJson: (value: PackageJson | null) => void;

  analysis: DependencyAnalysis[];
  analyzing: boolean;
  analysisProgress: { current: number; total: number };

  diffFiles: DiffFile[];
  diffLoading: boolean;
  diffError: string | null;

  releaseNotes: ReleaseNotes | null;
  releaseNotesLoading: boolean;

  brief: UpgradeBrief | null;
  plan: UpgradePlan | null;
  mergedPackageJson: PackageJson | null;

  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;

  completedFiles: Set<string>;
  toggleFile: (key: string) => void;
  resetCompletedFiles: () => void;

  toVersionInfo?: RnVersionInfo;
  reactPeer?: string;
  latestStable?: string;
}

const SessionContext = createContext<SessionState | null>(null);

const DIFF_MIN = 1000;

function readUrlState() {
  if (typeof window === "undefined") {
    return { from: "", to: "", name: undefined, pkg: undefined };
  }
  const params = new URLSearchParams(window.location.search);
  return {
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
    name: params.get("name") ?? undefined,
    pkg: params.get("package") ?? undefined,
  };
}

export function UpgradeSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // The snapshot is the state the server renders, the browser refreshes it.
  const [initial] = useState(initialSession);
  const [catalog, setCatalog] = useState<RnCatalog | null>(initial.catalog);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // The first render has to match the statically generated HTML, so the URL
  // is read after mount.
  const [versions, setVersions] = useState({
    from: initial.fromVersion,
    to: initial.toVersion,
  });
  const fromVersion = versions.from;
  const toVersion = versions.to;
  const [includePrerelease, setIncludePrerelease] = useState(false);
  const [appName, setAppName] = useState<string | undefined>(undefined);
  const [appPackage, setAppPackage] = useState<string | undefined>(undefined);

  const [packageJson, setPackageJsonState] = useState<PackageJson | null>(null);
  const [analysis, setAnalysis] = useState<DependencyAnalysis[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState({
    current: 0,
    total: 0,
  });

  const [diffFiles, setDiffFiles] = useState<DiffFile[]>([]);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);

  const [releaseNotes, setReleaseNotes] = useState<ReleaseNotes | null>(null);
  const [releaseNotesLoading, setReleaseNotesLoading] = useState(false);
  const [announcement, setAnnouncement] = useState<{
    url?: string;
    headline?: string;
  } | null>(null);
  const [templatePackageJson, setTemplatePackageJson] = useState<PackageJson | null>(
    null
  );

  const [activeTab, setActiveTab] = useState<TabId>("brief");
  const [completedFiles, setCompletedFiles] = useState<Set<string>>(new Set());

  // --- url state ----------------------------------------------------------

  useEffect(() => {
    const state = readUrlState();
    if (state.from) setVersions((current) => ({ ...current, from: state.from }));
    if (state.to) setVersions((current) => ({ ...current, to: state.to }));
    if (state.name) setAppName(state.name);
    if (state.pkg) setAppPackage(state.pkg);
  }, []);

  // --- catalog ------------------------------------------------------------

  const refreshCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const next = await loadCatalog({ force: true });
      setCatalog(next);
    } catch (error) {
      setCatalogError(
        error instanceof Error ? error.message : "Could not load the catalog."
      );
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const next = await loadCatalog();
        if (cancelled) return;
        setCatalog(next);
        setCatalogError(null);
      } catch (error) {
        if (cancelled) return;
        setCatalogError(
          error instanceof Error
            ? error.message
            : "Could not reach the release data."
        );
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const stableVersions = useMemo(
    () =>
      (catalog?.versions ?? []).filter(
        (version) => includePrerelease || !version.prerelease
      ),
    [catalog, includePrerelease]
  );

  const latestStable = useMemo(
    () => stableVersions.find((version) => !version.prerelease)?.version,
    [stableVersions]
  );

  // Pick sensible defaults once the catalog is available.
  useEffect(() => {
    if (!catalog || catalog.versions.length === 0) return;

    const stable = catalog.versions.filter((version) => !version.prerelease);

    setVersions((current) => {
      const next = { ...current };

      if (!next.to || !findVersion(catalog, next.to)) {
        next.to = stable[0]?.version ?? catalog.versions[0]?.version ?? "";
      }
      if (!next.from || !findVersion(catalog, next.from)) {
        // Default to the release right before the newest one.
        const index = stable.findIndex(
          (version) => version.version === next.to
        );
        next.from = stable[index + 1]?.version ?? stable[0]?.version ?? "";
      }
      return next;
    });
  }, [catalog]);

  // --- url sync -----------------------------------------------------------

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const set = (key: string, value: string | undefined) => {
      if (value) params.set(key, value);
      else params.delete(key);
    };
    set("from", fromVersion);
    set("to", toVersion);
    set("name", appName);
    set("package", appPackage);

    const query = params.toString();
    const next = `${window.location.pathname}${query ? `?${query}` : ""}`;
    window.history.replaceState(null, "", next);
  }, [fromVersion, toVersion, appName, appPackage]);

  // --- diff ---------------------------------------------------------------

  useEffect(() => {
    if (!fromVersion || !toVersion || fromVersion === toVersion) {
      setDiffFiles([]);
      setDiffError(null);
      return;
    }

    if (compareVersions(fromVersion, toVersion) > 0) {
      setDiffFiles([]);
      setDiffError(
        "The target version has to be newer than the version you are on. Use the swap button to reverse them."
      );
      return;
    }

    let cancelled = false;
    setDiffLoading(true);
    setDiffError(null);

    (async () => {
      try {
        const files = await fetchRNDiff(fromVersion, toVersion);
        if (cancelled) return;
        setDiffFiles(files);
      } catch (error) {
        if (cancelled) return;
        setDiffFiles([]);
        setDiffError(
          error instanceof Error
            ? error.message
            : "Could not load the diff for this version pair."
        );
      } finally {
        if (!cancelled) setDiffLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fromVersion, toVersion]);

  // --- release notes ------------------------------------------------------

  useEffect(() => {
    if (!toVersion) return;
    let cancelled = false;
    setReleaseNotesLoading(true);

    (async () => {
      const notes = await fetchReleaseNotes(toVersion);
      if (cancelled) return;
      setReleaseNotes(notes);
      setReleaseNotesLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [toVersion]);

  const toVersionInfo = useMemo(
    () => (catalog && toVersion ? findVersion(catalog, toVersion) : undefined),
    [catalog, toVersion]
  );

  // The headline of the announcement is read from the markdown source of the
  // official blog post.
  useEffect(() => {
    const rawUrl = toVersionInfo?.blogRawUrl;
    if (!rawUrl) {
      setAnnouncement(null);
      return;
    }

    let cancelled = false;
    (async () => {
      const headline = await fetchHeadline({
        minor: toVersionInfo?.version ?? "",
        url: toVersionInfo?.blogUrl ?? "",
        rawUrl,
      });
      if (!cancelled && headline) {
        setAnnouncement({ url: toVersionInfo?.blogUrl, headline });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [toVersion, toVersionInfo?.version, toVersionInfo?.blogRawUrl, toVersionInfo?.blogUrl]);

  const effectiveVersionInfo = useMemo<RnVersionInfo | undefined>(() => {
    if (!toVersionInfo) return undefined;
    return {
      ...toVersionInfo,
      blogUrl: toVersionInfo.blogUrl ?? announcement?.url,
      blogHeadline: toVersionInfo.blogHeadline ?? announcement?.headline,
    };
  }, [toVersionInfo, announcement]);

  const reactPeer = effectiveVersionInfo?.reactPeer;
  const typesPeer = effectiveVersionInfo?.typesPeer;

  // --- dependency analysis ------------------------------------------------

  const analysisKey = useMemo(
    () => `${toVersion}|${packageJson ? JSON.stringify(packageJson) : ""}`,
    [toVersion, packageJson]
  );

  useEffect(() => {
    if (!packageJson || !toVersion) {
      setAnalysis([]);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    const timer = setTimeout(async () => {
      setAnalyzing(true);
      setAnalysisProgress({ current: 0, total: 0 });

      const dependencies = {
        ...(packageJson.dependencies ?? {}),
        ...(packageJson.devDependencies ?? {}),
      };

      try {
        const results = await analyzeAllDependencies(
          dependencies,
          toVersion,
          {
            targetReactPeer: reactPeer,
            targetTypesPeer: typesPeer,
            signal: controller.signal,
            onProgress: (current, total) => {
              if (!cancelled) setAnalysisProgress({ current, total });
            },
          }
        );
        if (!cancelled) setAnalysis(results);
      } catch (error) {
        if (!cancelled) {
          console.error("Dependency analysis failed", error);
        }
      } finally {
        if (!cancelled) setAnalyzing(false);
      }
    }, DIFF_MIN);

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisKey, reactPeer, typesPeer]);

  // The template package.json tells us which versions the official app uses.
  useEffect(() => {
    if (!toVersion) return;
    let cancelled = false;
    (async () => {
      const template = await fetchRnDiffPurgePackageJson(toVersion);
      if (!cancelled) setTemplatePackageJson(template);
    })();
    return () => {
      cancelled = true;
    };
  }, [toVersion]);

  const mergedPackageJson = useMemo(() => {
    if (!packageJson || !toVersion) return null;
    return createSmartMergedPackageJson(
      packageJson,
      templatePackageJson,
      analysis,
      toVersion
    );
  }, [packageJson, templatePackageJson, analysis, toVersion]);

  // --- brief + plan -------------------------------------------------------

  const brief = useMemo(() => {
    if (!toVersion) return null;
    return buildUpgradeBrief({
      version: toVersion,
      versionInfo: effectiveVersionInfo,
      releaseNotes,
      diffFiles,
    });
  }, [toVersion, effectiveVersionInfo, releaseNotes, diffFiles]);

  const plan = useMemo(() => {
    if (!fromVersion || !toVersion) return null;
    return buildUpgradePlan({
      fromVersion,
      toVersion,
      appName,
      appPackage,
      reactPeer,
      typesPeer,
      nodeEngine: toVersionInfo?.nodeEngine,
      packageJson,
      mergedPackageJson,
      analysis,
      diffFiles,
      brief,
      releaseNotes,
    });
  }, [
    fromVersion,
    toVersion,
    appName,
    appPackage,
    reactPeer,
    typesPeer,
    toVersionInfo?.nodeEngine,
    packageJson,
    mergedPackageJson,
    analysis,
    diffFiles,
    brief,
    releaseNotes,
  ]);

  // --- actions ------------------------------------------------------------

  const setPackageJson = useCallback((value: PackageJson | null) => {
    setPackageJsonState(value);
    if (!value) return;

    if (value.name) {
      const normalized = value.name
        .split(/[-_]/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join("");
      setAppName(normalized);
      setAppPackage((current) => current ?? `com.${normalized.toLowerCase()}`);
    }

    const rnVersion =
      value.dependencies?.["react-native"] ?? value.devDependencies?.["react-native"];
    if (rnVersion) {
      const cleaned = rnVersion.replace(/^[\^~>=<\s]*/, "");
      // The version in package.json is the real one - it wins over the
      // default that was picked when the catalog loaded.
      setVersions((current) => ({ ...current, from: cleaned }));
    }
  }, []);

  /** The smallest published version that is newer than the given one. */
  const nextAbove = useCallback(
    (version: string): string | undefined => {
      if (!catalog) return undefined;
      const newer = catalog.versions.filter(
        (candidate) => compareVersions(candidate.version, version) > 0
      );
      return newer[newer.length - 1]?.version;
    },
    [catalog]
  );

  /** The largest published version that is older than the given one. */
  const nextBelow = useCallback(
    (version: string): string | undefined => {
      if (!catalog) return undefined;
      const older = catalog.versions.filter(
        (candidate) => compareVersions(candidate.version, version) < 0
      );
      return older[0]?.version;
    },
    [catalog]
  );

  const setFromVersion = useCallback(
    (version: string) => {
      setVersions((current) => {
        const next = { ...current, from: version };
        if (current.to && compareVersions(version, current.to) >= 0) {
          next.to = nextAbove(version) ?? current.to;
        }
        return next;
      });
    },
    [nextAbove]
  );

  const setToVersion = useCallback(
    (version: string) => {
      setVersions((current) => {
        const next = { ...current, to: version };
        if (current.from && compareVersions(version, current.from) <= 0) {
          next.from = nextBelow(version) ?? current.from;
        }
        return next;
      });
    },
    [nextBelow]
  );

  const swapVersions = useCallback(() => {
    setVersions((current) => ({ from: current.to, to: current.from }));
  }, []);

  const toggleFile = useCallback((key: string) => {
    setCompletedFiles((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const resetCompletedFiles = useCallback(() => setCompletedFiles(new Set()), []);

  const value: SessionState = {
    catalog,
    catalogLoading,
    catalogError,
    refreshCatalog,

    fromVersion,
    toVersion,
    setFromVersion,
    setToVersion,
    swapVersions,

    includePrerelease,
    setIncludePrerelease,

    appName,
    appPackage,

    packageJson,
    setPackageJson,

    analysis,
    analyzing,
    analysisProgress,

    diffFiles,
    diffLoading,
    diffError,

    releaseNotes,
    releaseNotesLoading,

    brief,
    plan,
    mergedPackageJson,

    activeTab,
    setActiveTab,

    completedFiles,
    toggleFile,
    resetCompletedFiles,

    toVersionInfo: effectiveVersionInfo,
    reactPeer,
    latestStable,
  };

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useUpgradeSession(): SessionState {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error(
      "useUpgradeSession must be used inside an UpgradeSessionProvider."
    );
  }
  return context;
}
