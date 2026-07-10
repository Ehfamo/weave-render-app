import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
// @ts-expect-error - paraglide generated runtime
import { getLocale } from "../paraglide/runtime.js";
// @ts-expect-error - paraglide generated messages
import { m } from "../paraglide/messages.js";
import { SITE_URL } from "../lib/seo";

const LOCALES = ["en", "fa", "ar", "zh", "hi"] as const;

function NotFoundComponent() {
  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background"
      style={{ paddingInline: "var(--space-4)" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 30%, rgba(255,107,26,0.16), transparent 55%), radial-gradient(ellipse at 50% 80%, rgba(255,46,138,0.12), transparent 60%)",
        }}
      />
      <div
        className="relative max-w-xl text-center"
        style={{
          animation: "root404In var(--motion-duration-base) var(--motion-ease) both",
        }}
      >
        <h1
          className="font-display font-bold leading-none tracking-tight"
          style={{
            fontSize: "clamp(6rem, 18vw, var(--font-size-display) * 2.5)",
            background: "linear-gradient(135deg, var(--action-primary), var(--action-secondary))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          404
        </h1>
        <p
          className="font-display"
          style={{
            marginTop: "var(--space-5)",
            fontSize: "var(--font-size-h2)",
            color: "var(--text-secondary)",
          }}
        >
          {m.root_404_line()}
        </p>
        <p
          style={{
            marginTop: "var(--space-3)",
            fontSize: "var(--font-size-body)",
            color: "var(--text-muted)",
          }}
        >
          {m.root_404_desc()}
        </p>
        <div
          className="flex flex-wrap items-center justify-center"
          style={{ marginTop: "var(--space-7)", gap: "var(--space-3)" }}
        >
          <Link
            to="/explore"
            className="inline-flex items-center justify-center font-medium text-white transition hover:opacity-90"
            style={{
              background: "var(--action-primary)",
              borderRadius: "var(--radius-sm)",
              paddingInline: "var(--space-5)",
              paddingBlock: "var(--space-3)",
              fontSize: "var(--font-size-body)",
            }}
          >
            {m.root_404_cta_explore()}
          </Link>
          <Link
            to="/"
            className="inline-flex items-center justify-center text-foreground transition hover:bg-surface"
            style={{
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-sm)",
              paddingInline: "var(--space-5)",
              paddingBlock: "var(--space-3)",
              fontSize: "var(--font-size-body)",
            }}
          >
            {m.root_go_home()}
          </Link>
        </div>
      </div>
      <style>{`@keyframes root404In { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{m.root_error_title()}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{m.root_error_desc()}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {m.root_try_again()}
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            {m.root_go_home()}
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => {
    let title = "XeomX — Cinematic AI Prompt Marketplace";
    let desc = "Discover, remix and own the world's most cinematic AI prompts. Netflix-style discovery, viral feed, premium drops.";
    try {
      title = m.root_head_title();
      desc = m.root_head_desc();
    } catch {
      /* fall back to English defaults during prerender */
    }
    return {
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title },
      { name: "description", content: desc },
      { name: "author", content: "XeomX" },
      { property: "og:title", content: title },
      { property: "og:description", content: desc },
      { property: "og:site_name", content: "XeomX" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@xeomxai" },
      { name: "twitter:creator", content: "@xeomxai" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: desc },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      ...LOCALES.map((loc) => ({
        rel: "alternate",
        hrefLang: loc,
        href: `${SITE_URL}/${loc}/`,
      })),
      { rel: "alternate", hrefLang: "x-default", href: `${SITE_URL}/en/` },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "XeomX",
          url: SITE_URL,
          logo: `${SITE_URL}/favicon.ico`,
          sameAs: ["https://twitter.com/xeomxai"],
        }),
      },
    ],
  };
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  let locale = "en";
  try {
    locale = getLocale();
  } catch {
    locale = "en";
  }
  const dir = locale === "fa" || locale === "ar" ? "rtl" : "ltr";
  return (
    <html lang={locale} dir={dir}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  // Global auth listener: keeps router + query cache in sync across tabs.
  // Supabase persists sessions to localStorage; storage events propagate
  // sign-in/out to every open tab, and this listener fires there too.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster richColors closeButton position="top-right" />
    </QueryClientProvider>
  );
}
