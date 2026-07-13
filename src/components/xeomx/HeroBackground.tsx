import hero1600 from "@/assets/xeomx-hero-1600.webp.asset.json";
import hero1024 from "@/assets/xeomx-hero-1024.webp.asset.json";
import hero640 from "@/assets/xeomx-hero-640.webp.asset.json";
import heroFallback from "@/assets/xeomx-hero-upload.jpg.asset.json";

/** Responsive srcset for the hero image. Mobile-first — the 640w WebP is ~22KB. */
export const HERO_SRCSET = `${hero640.url} 640w, ${hero1024.url} 1024w, ${hero1600.url} 1600w`;
export const HERO_SIZES = "(max-width: 640px) 100vw, (max-width: 1024px) 100vw, 1600px";
export const HERO_FALLBACK = heroFallback.url;
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
      src={HERO_FALLBACK}
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

/** Preload link entries to attach to a route's head().links for the hero LCP. */
export const heroPreloadLinks = [
  {
    rel: "preload",
    as: "image",
    href: hero1024.url,
    imagesrcset: HERO_SRCSET,
    imagesizes: HERO_SIZES,
    fetchpriority: "high",
    type: "image/webp",
  } as unknown as Record<string, string>,
];