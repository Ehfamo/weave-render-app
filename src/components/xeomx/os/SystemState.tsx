import { useId } from "react";

export type SystemStateVariant =
  | "loading"
  | "slow-network"
  | "empty"
  | "error"
  | "offline"
  | "permission-denied"
  | "provider-unavailable"
  | "rate-limited"
  | "expired-credential"
  | "expired-session"
  | "payment-failure"
  | "generation-failed"
  | "partial-completion"
  | "job-processing"
  | "job-failed"
  | "job-cancelled"
  | "job-resumed"
  | "success";

/** Callers supply the actual state and localized explanation, never fabricated success. */
export function SystemState({
  variant,
  title,
  description,
  compact = false,
  className = "",
}: {
  variant: SystemStateVariant;
  title: string;
  description: string;
  compact?: boolean;
  className?: string;
}) {
  const headingId = useId();
  const busy = variant === "loading" || variant === "job-processing";
  const failed = ["error", "generation-failed", "job-failed", "payment-failure"].includes(variant);
  return (
    <section
      role={failed ? "alert" : "status"}
      aria-busy={busy}
      aria-labelledby={headingId}
      data-state={variant}
      className={`rounded-xl border border-border text-start ${compact ? "p-3" : "p-5"} ${className}`}
    >
      <h3 id={headingId} className="font-medium">
        {title}
      </h3>
      <p className="mt-2 break-words text-sm text-muted-foreground">{description}</p>
    </section>
  );
}
