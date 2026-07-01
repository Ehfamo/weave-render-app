# Multi-language infrastructure with Paraglide JS

## Approach

Use Paraglide JS 2's `@inlang/paraglide-js` Vite plugin with `strategy: ["url", "cookie", "preferredLanguage", "baseLocale"]`. The Paraglide server middleware rewrites incoming URLs (strips `/en/…` → `/…`) **before** TanStack Router sees them, so **no route files need to move**. All existing routes (`/`, `/auth`, `/dashboard`, `/explore`, etc.) keep working unchanged, and every route is also reachable at `/{locale}/…`.

Root `/` (no locale) auto-detects: cookie → `Accept-Language` header → `en`, then 302-redirects to `/{locale}/`.

## Files

### Install
```
bun add @inlang/paraglide-js
```

### Config
- `project.inlang/settings.json` — locales `["en","fa","ar","zh","hi"]`, baseLocale `en`.
- `messages/{en,fa,ar,zh,hi}.json` — one file per locale; keys for: `nav.*`, `hero.*`, `footer.*`, `auth.*`, `notify.*`.
- `vite.config.ts` — add `paraglideVitePlugin({ project: "./project.inlang", outdir: "./src/paraglide" })`.
- `.gitignore` — add `src/paraglide` (generated).

### Server middleware
- `src/server.ts` — wrap `handler.fetch` with `paraglideMiddleware(request, ({ request, locale }) => handler.fetch(request, env, ctx))`. This strips the locale prefix so TanStack Router matches unprefixed routes, and exposes the resolved locale.
- Root fallback: if incoming path is exactly `/`, Paraglide's `url` strategy redirects to `/{detectedLocale}/`. Also handle direct-hit unknown paths by letting them pass through as base-locale.

### RTL / LTR
- `src/routes/__root.tsx` `RootShell` — read locale from Paraglide runtime (`getLocale()` works server- and client-side once middleware has run) and set `<html lang={locale} dir={locale === "fa" || locale === "ar" ? "rtl" : "ltr"}>`.

### UI
- `src/components/xeomx/LanguageSwitcher.tsx` — dropdown listing English / فارسی / العربية / 中文 / हिन्दी. Uses Paraglide's `localizeHref` + `<Link>` to swap prefix while preserving the current path.
- `src/components/xeomx/Header.tsx` — insert the switcher next to the auth actions. Replace hardcoded nav labels with `m.nav_discover()` etc.
- `src/routes/index.tsx` hero + footer text — swap to `m.hero_*`/`m.footer_*` calls.
- `src/routes/auth.tsx` visible copy — swap to `m.auth_*`.
- `src/components/xeomx/ComingSoon/shared.tsx` NotifyForm strings — swap to `m.notify_*`.

### Explore section
- `src/lib/explore-sections.ts` — prepend a `Landing` entry to `CORE_SECTIONS` (slug `landing`, phase `live`, icon `Globe`, distinct from dashboard/home/login), routing to `/`.

## Not touched
- No changes to Supabase auth files, waitlist form logic, payment code.
- No refactor of `left/right/ml-/mr-/pl-/pr-` classes.
- No route-file relocations; `src/routeTree.gen.ts` regenerates unchanged.

## Risks / notes
- Paraglide's Cloudflare Workers compatibility: the middleware is fetch/Web-standard based and runs fine in the Worker runtime used by this project.
- `src/paraglide/` is generated on `vite dev`/`vite build`; committed source references (`import { m } from "@/paraglide/messages"`) resolve after first build.
- Only static UI chrome is translated this turn; dynamic prompt/creator content stays as-is per instructions.
