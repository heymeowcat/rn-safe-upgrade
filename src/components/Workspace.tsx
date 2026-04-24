"use client";

import { useState } from "react";
import {
  Bot,
  FileText,
  Files,
  Package,
  Rocket,
  Sparkles,
} from "lucide-react";
import { useUpgradeSession, type TabId } from "@/lib/hooks/useUpgradeSession";
import AppHeader from "./AppHeader";
import BriefTab from "./BriefTab";
import ChangesTab from "./ChangesTab";
import DependenciesTab from "./DependenciesTab";
import AgentTab from "./AgentTab";
import CommandPalette from "./CommandPalette";
import ProjectPanel from "./ProjectPanel";
import VersionSelector from "./VersionSelector";
import { Badge, Card, CardHeader, SectionLabel } from "./ui";
import { cn, pluralize } from "@/lib/utils";

const TABS: Array<{
  id: TabId;
  label: string;
  icon: React.ReactNode;
}> = [
  { id: "brief", label: "Brief", icon: <FileText className="h-3.5 w-3.5" /> },
  {
    id: "dependencies",
    label: "Dependencies",
    icon: <Package className="h-3.5 w-3.5" />,
  },
  { id: "changes", label: "Changes", icon: <Files className="h-3.5 w-3.5" /> },
  { id: "agent", label: "Apply", icon: <Bot className="h-3.5 w-3.5" /> },
];

export default function Workspace() {
  const session = useUpgradeSession();
  const [paletteOpen, setPaletteOpen] = useState(false);

  const {
    activeTab,
    setActiveTab,
    analysis,
    diffFiles,
    brief,
    packageJson,
    completedFiles,
    plan,
  } = session;

  const updateCount = analysis.filter((item) => item.needsUpdate).length;
  const incompatibleCount = analysis.filter(
    (item) => item.compatibilityStatus === "incompatible"
  ).length;
  const reviewedCount = diffFiles.filter((file) =>
    completedFiles.has(
      `${file.type}-${file.oldPath || "none"}-${file.newPath || "none"}`
    )
  ).length;

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader onOpenCommandPalette={() => setPaletteOpen(true)} />

      <div className="mx-auto flex w-full max-w-[1560px] flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row">
        {/* Sidebar --------------------------------------------------------- */}
        <aside className="w-full shrink-0 space-y-4 lg:w-[296px]">
          <div className="lg:sticky lg:top-[76px] lg:space-y-4">
            <Card>
              <CardHeader
                title="Version pair"
                description="Pick the release you are on and the one you want."
              />
              <div className="px-4 py-3.5">
                <VersionSelector />
              </div>
            </Card>

            <Card>
              <CardHeader
                title="Your project"
                description="Optional, but it unlocks precise dependency checks."
              />
              <div className="px-4 py-3.5">
                <ProjectPanel />
              </div>
            </Card>

            {packageJson ? (
              <Card>
                <CardHeader title="Upgrade summary" />
                <dl className="divide-y divide-border">
                  {[
                    {
                      label: "Files to review",
                      value: `${reviewedCount} / ${diffFiles.length}`,
                    },
                    {
                      label: "Dependencies to update",
                      value: String(updateCount),
                    },
                    {
                      label: "Incompatible packages",
                      value: String(incompatibleCount),
                    },
                    {
                      label: "Breaking changes",
                      value: String(brief?.counts.breaking ?? 0),
                    },
                    {
                      label: "Risk",
                      value: brief ? brief.risk.toUpperCase() : "-",
                    },
                  ].map((entry) => (
                    <div
                      key={entry.label}
                      className="flex items-center justify-between gap-3 px-4 py-2"
                    >
                      <dt className="text-[12px] text-fg-muted">{entry.label}</dt>
                      <dd className="tabular font-mono text-[12.5px] text-fg">
                        {entry.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </Card>
            ) : null}

            <div className="hidden rounded-[8px] border border-border bg-surface-2 px-3.5 py-3 lg:block">
              <SectionLabel className="mb-1.5">How this stays current</SectionLabel>
              <p className="text-[11.5px] leading-4.5 text-fg-muted">
                Versions, release notes, template diffs and peer dependencies are
                fetched from the npm registry, GitHub and reactnative.dev every
                time you open the app. Nothing here is maintained by hand.
              </p>
            </div>
          </div>
        </aside>

        {/* Workspace ------------------------------------------------------- */}
        <main className="min-w-0 flex-1">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div
              role="tablist"
              aria-label="Workspace sections"
              className="flex items-center gap-0.5 overflow-x-auto rounded-[9px] border border-border bg-surface-2 p-0.5"
            >
              {TABS.map((tab) => {
                const active = activeTab === tab.id;
                const count =
                  tab.id === "dependencies"
                    ? updateCount
                    : tab.id === "changes"
                      ? diffFiles.length
                      : tab.id === "brief"
                        ? (brief?.counts.breaking ?? 0)
                        : 0;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[7px] px-2.5 text-[12.5px] font-medium transition-colors duration-150",
                      active
                        ? "bg-surface text-fg shadow-[var(--shadow-sm)]"
                        : "text-fg-muted hover:text-fg"
                    )}
                  >
                    {tab.icon}
                    {tab.label}
                    {count > 0 ? (
                      <span
                        className={cn(
                          "tabular rounded-[4px] px-1 text-[10.5px]",
                          active
                            ? "bg-accent-subtle text-accent"
                            : "bg-surface-3 text-fg-subtle"
                        )}
                      >
                        {count}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {plan ? (
              <div className="ml-auto flex items-center gap-2">
                <Badge tone="neutral">
                  <Sparkles className="h-3 w-3" aria-hidden />
                  {pluralize(plan.dependencyUpdates.length, "update")} ·{" "}
                  {pluralize(plan.filesToApply.length, "file")}
                </Badge>
              </div>
            ) : null}
          </div>

          {activeTab === "brief" ? <BriefTab /> : null}
          {activeTab === "dependencies" ? <DependenciesTab /> : null}
          {activeTab === "changes" ? <ChangesTab /> : null}
          {activeTab === "agent" ? <AgentTab /> : null}
        </main>
      </div>

      <footer className="border-t border-border px-4 py-6 sm:px-6">
        <div className="mx-auto flex w-full max-w-[1560px] flex-wrap items-center justify-between gap-3 text-[11.5px] text-fg-subtle">
          <p className="flex items-center gap-1.5">
            <Rocket className="h-3.5 w-3.5" aria-hidden />
            RN Safe Upgrade - an open source React Native upgrade assistant.
          </p>
          <p className="flex items-center gap-4">
            <a
              href="https://github.com/heymeowcat/rn-safe-upgrade"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-fg hover:underline"
            >
              Source
            </a>
            <a
              href="https://reactnative.dev/docs/upgrading"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-fg hover:underline"
            >
              Official upgrade guide
            </a>
          </p>
        </div>
      </footer>

      <CommandPalette
        open={paletteOpen}
        onOpen={() => setPaletteOpen(true)}
        onClose={() => setPaletteOpen(false)}
      />
    </div>
  );
}
