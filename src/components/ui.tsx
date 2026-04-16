"use client";

import { forwardRef, useCallback, useEffect, useState } from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import { clsx } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Button                                                                     */
/* -------------------------------------------------------------------------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "subtle";
type ButtonSize = "sm" | "md" | "lg";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-accent-fg border border-transparent hover:bg-accent-hover disabled:hover:bg-accent shadow-sm",
  secondary:
    "bg-surface text-fg border border-border hover:bg-surface-2 disabled:hover:bg-surface",
  subtle:
    "bg-surface-2 text-fg-muted border border-transparent hover:bg-surface-3 hover:text-fg",
  ghost:
    "bg-transparent text-fg-muted border border-transparent hover:bg-surface-2 hover:text-fg",
  danger:
    "bg-danger-subtle text-danger border border-danger-border hover:bg-danger hover:text-white",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 text-[12.5px] gap-1.5 rounded-[6px]",
  md: "h-9 px-3.5 text-[13.5px] gap-2 rounded-[7px]",
  lg: "h-11 px-5 text-sm gap-2 rounded-[8px]",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      variant = "secondary",
      size = "md",
      loading = false,
      icon,
      children,
      disabled,
      ...props
    },
    ref
  ) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={clsx(
          "inline-flex items-center justify-center font-medium transition-colors duration-150",
          "disabled:opacity-50 disabled:cursor-not-allowed select-none whitespace-nowrap",
          BUTTON_VARIANTS[variant],
          BUTTON_SIZES[size],
          className
        )}
        {...props}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          icon
        )}
        {children}
      </button>
    );
  }
);

/* -------------------------------------------------------------------------- */
/* Badge                                                                      */
/* -------------------------------------------------------------------------- */

export type BadgeTone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "info";

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: "bg-surface-2 text-fg-muted border-border",
  accent: "bg-accent-subtle text-accent border-accent-border",
  success: "bg-success-subtle text-success border-success-border",
  warning: "bg-warning-subtle text-warning border-warning-border",
  danger: "bg-danger-subtle text-danger border-danger-border",
  info: "bg-info-subtle text-info border-info-border",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-[5px] border px-1.5 py-0.5 text-[11.5px] font-medium leading-4",
        BADGE_TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Card                                                                       */
/* -------------------------------------------------------------------------- */

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "rounded-[8px] border border-border bg-surface shadow-[var(--shadow-sm)]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  actions,
  icon,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
      <div className="flex min-w-0 items-start gap-2.5">
        {icon ? (
          <span className="mt-0.5 text-fg-subtle" aria-hidden>
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="truncate text-[13.5px] font-semibold text-fg">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-[12.5px] leading-5 text-fg-muted">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Callout                                                                    */
/* -------------------------------------------------------------------------- */

const CALLOUT_TONES = {
  neutral: "bg-surface-2 border-border text-fg-muted",
  accent: "bg-accent-subtle border-accent-border text-fg",
  success: "bg-success-subtle border-success-border text-fg",
  warning: "bg-warning-subtle border-warning-border text-fg",
  danger: "bg-danger-subtle border-danger-border text-fg",
  info: "bg-info-subtle border-info-border text-fg",
} as const;

export function Callout({
  tone = "neutral",
  icon,
  title,
  children,
  className,
}: {
  tone?: keyof typeof CALLOUT_TONES;
  icon?: React.ReactNode;
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "flex gap-2.5 rounded-[8px] border px-3.5 py-3 text-[12.5px] leading-5",
        CALLOUT_TONES[tone],
        className
      )}
    >
      {icon ? (
        <span className="mt-px shrink-0" aria-hidden>
          {icon}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        {title ? (
          <p className="mb-1 font-semibold text-fg">{title}</p>
        ) : null}
        {children}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Spinner / states                                                           */
/* -------------------------------------------------------------------------- */

export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2
      className={clsx("h-4 w-4 animate-spin text-fg-subtle", className)}
      aria-hidden
    />
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon ? (
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-[10px] border border-border bg-surface-2 text-fg-subtle">
          {icon}
        </div>
      ) : null}
      <p className="text-[13.5px] font-medium text-fg">{title}</p>
      {description ? (
        <p className="mt-1 max-w-md text-[12.5px] leading-5 text-fg-muted">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("skeleton", className)} />;
}

/* -------------------------------------------------------------------------- */
/* Copy button                                                                */
/* -------------------------------------------------------------------------- */

export function CopyButton({
  value,
  label = "Copy",
  className,
  size = "sm",
  variant = "ghost",
}: {
  value: string | (() => string);
  label?: string;
  className?: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
}) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    const text = typeof value === "function" ? value() : value;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  }, [value]);

  useEffect(() => () => setCopied(false), []);

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={copy}
      icon={
        copied ? (
          <Check className="h-3.5 w-3.5 text-success" aria-hidden />
        ) : (
          <Copy className="h-3.5 w-3.5" aria-hidden />
        )
      }
    >
      {copied ? "Copied" : label}
    </Button>
  );
}

/* -------------------------------------------------------------------------- */
/* Segmented control                                                          */
/* -------------------------------------------------------------------------- */

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: Array<{ value: T; label: React.ReactNode; title?: string }>;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={clsx(
        "inline-flex items-center gap-0.5 rounded-[7px] border border-border bg-surface-2 p-0.5",
        className
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={clsx(
              "inline-flex h-7 items-center gap-1.5 rounded-[5px] px-2.5 text-[12.5px] font-medium transition-colors duration-150",
              active
                ? "bg-surface text-fg shadow-[var(--shadow-sm)]"
                : "text-fg-muted hover:text-fg"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Misc                                                                       */
/* -------------------------------------------------------------------------- */

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] border border-border bg-surface-2 px-1 font-mono text-[10.5px] font-medium text-fg-muted">
      {children}
    </kbd>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={clsx("h-px w-full bg-border", className)} />;
}

export function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={clsx(
        "text-[11px] font-semibold uppercase tracking-[0.06em] text-fg-subtle",
        className
      )}
    >
      {children}
    </p>
  );
}
