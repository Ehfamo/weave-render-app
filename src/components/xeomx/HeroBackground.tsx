import hero1600 from "@/assets/xeomx-hero-1600.webp.asset.json";
import hero1024 from "@/assets/xeomx-hero-1024.webp.asset.json";
import hero640 from "@/assets/xeomx-hero-640.webp.asset.json";
import heroFallback from "@/assets/xeomx-hero-upload.jpg.asset.json";

/** Responsive srcset for the hero image. Mobile-first — the 640w WebP is ~22KB. */
export const HERO_SRCSET = `${hero640.url} 640w, ${hero1024.url} 1024w, ${hero1600.url} 1600w`;
export const HERO_SIZES = "(max-width: 640px) 100vw, (max-width: 1024px) 100vw, 1600px";
export const HERO_FALLBACK = heroFallback.url;
/** Base src for the <img>. Match the preload target (640w WebP) so mobile
 *  reuses the preload response and avoids a 307 to the large JPG fallback. */
export const HERO_SRC = hero640.url;
export const HERO_LARGEST = hero1600.url;

/**
 * Renders the cinematic hero background as a real <img> element so the browser
 * can treat it as the LCP candidate, use the preload hint, and pick the
 * mobile-sized WebP variant via srcset/sizes. Visually identical to the prior
 * CSS background (cover + right-center anchoring on a dark canvas).
 */
export function HeroBackground({ alt = "" }: { alt?: string }) {
  return (
    <img
      src={HERO_SRC}
      srcSet={HERO_SRCSET}
      sizes={HERO_SIZES}
      alt={alt}
      width={1600}
      height={1067}
      fetchPriority="high"
      loading="eager"
      decoding="sync"
      draggable={false}
      className="absolute inset-0 h-full w-full"
      style={{ objectFit: "cover", objectPosition: "right center" }}
    />
  );
}

/**
 * Preload link entries to attach to a route's head().links for the hero LCP.
 * We preload the mobile (640w) WebP directly: it's what mobile picks from the
 * srcset (mobile is where LCP is the bottleneck), it matches the `<img>` fetch
 * exactly so there's no duplicate download or 307 redirect chase, and it keeps
 * the tag to a single well-formed `href` (no framework-stripped attributes
 * leaving an empty-href sibling in the emitted HTML).
 */
export const heroPreloadLinks = [
  {
    rel: "preload",
    as: "image",
    href: hero640.url,
    fetchpriority: "high",
    type: "image/webp",
  } as unknown as Record<string, string>,
];