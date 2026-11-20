import {
  useRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type PointerEvent,
  type ReactNode,
} from "react";
import { cx } from "../lib/util";

/* Edge-lit glass surface: 1px rim, inner top highlight, soft depth shadow. */
export function Surface({
  interactive = false,
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  const track = (event: PointerEvent<HTMLDivElement>) => {
    if (!interactive || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    ref.current.style.setProperty("--mx", `${((event.clientX - rect.left) / rect.width) * 100}%`);
    ref.current.style.setProperty("--my", `${((event.clientY - rect.top) / rect.height) * 100}%`);
  };

  return (
    <div
      ref={ref}
      onPointerMove={track}
      className={cx("glass", interactive && "glass--interactive", className)}
      {...rest}
    >
      {children}
    </div>
  );
}

type ButtonVariant = "primary" | "ink" | "glass" | "ghost";

export function Button({
  variant = "glass",
  size = "md",
  icon,
  iconRight,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  icon?: ReactNode;
  iconRight?: ReactNode;
}) {
  return (
    <button type="button" className={cx("btn", `btn--${variant}`, `btn--${size}`, className)} {...rest}>
      {icon}
      {children}
      {iconRight}
    </button>
  );
}

export function IconButton({
  label,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" className={cx("icon-btn", className)} aria-label={label} title={label} {...rest}>
      {children}
    </button>
  );
}

export function Chip({
  children,
  tone = "neutral",
  className,
  title,
}: {
  children: ReactNode;
  tone?: "neutral" | "ready" | "live" | "warn";
  className?: string;
  title?: string;
}) {
  return (
    <span className={cx("chip", `chip--${tone}`, className)} title={title}>
      {children}
    </span>
  );
}

export function ScoreBadge({ score }: { score: number }) {
  return (
    <span className={cx("score", score >= 90 && "score--high")} title="Offcut score">
      <span className="score__num">{score}</span>
      <span className="score__label">score</span>
    </span>
  );
}

export function ProgressBar({
  value,
  tone = "ink",
  label,
}: {
  value: number;
  tone?: "ink" | "lime";
  label?: string;
}) {
  return (
    <div
      className={cx("progress", `progress--${tone}`)}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <span className="progress__fill" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
  size = "md",
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  label?: string;
  size?: "sm" | "md";
}) {
  return (
    <div className={cx("seg", size === "sm" && "seg--sm")} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          className={cx("seg__item", option.value === value && "is-active")}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Field({
  label,
  hint,
  counter,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  counter?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="field">
      <div className="field__head">
        <label className="field__label" htmlFor={htmlFor}>
          {label}
        </label>
        {hint ? <span className="field__hint">{hint}</span> : null}
        {counter ? <span className="field__hint field__hint--mono">{counter}</span> : null}
      </div>
      {children}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={cx("toggle", checked && "is-on")}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle__thumb" />
    </button>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty__icon">{icon}</span>
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}
