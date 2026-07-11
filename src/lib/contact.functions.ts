import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createHash } from "crypto";

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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ContactInput = {
  name: string;
  email: string;
  subject: string;
  message: string;
  category: ContactCategory;
  website?: string; // honeypot
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

  if (!name) throw new Error("Name is required");
  if (!EMAIL_RE.test(email)) throw new Error("Valid email is required");
  if (subject.length < 3) throw new Error("Subject is too short");
  if (message.length < 10) throw new Error("Message is too short");
  if (!CONTACT_CATEGORIES.includes(category)) throw new Error("Invalid category");

  return { name, email, subject, message, category, website };
}

export const submitContact = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => validate(data))
  .handler(async ({ data }) => {
    // Honeypot: silently succeed so bots don't retry.
    if (data.website && data.website.trim() !== "") {
      return { ok: true as const };
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
    const { error } = await supabaseAdmin.from("contact_messages").insert({
      name: data.name,
      email: data.email,
      subject: data.subject,
      message: data.message,
      category: data.category,
      routed_to,
      ip_hash: ipHash,
      user_agent: userAgent,
    });
    if (error) {
      console.error("[contact] insert failed", error);
      throw new Error("Failed to submit. Please try again.");
    }

    return { ok: true as const };
  });