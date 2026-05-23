import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border px-8 py-5">
      <div>
        <h1 className="text-lg font-semibold text-content">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-content-subtle">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
