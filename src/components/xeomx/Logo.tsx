import logoSymbol from "@/assets/logo-symbol.webp";

type LogoProps = {
  /** "full" = mark + wordmark, "symbol" = mark only, "wordmark" = text only */
  variant?: "full" | "symbol" | "wordmark";
  /** Symbol height in px (wordmark scales relative to it) */
  size?: number;
  className?: string;
  /** Decorative logos should be aria-hidden; brand-link logos need an accessible name */
  ariaLabel?: string;
};

/**
 * Official XEOMX brand mark.
 * Source of truth: /src/assets/logo-symbol.webp (extracted from the brand guide).
 * Do not swap this component's imagery without a brand review.
 */
export function Logo({
  variant = "full",
  size = 32,
  className,
  ariaLabel,
}: LogoProps) {
  const showSymbol = variant !== "wordmark";
  const showWordmark = variant !== "symbol";
  const decorative = !ariaLabel;
  return (
    <span
      className={`inline-flex items-center gap-2 ${className ?? ""}`}
      role={decorative ? undefined : "img"}
      aria-label={ariaLabel}
      aria-hidden={decorative || undefined}
    >
      {showSymbol && (
        <img
          src={logoSymbol}
          alt=""
          width={size}
          height={size}
          decoding="async"
          loading="eager"
          className="block shrink-0 select-none"
          style={{ height: size, width: size }}
          draggable={false}
        />
      )}
      {showWordmark && (
        <span
          className="font-display font-bold tracking-tight leading-none"
          style={{ fontSize: Math.round(size * 0.62) }}
        >
          XEO<span className="text-gradient-magenta">MX</span>
        </span>
      )}
    </span>
  );
}
