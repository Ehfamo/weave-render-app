import type { FeatureStatus } from "@/lib/feature-status";
import { m } from "@/paraglide/messages.js";

const STYLES: Record<FeatureStatus, string> = {
  live: "bg-emerald-500/15 text-emerald-300 border border-emerald-400/30",
  beta: "bg-sky-500/15 text-sky-300 border border-sky-400/30",
  preview: "bg-amber-500/15 text-amber-300 border border-amber-400/30",
  mock: "bg-amber-500/15 text-amber-300 border border-amber-400/30",
  planned: "bg-magenta/15 text-magenta border border-magenta/30",
  unavailable: "bg-muted text-muted-foreground border border-border",
  coming_soon: "bg-magenta/15 text-magenta border border-magenta/30",
};

function label(status: FeatureStatus): string {
  switch (status) {
    case "live":
      return m.feature_status_live();
    case "beta":
      return m.feature_status_beta();
    case "preview":
      return m.feature_status_preview();
    case "mock":
      return m.feature_status_mock();
    case "planned":
      return m.feature_status_planned();
    case "unavailable":
      return m.feature_status_unavailable();
    case "coming_soon":
      return m.feature_status_coming_soon();
  }
}

export function FeatureStatusBadge({
  status,
  size = "sm",
  className = "",
}: {
  status: FeatureStatus;
  size?: "xs" | "sm";
  className?: string;
}) {
  const sizing =
    size === "xs"
      ? "text-[9px] tracking-[0.18em] px-1.5 py-0.5"
      : "text-[10px] tracking-[0.22em] px-2 py-0.5";
  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold uppercase ${STYLES[status]} ${sizing} ${className}`}
      aria-label={`Feature status: ${label(status)}`}
    >
      {label(status)}
    </span>
  );
}
