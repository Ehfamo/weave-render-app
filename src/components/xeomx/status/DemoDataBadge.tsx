// @ts-expect-error - paraglide generated messages
import { m } from "@/paraglide/messages.js";

/**
 * Small pill that labels a stat cluster or content group as illustrative /
 * unverified. Prevents users from mistaking sample numbers for real usage.
 */
export function DemoDataBadge({
  variant = "sample",
  className = "",
}: {
  variant?: "sample" | "demo" | "preview" | "illustrative";
  className?: string;
}) {
  const label =
    variant === "demo"
      ? m.demo_data_label()
      : variant === "preview"
      ? m.preview_data_label()
      : variant === "illustrative"
      ? m.illustrative_data_label()
      : m.sample_data_label();
  return (
    <span
      className={`inline-flex items-center rounded-full border border-white/15 bg-background/60 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.22em] text-muted-foreground backdrop-blur ${className}`}
      title={m.sample_data_tooltip()}
    >
      {label}
    </span>
  );
}