import { createHash } from "node:crypto";
import { env as cloudflareEnv } from "cloudflare:workers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { VerticalSliceError, safeVerticalSliceError } from "@/lib/backend/vertical-slice";
import type { ResearchSource, ResearchSubmission } from "@/lib/research/research";

type BrowserRunBinding = {
  quickAction: (action: string, options: Record<string, unknown>) => Promise<Response>;
};

type RuntimeEnv = { BROWSER?: BrowserRunBinding };
type BrowserResponse = { success?: boolean; result?: unknown };
type ExtractedSource = Omit<ResearchSource, "id">;

const MAX_SOURCES = 3;
const MAX_CANDIDATES = 8;
const BATCH_SIZE = 4;
const SEARCH_TIMEOUT_MS = 10_000;
const SOURCE_TIMEOUT_MS = 8_000;
const MAX_EXCERPT_CHARS = 4_500;
const SEARCH_HOSTS = new Set([
  "duckduckgo.com",
  "lite.duckduckgo.com",
  "html.duckduckgo.com",
  "google.com",
  "www.google.com",
  "bing.com",
  "www.bing.com",
]);

function db(client: unknown): SupabaseClient {
  return client as SupabaseClient;
}

function browser(): BrowserRunBinding {
  const binding = (cloudflareEnv as unknown as RuntimeEnv).BROWSER;
  if (!binding) {
    throw new VerticalSliceError("PROVIDER_UNAVAILABLE", {
      message: "Web research is temporarily unavailable.",
      retryable: true,
    });
  }
  return binding;
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map(Number);
  if (
    parts.length !== 4 ||
    parts.some((value) => !Number.isInteger(value) || value < 0 || value > 255)
  ) {
    return false;
  }
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

function safeExternalUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    if (url.protocol !== "https:") return null;
    if (url.port && url.port !== "443") return null;
    if (!hostname || hostname === "localhost" || hostname.endsWith(".local")) return null;
    if (hostname.startsWith("[") || hostname.includes(":")) return null;
    if (isPrivateIpv4(hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

function isSearchHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return SEARCH_HOSTS.has(host) || host.endsWith(".duckduckgo.com");
}

function decodedVariants(value: string): string[] {
  const values = [value];
  let current = value;
  for (let index = 0; index < 3; index += 1) {
    try {
      const decoded = decodeURIComponent(current);
      if (decoded === current) break;
      values.push(decoded);
      current = decoded;
    } catch {
      break;
    }
  }
  return values;
}

function externalFromSearchRedirect(url: URL): string | null {
  const preferredKeys = ["uddg", "url", "target", "dest", "destination", "u", "q"];
  const values: string[] = [];

  for (const key of preferredKeys) {
    const value = url.searchParams.get(key);
    if (value) values.push(value);
  }
  for (const value of url.searchParams.values()) {
    if (!values.includes(value)) values.push(value);
  }

  for (const value of values) {
    for (const candidate of decodedVariants(value)) {
      const external = safeExternalUrl(candidate);
      if (external && !isSearchHost(external.hostname)) return external.toString();
    }
  }

  for (const expanded of decodedVariants(url.toString())) {
    const embedded = expanded.match(/https:\/\/[^\s&"'<>]+/g) ?? [];
    for (const candidate of embedded) {
      const external = safeExternalUrl(candidate);
      if (external && !isSearchHost(external.hostname)) return external.toString();
    }
  }

  return null;
}

function unwrapSearchLink(value: string, base: string): string | null {
  try {
    const url = new URL(value, base);
    if (!isSearchHost(url.hostname)) return url.toString();
    return externalFromSearchRedirect(url);
  } catch {
    return null;
  }
}

function normalizeSearchLinks(values: unknown, base: string): URL[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const output: URL[] = [];

  for (const raw of values) {
    if (typeof raw !== "string") continue;
    const unwrapped = unwrapSearchLink(raw, base);
    if (!unwrapped) continue;
    const url = safeExternalUrl(unwrapped);
    if (!url || isSearchHost(url.hostname)) continue;
    url.hash = "";
    const normalized = url.toString();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(url);
    if (output.length >= MAX_CANDIDATES) break;
  }
  return output;
}

function markdownLinks(markdown: string): string[] {
  const links: string[] = [];
  const pattern = /\]\(<?((?:https?:)?\/\/[^)\s>]+)>?(?:\s+["'][^"']*["'])?\)/g;
  for (const match of markdown.matchAll(pattern)) {
    if (match[1]) links.push(match[1]);
    if (links.length >= 40) break;
  }
  return links;
}

function cleanMarkdown(value: string): string {
  return value
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function titleFor(markdown: string, url: URL): string {
  return (markdown.match(/^#{1,2}\s+(.+)$/m)?.[1]?.trim() || url.hostname).slice(0, 300);
}

async function quickAction(
  action: string,
  options: Record<string, unknown>,
): Promise<BrowserResponse> {
  const response = await browser().quickAction(action, options);
  const body = (await response.json().catch(() => null)) as BrowserResponse | null;
  if (!response.ok || body?.success === false || !body) {
    throw new VerticalSliceError("PROVIDER_UNAVAILABLE", {
      message: "Web research could not retrieve sources.",
      retryable: true,
    });
  }
  return body;
}

function searchOptions(url: string) {
  return {
    url,
    visibleLinksOnly: false,
    rejectResourceTypes: ["image", "media", "font"],
    gotoOptions: { waitUntil: "domcontentloaded", timeout: SEARCH_TIMEOUT_MS },
  };
}

function sourceOptions(url: string) {
  return {
    url,
    rejectResourceTypes: ["image", "media", "font"],
    gotoOptions: { waitUntil: "domcontentloaded", timeout: SOURCE_TIMEOUT_MS },
  };
}

async function discoverUrls(question: string): Promise<URL[]> {
  const searchUrls = [
    `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(question)}`,
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(question)}`,
  ];

  for (const searchUrl of searchUrls) {
    try {
      const linksBody = await quickAction("links", searchOptions(searchUrl));
      const direct = normalizeSearchLinks(linksBody.result, searchUrl);
      if (direct.length) return direct;

      const markdownBody = await quickAction("markdown", {
        url: searchUrl,
        rejectResourceTypes: ["image", "media", "font"],
        gotoOptions: { waitUntil: "domcontentloaded", timeout: SEARCH_TIMEOUT_MS },
      });
      if (typeof markdownBody.result === "string") {
        const fromMarkdown = normalizeSearchLinks(markdownLinks(markdownBody.result), searchUrl);
        if (fromMarkdown.length) return fromMarkdown;
      }
    } catch {
      // Try the next zero-cost DuckDuckGo HTML surface.
    }
  }

  return [];
}

async function sourceMarkdown(url: URL): Promise<string | null> {
  try {
    const direct = await quickAction("markdown", sourceOptions(url.toString()));
    if (typeof direct.result === "string") {
      const markdown = cleanMarkdown(direct.result);
      if (markdown.length >= 120) return markdown;
    }
  } catch {
    // Fall through to rendered HTML extraction.
  }

  try {
    const content = await quickAction("content", sourceOptions(url.toString()));
    if (typeof content.result !== "string" || content.result.length < 120) return null;

    const converted = await quickAction("markdown", { html: content.result });
    if (typeof converted.result !== "string") return null;
    const markdown = cleanMarkdown(converted.result);
    return markdown.length >= 120 ? markdown : null;
  } catch {
    return null;
  }
}

async function extractSource(url: URL): Promise<ExtractedSource | null> {
  const markdown = await sourceMarkdown(url);
  if (!markdown) return null;
  return {
    title: titleFor(markdown, url),
    url: url.toString(),
    domain: url.hostname.toLowerCase().slice(0, 253),
    excerpt: markdown.slice(0, MAX_EXCERPT_CHARS),
  };
}

function uniqueDomains(urls: readonly URL[]): URL[] {
  const seen = new Set<string>();
  return urls.filter((url) => {
    const domain = url.hostname.toLowerCase();
    if (seen.has(domain)) return false;
    seen.add(domain);
    return true;
  });
}

async function collectSources(question: string): Promise<ResearchSource[]> {
  const candidates = uniqueDomains(await discoverUrls(question)).slice(0, MAX_CANDIDATES);
  if (!candidates.length) {
    throw new VerticalSliceError("PROVIDER_UNAVAILABLE", {
      message: "No usable external search result URLs were found for this research request.",
      retryable: true,
    });
  }

  const sources: ResearchSource[] = [];
  for (
    let index = 0;
    index < candidates.length && sources.length < MAX_SOURCES;
    index += BATCH_SIZE
  ) {
    const batch = candidates.slice(index, index + BATCH_SIZE);
    const extracted = await Promise.all(batch.map(extractSource));
    for (const source of extracted) {
      if (!source || sources.length >= MAX_SOURCES) continue;
      sources.push({ id: sources.length + 1, ...source });
    }
  }

  if (!sources.length) {
    throw new VerticalSliceError("PROVIDER_UNAVAILABLE", {
      message: "Search results were found, but no usable source pages could be extracted.",
      retryable: true,
    });
  }
  return sources;
}

function requestHash(input: {
  actorId: string;
  projectId: string;
  conversationId?: string;
  question: string;
  sources: readonly ResearchSource[];
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        actorId: input.actorId,
        projectId: input.projectId,
        conversationId: input.conversationId ?? null,
        question: input.question,
        sources: input.sources.map((source) => ({ url: source.url, excerpt: source.excerpt })),
      }),
    )
    .digest("hex");
}

export async function submitWebResearchV2(
  client: unknown,
  input: {
    actorId: string;
    projectId: string;
    conversationId?: string;
    question: string;
    idempotencyKey: string;
  },
): Promise<ResearchSubmission> {
  const clientDb = db(client);
  const project = await clientDb
    .from("projects")
    .select("id")
    .eq("id", input.projectId)
    .maybeSingle();
  if (project.error) throw safeVerticalSliceError(project.error);
  if (!project.data) throw new VerticalSliceError("PROJECT_NOT_FOUND");

  const sources = await collectSources(input.question);
  const response = await clientDb.rpc("xeomx_submit_research_job", {
    p_project_id: input.projectId,
    p_conversation_id: input.conversationId ?? null,
    p_question: input.question,
    p_sources: sources,
    p_idempotency_key: input.idempotencyKey,
    p_request_hash: requestHash({ ...input, sources }),
  });
  if (response.error) throw safeVerticalSliceError(response.error);

  const rows = response.data as Array<{
    job_id: string;
    conversation_id: string;
    created: boolean;
    status: ResearchSubmission["status"];
  }> | null;
  const row = rows?.[0];
  if (!row) throw new VerticalSliceError("DATABASE_FAILED", { retryable: true });

  return {
    jobId: row.job_id,
    conversationId: row.conversation_id,
    created: row.created,
    status: row.status,
    sources,
  };
}
