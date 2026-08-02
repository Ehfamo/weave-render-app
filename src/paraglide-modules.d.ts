// Ambient declarations for Paraglide's generated (untyped) output.
declare module "*/paraglide/messages.js" {
  export const m: Record<string, (...args: unknown[]) => string>;
}
declare module "*/paraglide/runtime.js" {
  export const locales: readonly string[];
  export const baseLocale: string;
  export function getLocale(): string;
  export function setLocale(locale: string, options?: { reload?: boolean }): void;
  export function localizeHref(href: string, options?: { locale?: string }): string;
  export function deLocalizeHref(href: string): string;
  export function localizeUrl(url: URL | string, options?: { locale?: string }): URL;
  export function deLocalizeUrl(url: URL | string): URL;
  export function extractLocaleFromRequest(request: Request): string;
  export function overwriteGetLocale(fn: () => string): void;
  export function assertIsLocale(input: unknown): string;
  export function isLocale(input: unknown): boolean;
  const runtime: Record<string, unknown>;
  export default runtime;
}
declare module "*/paraglide/server.js" {
  export function paraglideMiddleware<T>(
    request: Request,
    resolve: (args: { request: Request; locale: string }) => T | Promise<T>,
  ): Promise<T>;
}
