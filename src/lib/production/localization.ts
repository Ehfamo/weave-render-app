export const SUPPORTED_LOCALES = ["en", "fa", "ar", "zh", "hi"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export function directionFor(locale: SupportedLocale): "rtl" | "ltr" {
  return locale === "fa" || locale === "ar" ? "rtl" : "ltr";
}
export function formatNumber(value: number, locale: SupportedLocale): string {
  return new Intl.NumberFormat(locale).format(value);
}
export function formatPercent(value: number, locale: SupportedLocale): string {
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(
    value,
  );
}
export function formatCurrency(
  minorUnits: number,
  currency: string,
  locale: SupportedLocale,
): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(minorUnits / 100);
}
export function formatDate(
  iso: string,
  locale: SupportedLocale,
  calendar: "gregory" | "persian" = "gregory",
): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid ISO date");
  const resolved = calendar === "persian" && locale === "fa" ? "fa-IR-u-ca-persian" : locale;
  return new Intl.DateTimeFormat(resolved, { dateStyle: "medium", timeZone: "UTC" }).format(date);
}
export function formatRelativeTime(
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
  locale: SupportedLocale,
): string {
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(value, unit);
}
export function canonicalUtc(value: Date): string {
  if (!Number.isFinite(value.getTime())) throw new Error("Invalid date");
  return value.toISOString();
}
