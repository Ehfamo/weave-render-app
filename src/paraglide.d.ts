declare module "@/paraglide/messages.js" {
  export const m: Record<string, (inputs?: Record<string, string | number>) => string>;
}

declare module "@/paraglide/runtime.js" {
  export type Locale = "en" | "fa" | "ar" | "zh" | "hi";

  export function getLocale(): Locale;
  export function setLocale(locale: Locale): void;
}
