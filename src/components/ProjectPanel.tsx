"use client";

import { useCallback, useRef, useState } from "react";
import {
  Braces,
  Check,
  FileJson,
  FolderOpen,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useUpgradeSession } from "@/lib/hooks/useUpgradeSession";
import type { PackageJson } from "@/lib/types";
import { Badge, Button } from "./ui";
import { cn } from "@/lib/utils";

function parsePackageJson(raw: string): {
  data: PackageJson | null;
  error: string | null;
} {
  try {
    const parsed = JSON.parse(raw) as PackageJson;
    if (!parsed || typeof parsed !== "object") {
      return { data: null, error: "That is not a package.json object." };
    }
    if (!parsed.dependencies && !parsed.devDependencies) {
      return {
        data: null,
        error: "No dependencies or devDependencies were found.",
      };
    }
    return { data: parsed, error: null };
  } catch {
    return { data: null, error: "That is not valid JSON." };
  }
}

export default function ProjectPanel() {
  const { packageJson, setPackageJson, appName, appPackage } =
    useUpgradeSession();
  const [mode, setMode] = useState<"idle" | "paste">("idle");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const apply = useCallback(
    (raw: string) => {
      const { data, error: parseError } = parsePackageJson(raw);
      if (parseError || !data) {
        setError(parseError ?? "Could not read the file.");
        return;
      }
      setError(null);
      setPackageJson(data);
      setMode("idle");
      setText("");
    },
    [setPackageJson]
  );

  const readFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => apply(String(reader.result ?? ""));
      reader.onerror = () => setError("Could not read the file.");
      reader.readAsText(file);
    },
    [apply]
  );

  const dependencyCount = packageJson
    ? Object.keys({
        ...(packageJson.dependencies ?? {}),
        ...(packageJson.devDependencies ?? {}),
      }).length
    : 0;

  if (packageJson) {
    return (
      <div className="space-y-2.5">
        <div className="rounded-[8px] border border-border bg-surface px-3 py-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[12.5px] font-medium text-fg">
                {packageJson.name ?? "package.json"}
              </p>
              <p className="mt-0.5 text-[11.5px] text-fg-subtle">
                {dependencyCount} dependencies
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPackageJson(null)}
              title="Remove project"
              aria-label="Remove project"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] text-fg-subtle transition-colors hover:bg-surface-2 hover:text-danger"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {appName ? <Badge tone="accent">{appName}</Badge> : null}
            {appPackage ? (
              <Badge tone="neutral" className="font-mono">
                {appPackage}
              </Badge>
            ) : null}
          </div>
        </div>

        <Button
          size="sm"
          variant="ghost"
          className="w-full"
          onClick={() => fileInputRef.current?.click()}
          icon={<Upload className="h-3.5 w-3.5" aria-hidden />}
        >
          Replace package.json
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) readFile(file);
            event.target.value = "";
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {mode === "paste" ? (
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setError(null);
            }}
            placeholder='{ "name": "my-app", "dependencies": { … } }'
            className="h-40 w-full resize-y rounded-[8px] border border-border bg-surface p-2.5 font-mono text-[11.5px] leading-4 text-fg outline-none transition-colors placeholder:text-fg-subtle focus:border-accent-border focus-visible:ring-2 focus-visible:ring-accent/15"
            aria-label="package.json content"
          />
          {error ? (
            <p className="text-[11.5px] text-danger">{error}</p>
          ) : null}
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="primary"
              onClick={() => apply(text)}
              disabled={!text.trim()}
            >
              Use this
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setMode("idle");
                setText("");
                setError(null);
              }}
              icon={<X className="h-3.5 w-3.5" aria-hidden />}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const file = event.dataTransfer.files?.[0];
            if (file) readFile(file);
          }}
          className={cn(
            "rounded-[8px] border border-dashed px-3 py-4 text-center transition-colors duration-150",
            dragging
              ? "border-accent bg-accent-subtle"
              : "border-border bg-surface-2"
          )}
        >
          <FileJson
            className="mx-auto h-5 w-5 text-fg-subtle"
            aria-hidden
          />
          <p className="mt-2 text-[12px] text-fg-muted">
            Drop your <span className="font-mono">package.json</span> here
          </p>
          <div className="mt-2.5 flex justify-center gap-1.5">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              icon={<FolderOpen className="h-3.5 w-3.5" aria-hidden />}
            >
              Browse
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setMode("paste")}
              icon={<Braces className="h-3.5 w-3.5" aria-hidden />}
            >
              Paste
            </Button>
          </div>
          {error ? (
            <p className="mt-2 text-[11.5px] text-danger">{error}</p>
          ) : null}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) readFile(file);
          event.target.value = "";
        }}
      />

      <p className="flex items-start gap-1.5 text-[11px] leading-4 text-fg-subtle">
        <Check className="mt-0.5 h-3 w-3 shrink-0 text-success" aria-hidden />
        The file is parsed in your browser and never uploaded anywhere.
      </p>
    </div>
  );
}
