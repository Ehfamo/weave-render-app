import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Sparkles, Loader2, KeyRound, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { scorePassword, friendlyAuthError } from "@/lib/auth-validation";
import { toast } from "sonner";
import { pageUrl } from "@/lib/seo";

export const Route = createFileRoute("/reset-password")({
  component: ResetPassword,
  ssr: false,
  head: () => ({
    meta: [
      { title: "Choose a new password — XeomX" },
      { name: "robots", content: "noindex" },
      { property: "og:url", content: pageUrl("/reset-password") },
    ],
    links: [{ rel: "canonical", href: pageUrl("/reset-password") }],
  }),
});

function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [recoveryValid, setRecoveryValid] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Supabase's recovery link signs the user in with a temporary session
    // and fires PASSWORD_RECOVERY on load. Trust either signal.
    let cancelled = false;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY") {
        setRecoveryValid(true);
        setReady(true);
      } else if (event === "SIGNED_IN" && session) {
        setRecoveryValid(true);
        setReady(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) setRecoveryValid(true);
      else if (recoveryValid === null) setRecoveryValid(false);
      setReady(true);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const strength = useMemo(() => scorePassword(password), [password]);
  const canSubmit = strength.ok && password === confirm && !saving;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setSaving(false);
      const msg = friendlyAuthError(err.message);
      setError(msg);
      toast.error(msg);
      return;
    }
    setDone(true);
    setSaving(false);
    toast.success("Password updated");
    // Sign the temporary recovery session out so the user re-authenticates.
    await supabase.auth.signOut();
    setTimeout(() => navigate({ to: "/auth", search: {} }), 1500);
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
          aria-labelledby="rp-title"
        >
          <h1 id="rp-title" className="font-display font-bold tracking-tight text-foreground" style={{ fontSize: "clamp(1.5rem, 4vw, var(--font-size-h1))" }}>
            Choose a new password
          </h1>

          {!ready ? (
            <div className="flex items-center gap-2" style={{ marginTop: "var(--space-5)", color: "var(--text-muted)" }}>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> <span className="text-sm">Verifying reset link…</span>
            </div>
          ) : recoveryValid === false ? (
            <div className="flex flex-col items-start" style={{ marginTop: "var(--space-5)", gap: "var(--space-3)" }}>
              <div className="inline-flex items-center gap-2 text-sm" style={{ color: "var(--action-secondary)" }}>
                <AlertTriangle className="h-4 w-4" aria-hidden /> Link expired or invalid
              </div>
              <p style={{ fontSize: "var(--font-size-caption)", color: "var(--text-muted)" }}>
                Reset links expire after 60 minutes and can only be used once. Request a new one to continue.
              </p>
              <Link
                to="/forgot-password"
                className="text-sm font-medium"
                style={{ color: "var(--action-primary)" }}
              >
                Request a new link →
              </Link>
            </div>
          ) : done ? (
            <div className="flex flex-col items-start" style={{ marginTop: "var(--space-5)", gap: "var(--space-3)" }}>
              <div className="inline-flex items-center gap-2 text-sm" style={{ color: "var(--action-primary)" }}>
                <CheckCircle2 className="h-4 w-4" aria-hidden /> Password updated
              </div>
              <p style={{ fontSize: "var(--font-size-caption)", color: "var(--text-muted)" }}>
                Redirecting you to sign in…
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col" style={{ marginTop: "var(--space-6)", gap: "var(--space-3)" }} noValidate>
              <label className="text-xs font-medium text-muted-foreground" htmlFor="rp-pw">New password</label>
              <input
                id="rp-pw"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-describedby="rp-pw-hints"
                className="text-sm text-foreground outline-none transition focus:border-magenta/60"
                style={{
                  border: "1px solid var(--border-default)",
                  backgroundColor: "var(--surface-secondary)",
                  borderRadius: "var(--radius-sm)",
                  paddingInline: "var(--space-4)",
                  paddingBlock: "var(--space-3)",
                }}
              />
              <StrengthMeter strength={strength} id="rp-pw-hints" />

              <label className="text-xs font-medium text-muted-foreground" htmlFor="rp-confirm" style={{ marginTop: "var(--space-2)" }}>
                Confirm new password
              </label>
              <input
                id="rp-confirm"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                aria-invalid={confirm.length > 0 && confirm !== password}
                className="text-sm text-foreground outline-none transition focus:border-magenta/60"
                style={{
                  border: "1px solid var(--border-default)",
                  backgroundColor: "var(--surface-secondary)",
                  borderRadius: "var(--radius-sm)",
                  paddingInline: "var(--space-4)",
                  paddingBlock: "var(--space-3)",
                }}
              />
              {confirm.length > 0 && confirm !== password && (
                <p role="alert" style={{ fontSize: "var(--font-size-micro)", color: "var(--action-secondary)" }}>Passwords don't match</p>
              )}
              {error && <p role="alert" style={{ fontSize: "var(--font-size-micro)", color: "var(--action-secondary)" }}>{error}</p>}

              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex items-center justify-center gap-2 text-sm font-medium text-white disabled:opacity-60"
                style={{
                  marginTop: "var(--space-2)",
                  backgroundColor: "var(--action-primary)",
                  borderRadius: "var(--radius-sm)",
                  paddingInline: "var(--space-5)",
                  paddingBlock: "var(--space-3)",
                }}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <KeyRound className="h-4 w-4" aria-hidden />}
                Update password
              </button>
            </form>
          )}
        </motion.div>
      </div>
    </main>
  );
}

export function StrengthMeter({ strength, id }: { strength: ReturnType<typeof scorePassword>; id?: string }) {
  const color = strength.score >= 3 ? "var(--action-primary)" : strength.score >= 2 ? "#eab308" : "var(--action-secondary)";
  return (
    <div id={id} aria-live="polite">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={strength.score}
        aria-label={`Password strength: ${strength.label}`}
        className="grid grid-cols-4 gap-1"
        style={{ marginTop: "var(--space-2)" }}
      >
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="h-1 rounded-full"
            style={{ background: strength.score >= i ? color : "var(--border-default)" }}
          />
        ))}
      </div>
      <div className="flex items-center justify-between" style={{ marginTop: "var(--space-1)" }}>
        <span style={{ fontSize: "var(--font-size-micro)", color }}>{strength.label}</span>
        {strength.hints[0] && (
          <span style={{ fontSize: "var(--font-size-micro)", color: "var(--text-muted)" }}>{strength.hints[0]}</span>
        )}
      </div>
    </div>
  );
}