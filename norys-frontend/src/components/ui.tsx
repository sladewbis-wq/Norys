"use client";

import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

// ---------------- Button ----------------
type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-hover shadow-soft",
  secondary: "bg-bg-elevated text-content border border-border hover:border-border-strong",
  ghost: "text-content-muted hover:text-content hover:bg-bg-elevated",
  danger: "bg-danger/15 text-danger hover:bg-danger/25 border border-danger/30",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-sm",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, className, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50",
        "disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  ),
);
Button.displayName = "Button";

// ---------------- Input ----------------
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "w-full h-10 rounded-lg bg-bg-inset border border-border px-3 text-sm text-content",
        "placeholder:text-content-subtle transition-colors",
        "focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/40",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

// ---------------- Textarea ----------------
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-lg bg-bg-inset border border-border px-3 py-2 text-sm text-content",
        "placeholder:text-content-subtle transition-colors resize-none",
        "focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/40",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

// ---------------- Field ----------------
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-content-muted">{label}</span>
      {children}
      {hint && <span className="block text-xs text-content-subtle">{hint}</span>}
    </label>
  );
}

// ---------------- Card ----------------
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("rounded-xl border border-border bg-bg-subtle", className)}>
      {children}
    </div>
  );
}

// ---------------- Badge ----------------
export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "brand" | "success" | "warning" | "danger" }) {
  const tones = {
    neutral: "bg-bg-elevated text-content-muted border-border",
    brand: "bg-brand-subtle text-brand-hover border-brand/30",
    success: "bg-success/10 text-success border-success/30",
    warning: "bg-warning/10 text-warning border-warning/30",
    danger: "bg-danger/10 text-danger border-danger/30",
  };
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium", tones[tone])}>
      {children}
    </span>
  );
}

// ---------------- Avatar ----------------
export function Avatar({ label }: { label: string }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-subtle text-xs font-semibold text-brand-hover">
      {label}
    </span>
  );
}

// ---------------- Skeleton ----------------
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-lg", className)} />;
}

// ---------------- Empty state ----------------
export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
      {icon && <div className="mb-3 text-content-subtle">{icon}</div>}
      <p className="text-sm font-medium text-content">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-content-subtle">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
