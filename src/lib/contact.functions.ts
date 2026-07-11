import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createHash, randomUUID } from "crypto";

export const CONTACT_CATEGORIES = [
  "general",
  "support",
  "billing",
  "partnerships",
  "press",
  "careers",
] as const;

export type ContactCategory = (typeof CONTACT_CATEGORIES)[number];

// Internal-only routing map. NEVER shipped to the client.
const ROUTING: Record<ContactCategory, string> = {
  general: "hello@xeomx.com",
  support: "support@xeomx.com",
  billing: "billing@xeomx.com",
  partnerships: "info@xeomx.com",
  press: "press@xeomx.com",
  careers: "careers@xeomx.com",
};

// Public-facing SLA copy shown in the drawer / contact page.
export const SLA_HOURS: Record<ContactCategory, string> = {
  general: "Within 24 hours",
  support: "Within 12 hours",
  billing: "Within 24 hours",
  partnerships: "Within 3 business days",
  press: "Within 2 business days",
  careers: "Within 5 business days",
};

export const TEAM_LABEL: Record<ContactCategory, string> = {
  general: "General Team",
  support: "Support Team",
  billing: "Billing Team",
  partnerships: "Partnerships Team",
  press: "Press & Media Team",
  careers: "Careers Team",
};

// Attachment limits mirrored on the client.
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_ATTACHMENT_EXT = new Set([
  "png","jpg","jpeg","gif","webp","heic","pdf","txt","log","csv","json","md","zip",
]);
const BLOCKED_ATTACHMENT_EXT = new Set([
  "exe","bat","cmd","sh","ps1","js","jar","msi","dmg","app","scr","vbs","apk","dll",
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ContactInput = {
  name: string;
  email: string;
  subject: string;
  message: string;
  category: ContactCategory;
  website?: string; // honeypot
  attachmentPath?: string;
  attachmentName?: string;
  attachmentSize?: number;
};

function sanitize(v: string, max: number): string {
  // Strip control chars, collapse whitespace, trim, clamp length.
  return v
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function validate(raw: unknown): ContactInput {
  if (!raw || typeof raw !== "object") throw new Error("Invalid payload");
  const r = raw as Record<string, unknown>;
  const name = sanitize(String(r.name ?? ""), 120);
  const email = sanitize(String(r.email ?? ""), 255).toLowerCase();
  const subject = sanitize(String(r.subject ?? ""), 200);
  const message = String(r.message ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, 5000);
  const category = String(r.category ?? "") as ContactCategory;
  const website = typeof r.website === "string" ? r.website : "";
  const attachmentPath = typeof r.attachmentPath === "string" ? r.attachmentPath.slice(0, 500) : "";
  const attachmentName = typeof r.attachmentName === "string" ? sanitize(r.attachmentName, 200) : "";
  const attachmentSize =
    typeof r.attachmentSize === "number" && Number.isFinite(r.attachmentSize)
      ? Math.max(0, Math.floor(r.attachmentSize))
      : 0;

  if (!name) throw new Error("Name is required");
  if (!EMAIL_RE.test(email)) throw new Error("Valid email is required");
  if (subject.length < 3) throw new Error("Subject is too short");
  if (message.length < 10) throw new Error("Message is too short");
  if (!CONTACT_CATEGORIES.includes(category)) throw new Error("Invalid category");
  if (attachmentPath && !/^support\/[a-f0-9-]{36}\/[a-zA-Z0-9._-]+$/.test(attachmentPath)) {
    throw new Error("Invalid attachment reference");
  }
  if (attachmentSize > MAX_ATTACHMENT_BYTES) {
    throw new Error("Attachment exceeds 10 MB limit");
  }

  return {
    name, email, subject, message, category, website,
    attachmentPath: attachmentPath || undefined,
    attachmentName: attachmentName || undefined,
    attachmentSize: attachmentSize || undefined,
  };
}

export const submitContact = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => validate(data))
  .handler(async ({ data }) => {
    // Honeypot: silently succeed so bots don't retry.
    if (data.website && data.website.trim() !== "") {
      return {
        ok: true as const,
        ticket: "XM-000000",
        team: TEAM_LABEL[data.category] ?? "General Team",
        sla: SLA_HOURS[data.category] ?? "Within 24 hours",
      };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const ipRaw =
      getRequestHeader("cf-connecting-ip") ||
      getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ||
      getRequestHeader("x-real-ip") ||
      "unknown";
    const ipHash = createHash("sha256")
      .update(`${ipRaw}:xeomx-contact`)
      .digest("hex");
    const userAgent = (getRequestHeader("user-agent") || "").slice(0, 500);

    // Rate limit: max 5 submissions per IP per 10 minutes.
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from("contact_messages")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", since);
    if ((count ?? 0) >= 5) {
      throw new Error("Too many requests. Please try again later.");
    }

    const routed_to = ROUTING[data.category];
    const { data: inserted, error } = await supabaseAdmin
      .from("contact_messages")
      .insert({
        name: data.name,
        email: data.email,
        subject: data.subject,
        message: data.message,
        category: data.category,
        routed_to,
        ip_hash: ipHash,
        user_agent: userAgent,
        ticket_number: "", // filled by BEFORE INSERT trigger
        attachment_path: data.attachmentPath ?? null,
        attachment_name: data.attachmentName ?? null,
        attachment_size: data.attachmentSize ?? null,
      })
      .select("ticket_number")
      .single();
    if (error || !inserted) {
      console.error("[contact] insert failed", error);
      throw new Error("Failed to submit. Please try again.");
    }

    return {
      ok: true as const,
      ticket: inserted.ticket_number,
      team: TEAM_LABEL[data.category],
      sla: SLA_HOURS[data.category],
    };
  });

// --------------------------------------------------------------
// Signed upload URL for support attachments (private bucket).
// Client uploads directly using the token; server then only
// stores the path reference on the ticket row.
// --------------------------------------------------------------

type UploadInput = { filename: string; size: number };

function validateUpload(raw: unknown): UploadInput {
  if (!raw || typeof raw !== "object") throw new Error("Invalid payload");
  const r = raw as Record<string, unknown>;
  const filename = sanitize(String(r.filename ?? ""), 200).replace(/[^a-zA-Z0-9._-]/g, "_");
  const size = Number(r.size ?? 0);
  if (!filename) throw new Error("Filename required");
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (!ext || BLOCKED_ATTACHMENT_EXT.has(ext) || !ALLOWED_ATTACHMENT_EXT.has(ext)) {
    throw new Error("File type not allowed");
  }
  if (!Number.isFinite(size) || size <= 0) throw new Error("Invalid file size");
  if (size > MAX_ATTACHMENT_BYTES) throw new Error("Attachment exceeds 10 MB limit");
  return { filename, size: Math.floor(size) };
}

export const createSupportUpload = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => validateUpload(d))
  .handler(async ({ data }) => {
    const ipRaw =
      getRequestHeader("cf-connecting-ip") ||
      getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ||
      getRequestHeader("x-real-ip") ||
      "unknown";
    const ipHash = createHash("sha256").update(`${ipRaw}:xeomx-contact`).digest("hex");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Reuse the same window as submit to throttle abuse.
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from("contact_messages")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", since);
    if ((count ?? 0) >= 10) {
      throw new Error("Too many upload requests. Please try again later.");
    }

    const id = randomUUID();
    const path = `support/${id}/${data.filename}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from("support-attachments")
      .createSignedUploadUrl(path);
    if (error || !signed) {
      console.error("[contact] signed upload failed", error);
      throw new Error("Could not prepare upload. Please try again.");
    }
    return { path, token: signed.token, bucket: "support-attachments" as const };
  });