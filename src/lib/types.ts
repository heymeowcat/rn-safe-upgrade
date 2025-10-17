export interface PackageJson {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  [key: string]: unknown;
}

export interface DependencyAnalysis {
  package: string;
  currentVersion: string;
  recommendedVersion: string;
  latestVersion: string;
  needsUpdate: boolean;
  hasBreakingChanges: boolean;
  compatibilityStatus: "compatible" | "warning" | "incompatible" | "unknown";
  reason: string;
  changelogUrl?: string;
}

export interface NpmPackageInfo {
  name: string;
  "dist-tags": {
    latest: string;
    [key: string]: string;
  };
  versions: Record<string, VersionInfo>;
  time: Record<string, string>;
}

export interface VersionInfo {
  version: string;
  peerDependencies?: Record<string, string>;
  engines?: {
    node?: string;
    npm?: string;
  };
  [key: string]: unknown;
}

export interface RNCompatibility {
  [rnVersion: string]: {
    react?: string;
    reactNative?: string;
    [packageName: string]: string | undefined;
  };
}
