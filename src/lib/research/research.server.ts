import { createHash } from "node:crypto";
import { env as cloudflareEnv } from "cloudflare:workers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { VerticalSliceError, safeVerticalSliceError } from "@/lib/backend/vertical-slice";
import type {
  ResearchSource,
  ResearchSourcesByJob,
  ResearchSubmission,
} from "@/lib/research/research";

type BrowserRunBinding = {
  quickAction: (action: string, options: Record<string, unknown>) => Promise<Response>;
};

type CloudflareRuntimeEnv = {
  BROWSER?: BrowserRunBinding;
};

type BrowserResponse = {
  success?: boolean;
  result?: unknown;
};

const MAX_SOURCES = 3;
const MAX_SOURCE_CANDIDATES = 10;
const MAX_EXCERPT_CHARS = 4_500;
const SEARCH_HOSTS = new Set([
  "duckduckgo.com",
  "html.duckduckgo.com",
  "www.google.com",
  "google.com",
  "www.bing.com",
  "bing.com",
]);

function db(client: unknown): SupabaseClient {
  return client as SupabaseClient;
}

function browserBinding(): BrowserRunBinding {
  const browser = (cloudflareEnv as unknown as CloudflareRuntimeEnv).BROWSER;
  if (!browser) {
    throw new VerticalSliceError("PROVIDER_UNAVAILABLE", {
      message: "Web research is temporarily unavailable.",
      retryable: true,
    });
  }
  return browser;
}

function isPrivateIpv4(hostname: string): boolean {
  const octets = hostname.split(".").map((part) => Number(part));
  if (
    octets.length !== 4 ||
    octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)
  ) {
    return false;
  }
  const [a, b] = octets;
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
    if (!hostname || hostname === "localhost" || hostname.endsWith(".local")) return null;
    if (hostname === "::1" || hostname.startsWith("[")) return null;
    if (isPrivateIpv4(hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

function unwrapSearchRedirect(value: string, base: string): string | null {
  try {
    const url = new URL(value, base);
    const host = url.hostname.toLowerCase();
    if (host === "duckduckgo.com" || host.endsWith(".duckduckgo.com")) {
      const target = url.searchParams.get("uddg");
      if (target) return decodeURIComponent(target);
    }
    if (host === "www.google.com" || host === "google.com") {
      const target = url.searchParams.get("q") ?? url.searchParams.get("url");
      if (target) return target;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeSearchLinks(values: unknown, base: string): URL[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const results: URL[] = [];

  for (const raw of values) {
    if (typeof raw !== "string") continue;
    const unwrapped = unwrapSearchRedirect(raw, base);
    if (!unwrapped) continue;
    const url = safeExternalUrl(unwrapped);
    if (!url) continue;
    const hostname = url.hostname.toLowerCase();
    if (SEARCH_HOSTS.has(hostname) || hostname.endsWith(".duckduckgo.com")) continue;
    url.hash = "";
    const normalized = url.toString();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    results.push(url);
    if (results.length >= MAX_SOURCE_CANDIDATES) break;
  }

  return results;
}

function cleanMarkdown(value: string): string {
  return value
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function sourceTitle(markdown: string, url: URL): string {
  const heading = markdown.match(/^#{1,2}\s+(.+)$/m)?.[1]?.trim();
  return (heading || url.hostname).slice(0, 300);
}

async function quickAction(
  action: string,
  options: Record<string, unknown>,
): Promise<BrowserResponse> {
  const response = await browserBinding().quickAction(action, options);
  const body = (await response.json().catch(() => null)) as BrowserResponse | null;
  if (!response.ok || body?.success === false || !body) {
    throw new VerticalSliceError("PROVIDER_UNAVAILABLE", {
      message: "Web research could not retrieve sources.",
      retryable: true,
    });
  }
  return body;
}

async function discoverSourceUrls(question: string): Promise<URL[]> {
  const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(question)}`;
  const body = await quickAction("links", {
    url: searchUrl,
    visibleLinksOnly: true,
    gotoOptions: { waitUntil: "domcontentloaded", timeout: 12_000 },
  });
  return normalizeSearchLinks(body.result, searchUrl);
}

async function extractSource(url: URL, id: number): Promise<ResearchSource | null> {
  try {
    const body = await quickAction("markdown", {
      url: url.toString(),
      gotoOptions: { waitUntil: "domcontentloaded", timeout: 12_000 },
    });
    if (typeof body.result !== "string") return null;
    const markdown = cleanMarkdown(body.result);
    if (markdown.length < 120) return null;
    return {
      id,
      title: sourceTitle(markdown, url),
      url: url.toString(),
      domain: url.hostname.toLowerCase().slice(0, 253),
      excerpt: markdown.slice(0, MAX_EXCERPT_CHARS),
    };
  } catch {
    return null;
  }
}

async function collectSources(question: string): Promise<ResearchSource[]> {
  const candidates = await discoverSourceUrls(question);
  const sources: ResearchSource[] = [];
  const usedDomains = new Set<string>();

  for (const candidate of candidates) {
    if (sources.length >= MAX_SOURCES) break;
    const domain = candidate.hostname.toLowerCase();
    if (usedDomains.has(domain)) continue;
    const source = await extractSource(candidate, sources.length + 1);
    if (!source) continue;
    sources.push(source);
    usedDomains.add(domain);
  }

  if (!sources.length) {
    throw new VerticalSliceError("PROVIDER_UNAVAILABLE", {
      message: "No usable web sources were found for this research request.",
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
        sources: input.sources.map((source) => ({
          url: source.url,
          excerpt: source.excerpt,
        })),
      }),
    )
    .digest("hex");
}

function parseSources(value: unknown): ResearchSource[] {
  if (!Array.isArray(value)) return [];
  const sources: ResearchSource[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    if (
      typeof record.id !== "number" ||
      typeof record.title !== "string" ||
      typeof record.url !== "string" ||
      typeof record.domain !== "string" ||
      typeof record.excerpt !== "string"
    ) {
      continue;
    }
    sources.push({
      id: record.id,
      title: record.title,
      url: record.url,
      domain: record.domain,
      excerpt: record.excerpt,
    });
  }
  return sources.slice(0, 5);
}

export async function submitWebResearch(
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
  const hash = requestHash({ ...input, sources });
  const response = await clientDb.rpc("xeomx_submit_research_job", {
    p_project_id: input.projectId,
    p_conversation_id: input.conversationId ?? null,
    p_question: input.question,
    p_sources: sources,
    p_idempotency_key: input.idempotencyKey,
    p_request_hash: hash,
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

export async function listProjectResearchSources(
  client: unknown,
  projectId: string,
): Promise<ResearchSourcesByJob> {
  const response = await db(client)
    .from("generation_jobs")
    .select("id,request_metadata")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (response.error) throw safeVerticalSliceError(response.error);

  const result: ResearchSourcesByJob = {};
  for (const row of response.data ?? []) {
    const metadata = row.request_metadata;
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) continue;
    const record = metadata as Record<string, unknown>;
    if (record.mode !== "research-v1") continue;
    const sources = parseSources(record.sources);
    if (sources.length) result[row.id] = sources;
  }
  return result;
}
