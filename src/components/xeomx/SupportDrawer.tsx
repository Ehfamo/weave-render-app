import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, Paperclip, X } from "lucide-react";
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
import { useServerFn } from "@tanstack/react-start";
import { submitContact, CONTACT_CATEGORIES, type ContactCategory } from "@/lib/contact.functions";
import { useAuth } from "@/hooks/use-auth";

type Props = { open: boolean; onOpenChange: (v: boolean) => void; initialCategory?: ContactCategory };

const CATEGORY_LABELS: Record<ContactCategory, string> = {
  general: "General",
  support: "Technical Support",
  billing: "Billing & Payments",
  partnerships: "Partnerships",
  press: "Press & Media",
  careers: "Careers",
};

// Public-facing address only. Internal routing lives server-side.
const PUBLIC_FALLBACK_EMAIL = "hello@xeomx.com";

export function SupportDrawer({ open, onOpenChange, initialCategory = "general" }: Props) {
  const { user } = useAuth();
  const submit = useServerFn(submitContact);
  const [category, setCategory] = useState<ContactCategory>(initialCategory);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [attachmentName, setAttachmentName] = useState<string>("");
  const [website, setWebsite] = useState(""); // honeypot
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (open) {
      setCategory(initialCategory);
      setError(null);
      setDone(false);
      if (user?.email && !email) setEmail(user.email);
      const meta = user?.user_metadata as { full_name?: string; name?: string } | undefined;
      if (meta && !name) setName(meta.full_name || meta.name || "");
    }
  }, [open, initialCategory, user, email, name]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      await submit({ data: { name, email, subject, message, category, website } });
      setDone(true);
      setName("");
      setSubject("");
      setMessage("");
      setAttachmentName("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      // Graceful mailto fallback if the backend refuses (misconfigured / offline).
      const isNetwork = /fetch|network|failed to/i.test(msg);
      if (isNetwork) {
        const body = `Name: ${name}\nEmail: ${email}\nCategory: ${CATEGORY_LABELS[category]}\n\n${message}`;
        window.location.href = `mailto:${PUBLIC_FALLBACK_EMAIL}?subject=${encodeURIComponent(
          `[${CATEGORY_LABELS[category]}] ${subject}`,
        )}&body=${encodeURIComponent(body)}`;
        setError("Opened your email app as a fallback.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md flex flex-col gap-0 overflow-y-auto border-border bg-background rtl:[&]:!inset-y-0 rtl:[&]:!left-0 rtl:[&]:!right-auto rtl:[&]:border-l rtl:[&]:border-r-0"
      >
        <SheetHeader className="text-start">
          <SheetTitle>Contact XeomX</SheetTitle>
          <SheetDescription>
            Tell us what you need and we'll connect you with the right team.
          </SheetDescription>
        </SheetHeader>

        {done ? (
          <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-6 text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-300" />
            <p className="text-sm text-emerald-100">
              Message received. Our team will get back to you shortly.
            </p>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="mt-2 rounded-full border border-border px-4 py-2 text-xs text-foreground transition hover:bg-surface"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4" noValidate>
            <fieldset className="flex flex-col gap-2">
              <legend className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
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
              />
              <span className="text-[10px] text-muted-foreground">{message.length}/5000</span>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="contact-attachment"
                className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border/60 bg-surface/40 px-3 py-2 text-xs text-muted-foreground transition hover:border-border hover:text-foreground"
              >
                <Paperclip className="h-3.5 w-3.5" />
                {attachmentName || "Attach a file (optional)"}
                {attachmentName && (
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label="Remove attachment"
                    onClick={(e) => {
                      e.preventDefault();
                      setAttachmentName("");
                    }}
                    className="ms-auto inline-flex h-5 w-5 items-center justify-center rounded-full border border-border/60 text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </span>
                )}
              </Label>
              <input
                id="contact-attachment"
                type="file"
                className="sr-only"
                accept="image/*,application/pdf,.txt,.log"
                onChange={(e) => setAttachmentName(e.target.files?.[0]?.name ?? "")}
              />
              {attachmentName && (
                <p className="text-[10px] text-muted-foreground">
                  We'll follow up by email for large attachments.
                </p>
              )}
            </div>

            {/* Honeypot */}
            <div aria-hidden className="pointer-events-none absolute -left-[10000px] h-0 w-0 overflow-hidden">
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

            <button
              type="submit"
              disabled={loading}
              className="mt-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-70"
              style={{ background: "var(--gradient-magenta)", boxShadow: "var(--shadow-glow)" }}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send message"}
            </button>

            <p className="text-center text-[10px] text-muted-foreground">
              By submitting, you agree to our Privacy Policy.
            </p>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
