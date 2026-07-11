import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "motion/react";
import { Sparkles, Loader2, Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { friendlyAuthError } from "@/lib/auth-validation";
import { toast } from "sonner";
import { pageUrl } from "@/lib/seo";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPassword,
  head: () => ({
    meta: [
      { title: "Reset your password — XeomX" },
      { name: "description", content: "Request a password reset link for your XeomX account." },
      { property: "og:title", content: "Reset your password — XeomX" },
      { property: "og:type", content: "website" },
      { property: "og:url", content: pageUrl("/forgot-password") },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: pageUrl("/forgot-password") }],
  }),
});

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError(null);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (err) {
      const msg = friendlyAuthError(err.message);
      setError(msg);
      toast.error(msg);
      return;
    }
    // Always show a generic success message to avoid account enumeration.
    setSent(true);
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-60"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 0%, oklch(0.45 0.25 340 / 0.35), transparent 60%)",
        }}
      />
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center" style={{ paddingInline: "var(--space-5)" }}>
        <Link to="/" aria-label="XEOMX — Home" className="flex items-center" style={{ marginBottom: "var(--space-6)" }}>
          <Logo variant="full" size={36} ariaLabel="XEOMX" />
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="surface-elevated w-full rounded-3xl"
          style={{ padding: "var(--space-6)" }}
          role="region"
          aria-labelledby="fp-title"
        >
          <Link to="/auth" search={{}} className="inline-flex items-center gap-1 transition hover:text-foreground" style={{ marginBottom: "var(--space-4)", fontSize: "var(--font-size-caption)", color: "var(--text-muted)" }}>
            <ArrowLeft className="h-3 w-3" /> Back to sign in
          </Link>
          <h1 id="fp-title" className="font-display font-bold tracking-tight text-foreground" style={{ fontSize: "clamp(1.5rem, 4vw, var(--font-size-h1))" }}>
            Forgot your password?
          </h1>
          <p style={{ marginTop: "var(--space-2)", fontSize: "var(--font-size-caption)", color: "var(--text-muted)" }}>
            Enter the email tied to your account and we'll send you a secure reset link.
          </p>

          {sent ? (
            <div className="flex flex-col items-start" style={{ marginTop: "var(--space-5)", gap: "var(--space-3)" }}>
              <div className="inline-flex items-center gap-2 text-sm" style={{ color: "var(--action-primary)" }}>
                <CheckCircle2 className="h-4 w-4" aria-hidden /> Check your email
              </div>
              <p style={{ fontSize: "var(--font-size-caption)", color: "var(--text-muted)" }}>
                If an account exists for <strong className="text-foreground">{email}</strong>, a password-reset link is on its way. The link expires in 60 minutes.
              </p>
              <button
                type="button"
                onClick={() => { setSent(false); setEmail(""); }}
                className="text-sm transition hover:text-foreground"
                style={{ color: "var(--text-muted)" }}
              >
                Send to a different address
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col" style={{ marginTop: "var(--space-6)", gap: "var(--space-3)" }} noValidate>
              <label className="text-xs font-medium text-muted-foreground" htmlFor="fp-email">Email</label>
              <input
                id="fp-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!error}
                aria-describedby={error ? "fp-error" : undefined}
                className="text-sm text-foreground outline-none transition focus:border-magenta/60"
                style={{
                  border: "1px solid var(--border-default)",
                  backgroundColor: "var(--surface-secondary)",
                  borderRadius: "var(--radius-sm)",
                  paddingInline: "var(--space-4)",
                  paddingBlock: "var(--space-3)",
                }}
                placeholder="you@example.com"
              />
              {error && (
                <p id="fp-error" role="alert" style={{ fontSize: "var(--font-size-micro)", color: "var(--action-secondary)" }}>{error}</p>
              )}
              <button
                type="submit"
                disabled={loading || !email}
                className="inline-flex items-center justify-center gap-2 text-sm font-medium text-white disabled:opacity-60"
                style={{
                  marginTop: "var(--space-2)",
                  backgroundColor: "var(--action-primary)",
                  borderRadius: "var(--radius-sm)",
                  paddingInline: "var(--space-5)",
                  paddingBlock: "var(--space-3)",
                }}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Mail className="h-4 w-4" aria-hidden />}
                Send reset link
              </button>
            </form>
          )}
        </motion.div>
      </div>
    </main>
  );
}