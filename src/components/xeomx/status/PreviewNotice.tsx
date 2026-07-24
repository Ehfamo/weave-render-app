import type { FeatureStatus } from "@/lib/feature-status";
import { FeatureStatusBadge } from "./FeatureStatusBadge";
// @ts-expect-error - paraglide generated messages
import { m } from "@/paraglide/messages.js";

/**
 * Full-width honest banner rendered at the top of PREVIEW / COMING SOON pages.
 * Replaces silent "looks live" surfaces with clear expectations.
 */
export function PreviewNotice({
  status,
  title,
  body,
  className = "",
}: {
  status: Extract<FeatureStatus, "preview" | "coming_soon" | "beta">;
  title?: string;
  body?: string;
  className?: string;
}) {
  const heading =
    title ??
    (status === "coming_soon"
      ? m.coming_soon_notice_title()
      : status === "beta"
      ? m.beta_notice_title()
      : m.preview_notice_title());
  const message =
    body ??
    (status === "coming_soon"
      ? m.coming_soon_notice_body()
      : status === "beta"
      ? m.beta_notice_body()
      : m.preview_notice_body());
  return (
    <div
      role="note"
      className={`flex flex-col gap-2 rounded-2xl border border-white/10 bg-surface/70 p-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between ${className}`}
    >
      <div className="flex items-center gap-3">
        <FeatureStatusBadge status={status} />
        <p className="text-sm font-medium text-foreground">{heading}</p>
      </div>
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  );
}