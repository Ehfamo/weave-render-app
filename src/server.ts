import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { paraglideMiddleware } from "./paraglide/server.js";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

type RuntimeEnv = Record<string, string | undefined>;

function buildCspReportOnly(env: RuntimeEnv) {
  const supabaseOrigin = env.SUPABASE_URL?.replace(/\/$/, "");
  const supabaseWsOrigin = supabaseOrigin?.replace(/^https:/, "wss:").replace(/^http:/, "ws:");
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    `script-src 'self' 'unsafe-inline' https:`,
    `style-src 'self' 'unsafe-inline' https:`,
    `img-src 'self' data: blob: https:`,
    `font-src 'self' data: https:`,
    ["connect-src 'self' https: wss:", supabaseOrigin, supabaseWsOrigin]
      .filter(Boolean)
      .join(" "),
    `media-src 'self' https: blob:`,
    `worker-src 'self' blob:`,
    `manifest-src 'self'`,
    "upgrade-insecure-requests",
  ].join("; ");
}

function applySecurityHeaders(response: Response, request: Request, env: RuntimeEnv): Response {
  const h = new Headers(response.headers);
  h.delete("x-powered-by");
  h.delete("server");

  if (!h.has("strict-transport-security")) {
    h.set("strict-transport-security", "max-age=63072000; includeSubDomains; preload");
  }
  if (!h.has("x-content-type-options")) h.set("x-content-type-options", "nosniff");
  if (!h.has("x-frame-options")) h.set("x-frame-options", "DENY");
  if (!h.has("referrer-policy")) h.set("referrer-policy", "strict-origin-when-cross-origin");
  if (!h.has("x-dns-prefetch-control")) h.set("x-dns-prefetch-control", "on");
  if (!h.has("origin-agent-cluster")) h.set("origin-agent-cluster", "?1");
  if (!h.has("cross-origin-opener-policy")) h.set("cross-origin-opener-policy", "same-origin-allow-popups");
  if (!h.has("cross-origin-resource-policy")) h.set("cross-origin-resource-policy", "same-site");
  if (!h.has("permissions-policy")) {
    h.set(
      "permissions-policy",
      [
        "accelerometer=()",
        "autoplay=(self)",
        "camera=()",
        "display-capture=()",
        "encrypted-media=()",
        "fullscreen=(self)",
        "geolocation=()",
        "gyroscope=()",
        "magnetometer=()",
        "microphone=()",
        "midi=()",
        "payment=(self)",
        "picture-in-picture=(self)",
        "publickey-credentials-get=(self)",
        "screen-wake-lock=()",
        "sync-xhr=()",
        "usb=()",
        "xr-spatial-tracking=()",
        "interest-cohort=()",
        "browsing-topics=()",
      ].join(", "),
    );
  }

  const contentType = h.get("content-type") ?? "";
  const isHtml = contentType.includes("text/html");
  if (isHtml && !h.has("content-security-policy-report-only") && !h.has("content-security-policy")) {
    h.set("content-security-policy-report-only", buildCspReportOnly(env));
  }

  if (isHtml && !h.has("cache-control")) {
    h.set("cache-control", "private, no-store");
  }

  if (!isHtml && !h.has("cache-control")) {
    const p = new URL(request.url).pathname;
    const isImmutable =
      p.startsWith("/__l5e/") ||
      p.startsWith("/assets/") ||
      /\.(?:js|css|woff2?|ttf|otf|eot|webp|avif|jpe?g|png|gif|svg|ico|mp4|webm|wasm)$/i.test(p);
    if (isImmutable) {
      h.set("cache-control", "public, max-age=31536000, immutable");
    }
  }

  void request;
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: h,
  });
}

export default {
  async fetch(request: Request, env: RuntimeEnv, ctx: unknown) {
    const proto = request.headers.get("x-forwarded-proto");
    const url = new URL(request.url);
    if (
      proto === "http" ||
      (url.protocol === "http:" && url.hostname !== "localhost" && !url.hostname.endsWith(".local"))
    ) {
      const httpsUrl = new URL(request.url);
      httpsUrl.protocol = "https:";
      return new Response(null, {
        status: 308,
        headers: {
          location: httpsUrl.toString(),
          "strict-transport-security": "max-age=63072000; includeSubDomains; preload",
        },
      });
    }
    try {
      const handler = await getServerEntry();
      const assetUrl = new URL(request.url);
      const localeAsset = assetUrl.pathname.match(/^\/(en|fa|ar|zh|hi)(\/(?:__l5e|assets)\/.*)$/);
      if (localeAsset) {
        assetUrl.pathname = localeAsset[2];
        return Response.redirect(assetUrl.toString(), 301);
      }
      const response = await paraglideMiddleware(request, async () => {
        return handler.fetch(request, env, ctx);
      });
      const normalized = await normalizeCatastrophicSsrResponse(response);
      return applySecurityHeaders(normalized, request, env);
    } catch (error) {
      console.error(error);
      return applySecurityHeaders(
        new Response(renderErrorPage(), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
        request,
        env,
      );
    }
  },
};
