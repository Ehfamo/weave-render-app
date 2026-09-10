import { localizeHref } from "@/paraglide/runtime.js";

export const SITE_URL: string =
  (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, "") ?? "https://xeomx.com";

/** Build an absolute, locale-prefixed URL for canonical / og:url. */
export function pageUrl(path: string): string {
  const localized = localizeHref(path);
  const abs = /^https?:\/\//.test(localized)
    ? localized
    : `${SITE_URL}${localized.startsWith("/") ? "" : "/"}${localized}`;
  return abs;
}

export function buildAlternateLinks(path: string) {
  const normalized = path.replace(/^\/(en|fa|ar|zh|hi)(?=\/|$)/, "");
  const suffix = normalized.startsWith("/") ? normalized : `/${normalized}`;
  return [
    ...["en", "fa", "ar", "zh", "hi"].map((locale) => ({
      rel: "alternate",
      hrefLang: locale,
      href: `${SITE_URL}/${locale}${suffix}`,
    })),
    { rel: "alternate", hrefLang: "x-default", href: `${SITE_URL}/en${suffix}` },
  ];
}

export type SeoInput = {
  path: string;
  title: string;
  description: string;
  image?: string;
  type?: "website" | "article";
};

export function buildSeo({ path, title, description, image, type = "website" }: SeoInput) {
  const url = pageUrl(path);
  const meta: Array<Record<string, string>> = [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: type },
    { property: "og:url", content: url },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
  ];
  if (image) {
    const absImage = /^https?:\/\//.test(image)
      ? image
      : `${SITE_URL}${image.startsWith("/") ? "" : "/"}${image}`;
    meta.push(
      { property: "og:image", content: absImage },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:image", content: absImage },
    );
  }
  return {
    meta,
    links: [{ rel: "canonical", href: url }, ...buildAlternateLinks(path)],
  };
}
