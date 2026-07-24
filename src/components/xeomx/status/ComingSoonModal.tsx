import { useEffect } from "react";
import { X } from "lucide-react";
import type { FeatureKey } from "@/lib/feature-status";
import { FEATURES } from "@/lib/feature-status";
import { FeatureStatusBadge } from "./FeatureStatusBadge";
import { NotifyForm } from "@/components/xeomx/ComingSoon/shared";
// @ts-expect-error - paraglide generated messages
import { m } from "@/paraglide/messages.js";

export function ComingSoonModal({
  open,
  onClose,
  featureKey,
  title,
  description,
}: {
  open: boolean;
  onClose: () => void;
  featureKey: FeatureKey;
  title?: string;
  description?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const cfg = FEATURES[featureKey];
  const status = cfg.status === "coming_soon" ? "coming_soon" : "preview";
  const heading = title ?? (status === "coming_soon" ? m.coming_soon_notice_title() : m.preview_notice_title());
  const body = description ?? (status === "coming_soon" ? m.coming_soon_notice_body() : m.preview_notice_body());

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cs-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-3xl border border-white/10 bg-background p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <FeatureStatusBadge status={status} />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={m.common_close?.() ?? "Close"}
            className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-surface/60 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <h2 id="cs-modal-title" className="mt-4 font-display text-2xl font-semibold tracking-tight">
          {heading}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        {cfg.waitlistEnabled ? (
          <div className="mt-5">
            <NotifyForm sectionSlug={cfg.key} />
          </div>
        ) : null}
      </div>
    </div>
  );
}