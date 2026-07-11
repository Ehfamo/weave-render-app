import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, CheckCircle2, Paperclip, X, Clock, MailCheck, ShieldCheck, Copy, ExternalLink } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  submitContact,
  createSupportUpload,
  CONTACT_CATEGORIES,
  SLA_HOURS,
  TEAM_LABEL,
  type ContactCategory,
} from "@/lib/contact.functions";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

type Props = { open: boolean; onOpenChange: (v: boolean) => void; initialCategory?: ContactCategory };

const CATEGORY_LABELS: Record<ContactCategory, string> = {
  general: "General",
  support: "Technical Support",
  billing: "Billing & Payments",
  partnerships: "Partnerships",
  press: "Press & Media",
  careers: "Careers",
};

// Public display addresses. Server enforces routing; these are for UX only.
const CATEGORY_PUBLIC_EMAIL: Record<ContactCategory, string> = {
  general: "hello@xeomx.com",
  support: "support@xeomx.com",
  billing: "billing@xeomx.com",
  partnerships: "info@xeomx.com",
  press: "press@xeomx.com",
  careers: "careers@xeomx.com",
};

const PLACEHOLDER_BY_CATEGORY: Record<ContactCategory, string> = {
  general: "How can we help?",
  support: "Describe the issue, steps to reproduce, and what you expected…",
  billing: "Include your order ID, invoice number, or last four digits of the card.",
  partnerships: "Tell us about your company and the opportunity you have in mind.",
  press: "Share the outlet, deadline, and questions or angle you're exploring.",
  careers: "Which role are you interested in? Paste a portfolio or CV link.",
};

const FAQ_SHORTCUTS: Array<{ label: string; to?: string; href?: string }> = [
  { label: "Forgot Password", to: "/forgot-password" },
  { label: "Refund Policy", to: "/refund-policy" },
  { label: "Privacy Policy", to: "/privacy" },
  { label: "Terms", to: "/terms" },
  { label: "Cookies", to: "/cookies" },
  { label: "Pricing", to: "/pricing" },
];

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXT = ["png","jpg","jpeg","gif","webp","heic","pdf","txt","log","csv","json","md","zip"];

function validateFile(file: File): string | null {
  if (file.size <= 0) return "File is empty";
  if (file.size > MAX_ATTACHMENT_BYTES) return "Attachment exceeds 10 MB limit";
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXT.includes(ext)) return `.${ext || "?"} files are not allowed`;
  return null;
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function SupportDrawer({ open, onOpenChange, initialCategory = "general" }: Props) {
  const { user } = useAuth();
  const submit = useServerFn(submitContact);
  const createUpload = useServerFn(createSupportUpload);

  const [category, setCategory] = useState<ContactCategory>(initialCategory);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot

  const [file, setFile] = useState<File | null>(null);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [fileError, setFileError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ ticket: string; team: string; sla: string } | null>(null);
  const submittedOnce = useRef(false);

  useEffect(() => {
    if (open) {
      setCategory(initialCategory);
      setError(null);
      setResult(null);
      submittedOnce.current = false;
      if (user?.email && !email) setEmail(user.email);
      const meta = user?.user_metadata as { full_name?: string; name?: string } | undefined;
      if (meta && !name) setName(meta.full_name || meta.name || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialCategory, user]);

  const destinationEmail = CATEGORY_PUBLIC_EMAIL[category];
  const sla = SLA_HOURS[category];
  const team = TEAM_LABEL[category];

  const canSubmit = useMemo(
    () =>
      !loading &&
      !uploading &&
      name.trim().length > 0 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
      subject.trim().length >= 3 &&
      message.trim().length >= 10,
    [loading, uploading, name, email, subject, message],
  );

  const handleFileSelect = async (f: File | null) => {
    setFileError(null);
    setUploadedPath(null);
    setUploadPct(0);
    if (!f) {
      setFile(null);
      return;
    }
    const err = validateFile(f);
    if (err) {
      setFileError(err);
      setFile(null);
      return;
    }
    setFile(f);
    setUploading(true);
    try {
      const { path, token, bucket } = await createUpload({
        data: { filename: f.name, size: f.size },
      });
      // uploadToSignedUrl doesn't expose progress; approximate for UX.
      setUploadPct(30);
      const { error: upErr } = await supabase.storage
        .from(bucket)
        .uploadToSignedUrl(path, token, f, { upsert: false, contentType: f.type || "application/octet-stream" });
      if (upErr) throw upErr;
      setUploadPct(100);
      setUploadedPath(path);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      setFileError(msg);
      setFile(null);
      setUploadedPath(null);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || submittedOnce.current) return;
    submittedOnce.current = true;
    setLoading(true);
    setError(null);
    try {
      const res = await submit({
        data: {
          name,
          email,
          subject,
          message,
          category,
          website,
          attachmentPath: uploadedPath ?? undefined,
          attachmentName: file?.name,
          attachmentSize: file?.size,
        },
      });
      setResult({ ticket: res.ticket, team: res.team, sla: res.sla });
      setSubject("");
      setMessage("");
      setFile(null);
      setUploadedPath(null);
      setUploadPct(0);
      toast.success(`Message received · ${res.ticket}`);
    } catch (err) {
      submittedOnce.current = false;
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const copyTicket = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.ticket);
      toast.success("Ticket ID copied");
    } catch {
      /* ignore */
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 border-border bg-background p-0 sm:max-w-md rtl:[&]:!inset-y-0 rtl:[&]:!left-0 rtl:[&]:!right-auto rtl:[&]:border-l rtl:[&]:border-r-0"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <SheetHeader className="border-b border-border/60 px-5 py-4 text-start">
          <SheetTitle>Contact XeomX</SheetTitle>
          <SheetDescription>
            Pick a category and we'll route your message to the right team.
          </SheetDescription>
        </SheetHeader>

        {result ? (
          <div className="flex-1 overflow-y-auto px-5 py-6">
            <div
              role="status"
              aria-live="polite"
              className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-6 text-center"
            >
              <CheckCircle2 className="h-8 w-8 text-emerald-300" aria-hidden />
              <p className="text-base font-semibold text-foreground">Message received</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Reference</span>
                <button
                  type="button"
                  onClick={copyTicket}
                  className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-surface px-2 py-1 font-mono text-foreground hover:bg-surface/70"
                  aria-label={`Copy ticket ${result.ticket}`}
                >
                  {result.ticket}
                  <Copy className="h-3 w-3" aria-hidden />
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Routed to <span className="text-foreground">{result.team}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Expected reply: <span className="text-foreground">{result.sla}</span>
              </p>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="mt-3 rounded-full border border-border px-4 py-2 text-xs text-foreground transition hover:bg-surface"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 pb-4 pt-4">
              {/* FAQ shortcuts */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Quick answers
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {FAQ_SHORTCUTS.map((s) =>
                    s.to ? (
                      <Link
                        key={s.label}
                        to={s.to}
                        onClick={() => onOpenChange(false)}
                        className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-surface/40 px-2.5 py-1 text-[11px] text-muted-foreground transition hover:border-border hover:text-foreground"
                      >
                        {s.label}
                      </Link>
                    ) : (
                      <a
                        key={s.label}
                        href={s.href}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-surface/40 px-2.5 py-1 text-[11px] text-muted-foreground transition hover:border-border hover:text-foreground"
                      >
                        {s.label} <ExternalLink className="h-3 w-3" aria-hidden />
                      </a>
                    ),
                  )}
                </div>
              </div>

              <form
                id="support-form"
                onSubmit={handleSubmit}
                className="mt-5 flex flex-col gap-4"
                noValidate
              >
                <fieldset className="flex flex-col gap-2">
                  <legend className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Category
                  </legend>
                  <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Category">
                    {CONTACT_CATEGORIES.map((c) => {
                      const active = category === c;
                      return (
                        <button
                          key={c}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => setCategory(c)}
                          className={`min-h-11 rounded-lg border px-3 py-2 text-start text-xs transition ${
                            active
                              ? "border-magenta/60 bg-surface text-foreground"
                              : "border-border/60 bg-surface/40 text-muted-foreground hover:border-border hover:text-foreground"
                          }`}
                        >
                          {CATEGORY_LABELS[c]}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                {/* Routing preview */}
                <div
                  aria-live="polite"
                  className="rounded-xl border border-border/60 bg-surface/40 p-3 text-xs"
                >
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MailCheck className="h-3.5 w-3.5" aria-hidden />
                    <span>Your message will be sent to</span>
                  </div>
                  <div className="mt-1 font-mono text-sm text-foreground">{destinationEmail}</div>
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" aria-hidden />
                    Typical response: <span className="text-foreground">{sla}</span>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="contact-name">Name</Label>
                    <Input
                      id="contact-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      maxLength={120}
                      autoComplete="name"
                      aria-required="true"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="contact-email">Email</Label>
                    <Input
                      id="contact-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      maxLength={255}
                      autoComplete="email"
                      inputMode="email"
                      aria-required="true"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="contact-subject">Subject</Label>
                  <Input
                    id="contact-subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                    minLength={3}
                    maxLength={200}
                    aria-required="true"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="contact-message">Message</Label>
                  <Textarea
                    id="contact-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                    minLength={10}
                    maxLength={5000}
                    rows={6}
                    placeholder={PLACEHOLDER_BY_CATEGORY[category]}
                    aria-required="true"
                    aria-describedby="contact-message-hint"
                  />
                  <span id="contact-message-hint" className="text-[10px] text-muted-foreground">
                    {message.length}/5000
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="contact-attachment"
                    className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border/60 bg-surface/40 px-3 py-2 text-xs text-muted-foreground transition hover:border-border hover:text-foreground"
                  >
                    <Paperclip className="h-3.5 w-3.5" aria-hidden />
                    {file ? `${file.name} · ${formatBytes(file.size)}` : "Attach a file (optional, ≤ 10 MB)"}
                    {file && (
                      <button
                        type="button"
                        aria-label="Remove attachment"
                        onClick={(e) => {
                          e.preventDefault();
                          void handleFileSelect(null);
                        }}
                        className="ms-auto inline-flex h-5 w-5 items-center justify-center rounded-full border border-border/60 text-foreground"
                      >
                        <X className="h-3 w-3" aria-hidden />
                      </button>
                    )}
                  </Label>
                  <input
                    id="contact-attachment"
                    type="file"
                    className="sr-only"
                    accept=".png,.jpg,.jpeg,.gif,.webp,.heic,.pdf,.txt,.log,.csv,.json,.md,.zip,image/*,application/pdf"
                    onChange={(e) => void handleFileSelect(e.target.files?.[0] ?? null)}
                  />
                  {uploading && (
                    <div
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={uploadPct}
                      aria-label="Uploading attachment"
                      className="h-1 w-full overflow-hidden rounded-full bg-surface"
                    >
                      <div
                        className="h-full bg-foreground/70 transition-[width] duration-300"
                        style={{ width: `${uploadPct}%` }}
                      />
                    </div>
                  )}
                  {fileError && (
                    <p role="alert" className="text-[11px] text-destructive">
                      {fileError}
                    </p>
                  )}
                </div>

                {/* Honeypot */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute -left-[10000px] h-0 w-0 overflow-hidden"
                >
                  <label>
                    Website
                    <input
                      tabIndex={-1}
                      autoComplete="off"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                    />
                  </label>
                </div>

                {error && (
                  <p role="alert" className="text-xs text-destructive">
                    {error}
                  </p>
                )}

                <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <ShieldCheck className="h-3 w-3" aria-hidden />
                  We only use your message to reply — never for marketing.
                </p>
              </form>
            </div>

            {/* Sticky submit bar */}
            <div
              className="sticky bottom-0 border-t border-border/60 bg-background/95 px-5 py-3 backdrop-blur"
              style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 0.75rem)" }}
            >
              <button
                type="submit"
                form="support-form"
                disabled={!canSubmit}
                aria-busy={loading || uploading}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                style={{ background: "var(--gradient-magenta)", boxShadow: "var(--shadow-glow)" }}
              >
                {loading || uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    {uploading ? "Uploading…" : "Sending…"}
                  </>
                ) : (
                  "Send to " + team
                )}
              </button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}