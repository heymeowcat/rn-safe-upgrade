"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Copy,
  ExternalLink,
  FolderGit2,
  Link2,
  Play,
  Plug,
  PlugZap,
  Terminal,
  TriangleAlert,
  Unplug,
} from "lucide-react";
import { useUpgradeSession } from "@/lib/hooks/useUpgradeSession";
import {
  BRIDGE_PORTS,
  connectBridge,
  discoverBridge,
  parseBridgeLink,
  sendPlan,
  subscribeToBridge,
  type BridgeInfo,
  type BridgeJob,
  type BridgeLogEntry,
} from "@/lib/agent/bridgeClient";
import { planToMarkdown } from "@/lib/upgrade/plan";
import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  CopyButton,
  SectionLabel,
} from "./ui";
import { cn, pluralize } from "@/lib/utils";

type BridgeState = "idle" | "searching" | "connected" | "error";

export default function AgentTab() {
  const { plan, brief, fromVersion, toVersion, diffFiles } =
    useUpgradeSession();

  const [state, setState] = useState<BridgeState>("idle");
  const [info, setInfo] = useState<BridgeInfo | null>(null);
  const [port, setPort] = useState<number>(BRIDGE_PORTS[0]);
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<BridgeLogEntry[]>([]);
  const [job, setJob] = useState<BridgeJob | null>(null);
  const [running, setRunning] = useState(false);
  const [useAgent, setUseAgent] = useState(true);
  const [createMissingFiles, setCreateMissingFiles] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const logEndRef = useRef<HTMLDivElement>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ block: "end" });
  }, [logs]);

  const connect = useCallback(
    async (targetPort: number, sessionToken: string) => {
      setState("searching");
      setError(null);
      try {
        const bridge = await connectBridge(targetPort, sessionToken);
        setInfo(bridge);
        setPort(targetPort);
        setState("connected");
        setToken(sessionToken);

        unsubscribeRef.current?.();
        unsubscribeRef.current = subscribeToBridge(
          targetPort,
          sessionToken,
          {
            onLog: (entry) =>
              setLogs((previous) => [...previous.slice(-400), entry]),
            onJob: (next) => {
              setJob(next);
              if (next.status !== "running") setRunning(false);
            },
            onError: () => setState("error"),
          }
        );
      } catch (connectionError) {
        setState("error");
        setError(
          connectionError instanceof Error
            ? connectionError.message
            : "Could not connect to the bridge."
        );
      }
    },
    []
  );

  // Deep link: `npx ... ` prints a URL that carries the port and the token.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const parsed = parseBridgeLink(window.location.hash);
    if (parsed) {
      void connect(parsed.port, parsed.token);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [connect]);

  useEffect(() => () => unsubscribeRef.current?.(), []);

  const detect = async () => {
    setState("searching");
    setError(null);
    const found = await discoverBridge();
    if (!found) {
      setState("error");
      setError(
        "No bridge found. Start one in your project with: npx --yes github:heymeowcat/rn-safe-upgrade"
      );
      return;
    }
    setInfo(found.info);
    setPort(found.port);
    setState("idle");
  };

  const disconnect = () => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    setState("idle");
    setInfo(null);
    setJob(null);
    setLogs([]);
  };

  const run = async () => {
    if (!port || !token || !plan) return;
    setRunning(true);
    setLogs([]);
    try {
      const result = await sendPlan(port, token, {
        ...plan,
        useAgent,
        createMissingFiles,
      });
      setJob(result.job);
    } catch (runError) {
      setRunning(false);
      setError(
        runError instanceof Error ? runError.message : "The upgrade run failed."
      );
    }
  };

  const markdown = useMemo(
    () => (plan ? planToMarkdown(plan, brief) : ""),
    [plan, brief]
  );

  const project = info?.project;

  if (!plan) {
    return (
      <Callout tone="neutral" title="Select two versions first">
        The upgrade plan - the set of changes the agent has to apply - is built
        from the version pair, your package.json and the official template diff.
      </Callout>
    );
  }

  return (
    <div className="space-y-3">
      {/* Connection -------------------------------------------------------- */}
      <Card>
        <CardHeader
          title="Local agent bridge"
          description="Runs inside your project and applies the upgrade for you - no code leaves your machine."
          icon={<Plug className="h-4 w-4" />}
          actions={
            state === "connected" ? (
              <Badge tone="success">
                <CircleDot className="h-3 w-3" aria-hidden />
                connected
              </Badge>
            ) : (
              <Badge tone="neutral">not connected</Badge>
            )
          }
        />

        <div className="space-y-3 px-4 py-3.5">
          {state !== "connected" ? (
            <>
              <div className="rounded-[8px] border border-border bg-surface-2 px-3.5 py-3">
                <SectionLabel className="mb-2">
                  1 - Start the bridge in your project
                </SectionLabel>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="rounded-[6px] border border-border bg-surface px-2.5 py-1.5 font-mono text-[12.5px] text-fg">
                    npx --yes github:heymeowcat/rn-safe-upgrade
                  </code>
                  <CopyButton
                    value="npx --yes github:heymeowcat/rn-safe-upgrade"
                    label="Copy"
                    variant="secondary"
                  />
                </div>
                <p className="mt-2 text-[12px] leading-5 text-fg-muted">
                  The CLI prints a session token and a link. Open the link and
                  this page connects automatically.
                </p>
              </div>

              <div className="rounded-[8px] border border-border bg-surface-2 px-3.5 py-3">
                <SectionLabel className="mb-2">
                  2 - Connect
                </SectionLabel>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="md"
                    variant="primary"
                    onClick={detect}
                    loading={state === "searching"}
                    icon={<PlugZap className="h-3.5 w-3.5" aria-hidden />}
                  >
                    Detect bridge
                  </Button>

                  <select
                    value={port}
                    onChange={(event) => setPort(Number(event.target.value))}
                    className="h-9 rounded-[7px] border border-border bg-surface px-2 text-[12.5px] text-fg outline-none"
                    aria-label="Bridge port"
                  >
                    {BRIDGE_PORTS.map((candidate) => (
                      <option key={candidate} value={candidate}>
                        port {candidate}
                      </option>
                    ))}
                  </select>

                  <input
                    value={token}
                    onChange={(event) => setToken(event.target.value)}
                    placeholder="session token"
                    className="h-9 min-w-[180px] flex-1 rounded-[7px] border border-border bg-surface px-2.5 font-mono text-[12.5px] text-fg outline-none placeholder:text-fg-subtle focus:border-accent-border focus-visible:ring-2 focus-visible:ring-accent/15"
                    aria-label="Session token"
                  />

                  <Button
                    size="md"
                    variant="secondary"
                    disabled={!token}
                    onClick={() => connect(port, token)}
                    icon={<Link2 className="h-3.5 w-3.5" aria-hidden />}
                  >
                    Connect
                  </Button>
                </div>

                {info ? (
                  <p className="mt-2 text-[12px] text-fg-muted">
                    A bridge is running on port {port}. Paste the token printed
                    by the CLI to connect.
                  </p>
                ) : null}
              </div>

              {error ? (
                <Callout tone="danger" icon={<TriangleAlert className="h-4 w-4" />}>
                  {error}
                </Callout>
              ) : null}
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3 rounded-[8px] border border-success-border bg-success-subtle px-3.5 py-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-fg">
                    {project?.name ?? "React Native project"}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-[11.5px] text-fg-muted">
                    {project?.root}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {project?.rnVersion ? (
                      <Badge tone="neutral">
                        react-native {project.rnVersion}
                      </Badge>
                    ) : null}
                    {project?.branch ? (
                      <Badge tone="neutral">
                        <FolderGit2 className="h-3 w-3" aria-hidden />
                        {project.branch}
                      </Badge>
                    ) : null}
                    {project?.dirty ? (
                      <Badge tone="warning">uncommitted changes</Badge>
                    ) : null}
                    {info?.agents?.length ? (
                      <Badge tone="accent">
                        <Bot className="h-3 w-3" aria-hidden />
                        {info.agents.map((agent) => agent.id).join(", ")}
                      </Badge>
                    ) : (
                      <Badge tone="neutral">deterministic mode</Badge>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={disconnect}
                    icon={<Unplug className="h-3.5 w-3.5" aria-hidden />}
                  >
                    Disconnect
                  </Button>
                </div>
              </div>

              {/* Plan -------------------------------------------------------- */}
              <div className="rounded-[8px] border border-border bg-surface-2 px-3.5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <SectionLabel>Plan</SectionLabel>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <CopyButton
                      value={markdown}
                      label="Copy plan (Markdown)"
                      variant="secondary"
                    />
                    <CopyButton value={JSON.stringify(plan, null, 2)} label="JSON" />
                  </div>
                </div>

                <dl className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    { label: "React Native", value: `${fromVersion} → ${toVersion}` },
                    { label: "Dependencies", value: String(plan.dependencyUpdates.length) },
                    { label: "Files", value: String(plan.filesToApply.length) },
                    {
                      label: "Breaking changes",
                      value: String(plan.breakingChanges.length),
                    },
                  ].map((entry) => (
                    <div
                      key={entry.label}
                      className="rounded-[6px] border border-border bg-surface px-2.5 py-2"
                    >
                      <dt className="text-[11px] text-fg-subtle">{entry.label}</dt>
                      <dd className="mt-0.5 truncate font-mono text-[12.5px] text-fg">
                        {entry.value}
                      </dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-3 space-y-2">
                  <label className="flex cursor-pointer items-start gap-2 text-[12.5px] text-fg-muted">
                    <input
                      type="checkbox"
                      checked={useAgent}
                      onChange={(event) => setUseAgent(event.target.checked)}
                      className="mt-0.5 h-3.5 w-3.5 rounded-[4px] border-border accent-[var(--accent)]"
                    />
                    <span>
                      Hand the source-code changes to an agent CLI
                      {info?.agents?.length
                        ? ` (${info.agents.map((agent) => agent.label).join(", ")})`
                        : " (none detected - deterministic mode)"}
                      . The agent receives the plan as its brief.
                    </span>
                  </label>

                  <label className="flex cursor-pointer items-start gap-2 text-[12.5px] text-fg-muted">
                    <input
                      type="checkbox"
                      checked={createMissingFiles}
                      onChange={(event) =>
                        setCreateMissingFiles(event.target.checked)
                      }
                      className="mt-0.5 h-3.5 w-3.5 rounded-[4px] border-border accent-[var(--accent)]"
                    />
                    <span>
                      Also create template files the project does not have yet.
                    </span>
                  </label>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    variant="primary"
                    onClick={run}
                    loading={running}
                    disabled={job?.status === "running"}
                    icon={<Play className="h-3.5 w-3.5" aria-hidden />}
                  >
                    {running ? "Running…" : "Apply the upgrade"}
                  </Button>
                  <span className="text-[11.5px] text-fg-subtle">
                    A git branch is created before anything is written.
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Live log ---------------------------------------------------------- */}
      {state === "connected" ? (
        <Card>
          <CardHeader
            title="Run log"
            description="Live output from the bridge."
            icon={<Terminal className="h-4 w-4" />}
            actions={
              job ? (
                <Badge
                  tone={
                    job.status === "completed"
                      ? "success"
                      : job.status === "failed"
                        ? "danger"
                        : "accent"
                  }
                >
                  {job.status}
                </Badge>
              ) : null
            }
          />
          <div className="max-h-[320px] overflow-y-auto bg-[var(--bg-subtle)] px-4 py-3 font-mono text-[12px] leading-5">
            {logs.length === 0 ? (
              <p className="text-fg-subtle">
                Waiting for the bridge. Start a run to see the output here.
              </p>
            ) : (
              logs.map((entry) => (
                <div key={entry.id} className="flex gap-2">
                  <span className="shrink-0 text-fg-subtle">
                    {new Date(entry.at).toLocaleTimeString("en-GB")}
                  </span>
                  <span
                    className={cn(
                      "min-w-0 break-words",
                      entry.level === "error"
                        ? "text-danger"
                        : entry.level === "warn"
                          ? "text-warning"
                          : "text-fg-muted"
                    )}
                  >
                    {entry.message}
                  </span>
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>

          {job?.templates && job.templates.conflicts > 0 ? (
            <div className="border-t border-border px-4 py-3">
              <Callout
                tone="warning"
                icon={<TriangleAlert className="h-4 w-4" />}
                title={`${pluralize(job.templates.conflicts, "file")} could not be merged cleanly`}
              >
                The conflict markers are in the files. The agent can resolve
                them, or you can fix them by hand - the template change and
                your own change are both kept in the file.
              </Callout>
            </div>
          ) : null}

          {job?.diff ? (
            <div className="border-t border-border px-4 py-3">
              <SectionLabel className="mb-2">Result</SectionLabel>
              <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[12px] text-fg-muted">
                {job.diff}
              </pre>
            </div>
          ) : null}

          {job?.status === "completed" ? (
            <div className="border-t border-border px-4 py-3">
              <Callout tone="success" icon={<CheckCircle2 className="h-4 w-4" />}>
                The upgrade was applied in your project
                {job.branch ? ` on branch ${job.branch}` : ""}. Review the diff,
                run your tests, and commit when you are happy with it.
              </Callout>
            </div>
          ) : null}
        </Card>
      ) : null}

      {/* Plan preview ------------------------------------------------------ */}
      <Card>
        <CardHeader
          title="What the agent will do"
          description="The exact brief that is handed to the agent or applied by the bridge."
          icon={<Bot className="h-4 w-4" />}
          actions={
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowPreview((value) => !value)}
              icon={
                showPreview ? (
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                )
              }
            >
              {showPreview ? "Hide the brief" : "Preview the brief"}
            </Button>
          }
        />
        <div className="px-4 py-3">
          <ol className="mb-4 space-y-1.5">
            {plan.steps.map((step, index) => (
              <li key={step} className="flex gap-2.5 text-[12.5px] leading-5 text-fg">
                <span className="tabular mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] bg-surface-3 text-[10.5px] font-semibold text-fg-muted">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>

          {plan.dependencyUpdates.length ? (
            <div className="mb-3">
              <SectionLabel className="mb-1.5">Dependency updates</SectionLabel>
              <ul className="space-y-1">
                {plan.dependencyUpdates.map((update) => (
                  <li
                    key={update.name}
                    className="flex items-center gap-2 font-mono text-[12px]"
                  >
                    <span className="text-fg">{update.name}</span>
                    <span className="text-fg-subtle">{update.current}</span>
                    <span className="text-fg-subtle">→</span>
                    <span className="font-semibold text-accent">
                      {update.range ?? update.version}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mb-3 text-[12.5px] text-fg-subtle">
              No dependency changes - add your package.json to get precise
              version recommendations.
            </p>
          )}

          {plan.breakingChanges.length ? (
            <div className="mb-3">
              <SectionLabel className="mb-1.5">
                {pluralize(plan.breakingChanges.length, "breaking change")} to
                handle
              </SectionLabel>
              <ul className="max-h-40 space-y-1 overflow-y-auto">
                {plan.breakingChanges.slice(0, 12).map((change, index) => (
                  <li
                    key={`${change.text}-${index}`}
                    className="text-[12.5px] leading-5 text-fg-muted"
                  >
                    {change.area ? (
                      <span className="text-fg">{change.area}: </span>
                    ) : null}
                    {change.text}
                    <span className="mt-0.5 block text-fg-subtle">
                      Do: {change.action}
                      {change.file ? (
                        <>
                          {" "}
                          in <code className="font-mono">{change.file}</code>
                        </>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {showPreview ? (
            <pre
              data-plan-preview
              className="mt-3 max-h-[420px] overflow-auto rounded-[8px] border border-border bg-bg-subtle p-3 font-mono text-[11.5px] leading-4.5 text-fg-muted"
            >
              {markdown}
            </pre>
          ) : null}

          {diffFiles.length ? (
            <div>
              <SectionLabel className="mb-1.5">
                {pluralize(plan.filesToApply.length, "template file")} to sync
              </SectionLabel>
              <p className="text-[12.5px] text-fg-muted">
              The bridge merges the new template files into your project with a
              three way merge: your own changes are kept, the template changes
              are applied, and real conflicts are marked in the file. Files the
              new template dropped are removed when you did not change them.
            </p>
            </div>
          ) : null}
        </div>
      </Card>

      <Callout tone="neutral" icon={<Copy className="h-4 w-4" />}>
        Prefer doing it yourself? Copy the plan as Markdown and paste it into
        your agent of choice - it contains every dependency bump, every
        breaking change and every file that has to change.
        <span className="mt-2 flex flex-wrap items-center gap-2">
          <CopyButton value={markdown} label="Copy plan" variant="secondary" />
          <a
            href="https://github.com/heymeowcat/rn-safe-upgrade/blob/main/agent/README.md"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[12px] text-accent hover:underline"
          >
            Bridge documentation
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        </span>
      </Callout>
    </div>
  );
}
