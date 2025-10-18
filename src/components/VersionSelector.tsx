"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { ArrowRight, Loader2, Search } from "lucide-react";

interface VersionSelectorProps {
  currentVersion: string;
  targetVersion: string;
  onCurrentChange: (version: string) => void;
  onTargetChange: (version: string) => void;
}

interface RNVersion {
  version: string;
  label: string;
  isLatest?: boolean;
}

const VersionCombobox = ({
  value,
  onChange,
  versions,
  placeholder,
}: {
  value: string;
  onChange: (version: string) => void;
  versions: RNVersion[];
  placeholder: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredVersions = useMemo(() => {
    if (!query) return versions;
    return versions.filter((v) =>
      v.version.toLowerCase().includes(query.toLowerCase())
    );
  }, [query, versions]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    setActiveIndex(-1);
  }, [filteredVersions]);

  const handleSelect = (version: string) => {
    onChange(version);
    setQuery("");
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, filteredVersions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex !== -1 && filteredVersions[activeIndex]) {
        handleSelect(filteredVersions[activeIndex].version);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="relative">
        <input
          type="text"
          value={query || value}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
            if (value && e.target.value !== value) {
              onChange("");
            }
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-base pr-10"
        />
        <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
          <Search className="w-5 h-5 text-gray-400" />
        </div>
      </div>

      {isOpen && (
        <ul className="absolute z-10 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filteredVersions.length > 0 ? (
            filteredVersions.map((version, index) => (
              <li
                key={version.version}
                onClick={() => handleSelect(version.version)}
                className={`px-4 py-2 cursor-pointer text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                  index === activeIndex ? "bg-blue-50 dark:bg-blue-900/50" : ""
                }`}
              >
                {version.label} {version.isLatest ? " (latest)" : ""}
              </li>
            ))
          ) : (
            <li className="px-4 py-2 text-gray-500">No versions found.</li>
          )}
        </ul>
      )}
    </div>
  );
};

export default function VersionSelector({
  currentVersion,
  targetVersion,
  onCurrentChange,
  onTargetChange,
}: VersionSelectorProps) {
  const [versions, setVersions] = useState<RNVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReactNativeVersions = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(
          "https://raw.githubusercontent.com/react-native-community/rn-diff-purge/master/RELEASES"
        );
        if (!response.ok) {
          throw new Error(`Failed to fetch RELEASES: ${response.status}`);
        }
        const text = await response.text();
        const versionList = text
          .split("\n")
          .map((v) => v.trim())
          .filter((v) => v.length > 0)
          .sort((a, b) => (a < b ? 1 : -1));

        const formattedVersions: RNVersion[] = versionList.map(
          (version, index) => ({
            version,
            label: version,
            isLatest: index === 0,
          })
        );
        setVersions(formattedVersions);
        if (formattedVersions.length > 0 && !targetVersion) {
          onTargetChange(formattedVersions[0].version);
        }
      } catch (err) {
        console.error("Error fetching RN versions:", err);
        setError("Failed to load React Native versions from source.");
      } finally {
        setLoading(false);
      }
    };
    fetchReactNativeVersions();
  }, [targetVersion, onTargetChange]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm text-yellow-800 dark:text-yellow-200">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-[1fr_auto_1fr] gap-6 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            What's your current react-native version?
          </label>
          <VersionCombobox
            value={currentVersion}
            onChange={onCurrentChange}
            versions={versions}
            placeholder="Select or type a version..."
          />
        </div>

        <div className="hidden md:flex justify-center pb-4">
          <ArrowRight className="w-6 h-6 text-gray-400" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            What's the version you want to upgrade to?
          </label>
          <VersionCombobox
            value={targetVersion}
            onChange={onTargetChange}
            versions={versions}
            placeholder="Select or type a version..."
          />
        </div>
      </div>

      {currentVersion && targetVersion && currentVersion !== targetVersion && (
        <div className="flex items-center justify-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm">
          <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
            {currentVersion}
          </span>
          <ArrowRight className="w-4 h-4 text-gray-400" />
          <span className="font-mono font-semibold text-violet-600 dark:text-violet-400">
            {targetVersion}
          </span>
        </div>
      )}
    </div>
  );
}
