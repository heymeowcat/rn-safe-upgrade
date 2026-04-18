"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CircleDot,
  FileWarning,
  Layers,
  Package,
  ShieldAlert,
  Sparkles,
  Terminal,
  Wrench,
} from "lucide-react";
import { useUpgradeSession } from "@/lib/hooks/useUpgradeSession";
import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  EmptyState,
  SectionLabel,
  Skeleton,
} from "./ui";
import { cn, formatDate, pluralize } from "@/lib/utils";
import type { ReleaseNote } from "@/lib/data/releaseNotes";

const RISK_TONE = {
  low: "success",
  medium: "warning",
  high: "danger",
} as const;

const RISK_LABEL = {
  low: "Low risk",
  medium: "Medium risk",
  high: "High risk",
} as const;

function NoteList({
  notes,
  emptyText,
}: {
  notes: ReleaseNote[];
  emptyText: string;
}) {
  if (notes.length === 0) {
    return <p className="px-1 py-2 text-[12.5px] text-fg-subtle">{emptyText}</p>;
  }

  return (
    <ul className="divide-y divide-border">
      {notes.map((note, index) => (
        <li
          key={`${note.text}-${index}`}
          className="flex gap-2.5 px-1 py-2.5 first:pt-0 last:pb-0"
        >
          <span
            className={cn(
              "mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full",
              note.breaking
                ? "bg-danger"
                : note.category === "deprecated"
                  ? "bg-warning"
                  : note.category === "removed"
                    ? "bg-danger"
                    : note.review
                      ? "bg-info"
                      : "bg-fg-subtle"
            )}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] leading-5 text-fg">{note.text}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {note.area ? (
                <span className="text-[11px] text-fg-subtle">{note.area}</span>
              ) : null}
              {note.breaking ? (
                <Badge tone="danger">breaking</Badge>
              ) : note.review ? (
                <Badge tone="info">review</Badge>
              ) : null}
              {note.url ? (
                <a
                  href={note.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-[11px] text-accent hover:underline"
                >
                  PR
                  <ArrowUpRight className="h-3 w-3" aria-hidden />
                </a>
              ) : null}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function BriefTab() {
  const { brief, releaseNotes, releaseNotesLoading, toVersion, diffLoading } =
    useUpgradeSession();
  const [showAllNotes, setShowAllNotes] = useState(false);

  const actionable = useMemo(() => {
    if (!releaseNotes) return [];
    return [
      ...releaseNotes.breaking,
      ...releaseNotes.deprecated,
      ...releaseNotes.removed,
      ...releaseNotes.review,
    ];
  }, [releaseNotes]);

  const features = useMemo(() => {
    if (!releaseNotes) return [];
    return releaseNotes.added.slice(0, showAllNotes ? 60 : 8);
  }, [releaseNotes, showAllNotes]);

  if (releaseNotesLoading && !brief) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!toVersion) {
    return (
      <EmptyState
        icon={<Layers className="h-5 w-5" />}
        title="Pick a target version"
        description="Choose the React Native version you want to move to and the brief is generated automatically."
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Headline ---------------------------------------------------------- */}
      <Card>
        <div className="px-4 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={brief ? RISK_TONE[brief.risk] : "neutral"}>
              {brief ? RISK_LABEL[brief.risk] : "Unknown risk"}
            </Badge>
            {brief?.requirements.react ? (
              <Badge tone="neutral">
                <Package className="h-3 w-3" aria-hidden />
                react {brief.requirements.react}
              </Badge>
            ) : null}
            {brief?.requirements.node ? (
              <Badge tone="neutral">
                <Terminal className="h-3 w-3" aria-hidden />
                node {brief.requirements.node}
              </Badge>
            ) : null}
            {brief?.releasedAt ? (
              <span className="inline-flex items-center gap-1 text-[11.5px] text-fg-subtle">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                {formatDate(brief.releasedAt)}
              </span>
            ) : null}
          </div>

          <h2 className="mt-3 text-[17px] font-semibold leading-6 text-fg">
            {brief?.headline ?? `React Native ${toVersion}`}
          </h2>

          {brief?.riskReasons.length ? (
            <ul className="mt-2.5 space-y-1">
              {brief.riskReasons.map((reason) => (
                <li
                  key={reason}
                  className="flex gap-2 text-[12.5px] leading-5 text-fg-muted"
                >
                  <CircleDot
                    className="mt-[7px] h-1.5 w-1.5 shrink-0 text-fg-subtle"
                    aria-hidden
                  />
                  {reason}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            {brief?.blogUrl ? (
              <Button
                size="sm"
                variant="secondary"
                icon={<ArrowUpRight className="h-3.5 w-3.5" aria-hidden />}
              >
                <a href={brief.blogUrl} target="_blank" rel="noopener noreferrer">
                  Official announcement
                </a>
              </Button>
            ) : null}
            {brief?.releaseNotesUrl ? (
              <Button
                size="sm"
                variant="secondary"
                icon={<ArrowUpRight className="h-3.5 w-3.5" aria-hidden />}
              >
                <a
                  href={brief.releaseNotesUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Release notes
                </a>
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              icon={<ArrowUpRight className="h-3.5 w-3.5" aria-hidden />}
            >
              <a
                href={`https://reactnative.dev/docs/upgrading`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Upgrade guide
              </a>
            </Button>
          </div>
        </div>
      </Card>

      {/* Prose release notes (older format) -------------------------------- */}
      {releaseNotes && releaseNotes.notes.length === 0 && releaseNotes.summary ? (
        <Card>
          <CardHeader
            title="Release announcement"
            description="This release predates the structured release notes, so the announcement is shown instead."
            icon={<FileWarning className="h-4 w-4" />}
          />
          <div className="px-4 py-3">
            <p className="whitespace-pre-line text-[12.5px] leading-5 text-fg-muted">
              {releaseNotes.summary}
            </p>
            {releaseNotes.links.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {releaseNotes.links.slice(0, 6).map((link) => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-[6px] border border-border bg-surface-2 px-2 py-1 text-[12px] text-accent transition-colors hover:bg-surface-3"
                  >
                    {link.title}
                    <ArrowUpRight className="h-3 w-3" aria-hidden />
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        </Card>
      ) : null}

      {/* Observations ------------------------------------------------------ */}
      {brief && brief.highlights.observations.length > 0 ? (
        <Card>
          <CardHeader
            title="What to expect in your project"
            description="Derived from the official template diff for this release."
            icon={<Wrench className="h-4 w-4" />}
          />
          <div className="space-y-2 px-4 py-3">
            {brief.highlights.observations.map((observation) => (
              <Callout key={observation} tone="neutral" icon={<FileWarning className="h-3.5 w-3.5" />}>
                {observation}
              </Callout>
            ))}
          </div>
        </Card>
      ) : null}

      {/* Actionable changes ------------------------------------------------ */}
      <Card>
        <CardHeader
          title="Breaking changes, deprecations and removals"
          description={
            actionable.length
              ? `${pluralize(actionable.length, "entry")} extracted from the published release notes.`
              : "Extracted from the published release notes."
          }
          icon={<ShieldAlert className="h-4 w-4" />}
          actions={
            releaseNotes ? (
              <div className="flex gap-1.5">
                <Badge tone="danger">{releaseNotes.breaking.length} breaking</Badge>
                {releaseNotes.review.length ? (
                  <Badge tone="info">{releaseNotes.review.length} to review</Badge>
                ) : null}
                <Badge tone="warning">
                  {releaseNotes.deprecated.length} deprecated
                </Badge>
                <Badge tone="neutral">{releaseNotes.removed.length} removed</Badge>
              </div>
            ) : null
          }
        />
        <div className="px-4 py-3">
          {releaseNotesLoading && !releaseNotes ? (
            <Skeleton className="h-32 w-full" />
          ) : actionable.length ? (
            <>
              <NoteList notes={actionable} emptyText="Nothing to act on." />
              {actionable.length > 12 ? (
                <button
                  type="button"
                  onClick={() => setShowAllNotes((value) => !value)}
                  className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:underline"
                >
                  {showAllNotes ? "Show less" : `Show all ${actionable.length}`}
                  {showAllNotes ? (
                    <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                  )}
                </button>
              ) : null}
            </>
          ) : (
            <p className="py-1 text-[12.5px] text-fg-subtle">
              No breaking changes were detected for this release.
            </p>
          )}
        </div>
      </Card>

      {/* Features ---------------------------------------------------------- */}
      {releaseNotes && releaseNotes.added.length > 0 ? (
        <Card>
          <CardHeader
            title="What is new"
            description={`${pluralize(releaseNotes.added.length, "new capability")} in this release.`}
            icon={<Sparkles className="h-4 w-4" />}
          />
          <div className="px-4 py-3">
            <NoteList notes={features} emptyText="Nothing new here." />
            {releaseNotes.added.length > 8 ? (
              <button
                type="button"
                onClick={() => setShowAllNotes((value) => !value)}
                className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:underline"
              >
                {showAllNotes ? "Show less" : "Show more"}
                {showAllNotes ? (
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                )}
              </button>
            ) : null}
          </div>
        </Card>
      ) : null}

      {/* Diff summary ------------------------------------------------------ */}
      <Card>
        <CardHeader
          title="Template impact"
          description="How much of the official template changes between the two versions."
          icon={<Layers className="h-4 w-4" />}
        />
        <div className="grid grid-cols-2 divide-border px-4 py-3 sm:grid-cols-4 sm:divide-x">
          {[
            { label: "Files changed", value: brief?.highlights.total ?? 0 },
            { label: "Android", value: brief?.highlights.android ?? 0 },
            { label: "iOS", value: brief?.highlights.ios ?? 0 },
            { label: "JavaScript", value: brief?.highlights.javascript ?? 0 },
          ].map((stat) => (
            <div key={stat.label} className="px-2 py-2 first:pl-0 sm:px-4">
              <p className="tabular text-[20px] font-semibold text-fg">
                {diffLoading ? "—" : stat.value}
              </p>
              <p className="text-[11.5px] text-fg-subtle">{stat.label}</p>
            </div>
          ))}
        </div>
        {brief && brief.highlights.criticalFiles.length > 0 ? (
          <div className="border-t border-border px-4 py-3">
            <SectionLabel className="mb-2">Files that usually need manual work</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {brief.highlights.criticalFiles.map((file) => (
                <code
                  key={file}
                  className="rounded-[5px] border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-fg-muted"
                >
                  {file}
                </code>
              ))}
            </div>
          </div>
        ) : null}
      </Card>

      {brief && brief.risk === "high" ? (
        <Callout
          tone="danger"
          icon={<AlertTriangle className="h-4 w-4" />}
          title="This upgrade needs attention"
        >
          Work through the breaking changes above first, and use the agent bridge
          to apply the mechanical parts of the upgrade inside your project.
        </Callout>
      ) : null}
    </div>
  );
}
